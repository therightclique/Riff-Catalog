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
