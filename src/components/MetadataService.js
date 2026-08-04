export function sidecarName(audioFileName) {
  return audioFileName.replace(/\.(webm|m4a|ogg|audio)$/, '.json');
}

async function getParentFolderId(accessToken, fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.parents ? data.parents[0] : null;
}

// Fetch ALL sidecar JSON files in one Drive API call, then match them to
// audio clips locally by filename. This replaces making one search request
// per clip, which is what was causing the library to slow down as the
// number of recordings grew.
export async function loadAllMetadata(accessToken, clips) {
  const query = `mimeType='application/json' and trashed=false`;
  let sidecarFiles = [];
  let pageToken = null;

  do {
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime),nextPageToken&orderBy=createdTime&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    sidecarFiles = sidecarFiles.concat(data.files || []);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  // Group sidecars by name so we can detect and clean up duplicates,
  // same as the old per-clip logic did.
  const byName = {};
  for (const f of sidecarFiles) {
    if (!byName[f.name]) byName[f.name] = [];
    byName[f.name].push(f);
  }

  // Delete duplicate sidecars (keep the oldest), fire-and-forget in parallel
  const dupDeletes = [];
  for (const name in byName) {
    const [, ...duplicates] = byName[name];
    for (const dup of duplicates) {
      dupDeletes.push(
        fetch(`https://www.googleapis.com/drive/v3/files/${dup.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => {})
      );
    }
  }
  if (dupDeletes.length) Promise.all(dupDeletes);

  // Fetch content of each unique sidecar in parallel (one request per
  // sidecar, but no search step first — this is the expensive part we
  // couldn't eliminate, since Drive doesn't support fetching many files'
  // content in a single request).
  const sidecarIdByClipName = {};
  for (const clip of clips) {
    const jsonName = sidecarName(clip.name);
    if (byName[jsonName]) {
      sidecarIdByClipName[clip.id] = byName[jsonName][0].id;
    }
  }

  const contentEntries = await Promise.all(
    Object.entries(sidecarIdByClipName).map(async ([clipId, sidecarId]) => {
      try {
        const contentRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${sidecarId}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const metadata = await contentRes.json();
        return [clipId, { ...metadata, _sidecarId: sidecarId }];
      } catch {
        return [clipId, { _sidecarId: sidecarId }];
      }
    })
  );

  const metadataMap = Object.fromEntries(contentEntries);
  // Clips with no sidecar at all
  for (const clip of clips) {
    if (!metadataMap[clip.id]) metadataMap[clip.id] = { _sidecarId: null };
  }

  return metadataMap;
}

export async function loadMetadata(accessToken, audioFileId, audioFileName) {
  const jsonName = sidecarName(audioFileName);
  const query = `name='${jsonName}' and mimeType='application/json' and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=createdTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();

  if (!data.files || data.files.length === 0) {
    return { _sidecarId: null };
  }

  // Keep the oldest, delete any duplicates
  const [keeper, ...duplicates] = data.files;
  for (const dup of duplicates) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${dup.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  const sidecarId = keeper.id;
  const contentRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${sidecarId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const metadata = await contentRes.json();
  return { ...metadata, _sidecarId: sidecarId };
}

export async function saveMetadata(accessToken, audioFileId, audioFileName, metadata) {
  const jsonName = sidecarName(audioFileName);
  const { _sidecarId, ...cleanMetadata } = metadata;
  const body = JSON.stringify(cleanMetadata, null, 2);

  if (_sidecarId) {
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${_sidecarId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body,
      }
    );
    return _sidecarId;
  } else {
    const parentFolderId = await getParentFolderId(accessToken, audioFileId);

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify({
      name: jsonName,
      parents: parentFolderId ? [parentFolderId] : undefined,
    })], { type: 'application/json' }));
    formData.append('file', new Blob([body], { type: 'application/json' }));

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      }
    );
    const result = await res.json();
    return result.id;
  }
}
