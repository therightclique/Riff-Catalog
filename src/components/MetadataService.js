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

// ── Sidecar content cache ───────────────────────────────────────────────
// Downloading every sidecar's content (one request per clip) was the
// dominant cost of opening the Library. Drive reports each file's
// modifiedTime in the listing we already make, so content is cached on the
// device keyed by sidecar id and only re-downloaded when that file has
// actually changed (a save, an edit made on another device, …). Pruned to
// the current sidecars on every load so it can't grow without bound.
// Purely an optimization: any storage failure just means a full download.
const SIDECAR_CACHE_KEY = 'riffcatalog:sidecarCache:v1';

function readSidecarCache() {
  try {
    return JSON.parse(localStorage.getItem(SIDECAR_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeSidecarCache(cache) {
  try {
    localStorage.setItem(SIDECAR_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn('Sidecar cache write failed (will re-download next time):', err);
  }
}

// Lists every metadata sidecar (one paged Drive query). Exported separately
// so the Library can run it at the same time as the audio-file listing —
// the two don't depend on each other.
export async function listSidecars(accessToken) {
  const query = `mimeType='application/json' and trashed=false`;
  let sidecarFiles = [];
  let pageToken = null;

  do {
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime,modifiedTime),nextPageToken&orderBy=createdTime&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    sidecarFiles = sidecarFiles.concat(data.files || []);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return sidecarFiles;
}

// Matches sidecars to audio clips locally by filename, then fills in
// content — from the device cache when unchanged, from Drive otherwise.
// Pass the result of listSidecars() to skip the listing step; omitted, it
// lists them itself (same behaviour as before for any other caller).
export async function loadAllMetadata(accessToken, clips, sidecarFilesIn = null) {
  const sidecarFiles = sidecarFilesIn || await listSidecars(accessToken);

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
  const sidecarByClipId = {};
  for (const clip of clips) {
    const jsonName = sidecarName(clip.name);
    if (byName[jsonName]) {
      sidecarByClipId[clip.id] = byName[jsonName][0];
    }
  }

  const cache = readSidecarCache();
  const nextCache = {};
  let fromCache = 0;
  let downloaded = 0;
  const t0 = performance.now();

  const contentEntries = await Promise.all(
    Object.entries(sidecarByClipId).map(async ([clipId, sidecar]) => {
      const cached = cache[sidecar.id];
      if (cached && sidecar.modifiedTime && cached.modifiedTime === sidecar.modifiedTime) {
        fromCache++;
        nextCache[sidecar.id] = cached;
        return [clipId, { ...cached.data, _sidecarId: sidecar.id }];
      }
      try {
        const contentRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${sidecar.id}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!contentRes.ok) throw new Error(`HTTP ${contentRes.status}`);
        const metadata = await contentRes.json();
        downloaded++;
        if (sidecar.modifiedTime) {
          nextCache[sidecar.id] = { modifiedTime: sidecar.modifiedTime, data: metadata };
        }
        return [clipId, { ...metadata, _sidecarId: sidecar.id }];
      } catch (err) {
        // A failed download used to yield empty metadata — and saving the
        // clip afterwards would then overwrite the real file with blanks.
        // An older cached copy is a far safer fallback when one exists.
        console.warn(`Sidecar download failed for ${sidecar.name}:`, err);
        if (cached) {
          nextCache[sidecar.id] = cached;
          return [clipId, { ...cached.data, _sidecarId: sidecar.id }];
        }
        return [clipId, { _sidecarId: sidecar.id }];
      }
    })
  );

  writeSidecarCache(nextCache);
  console.log(`[timing] sidecar content: ${fromCache} from device cache, ${downloaded} downloaded, ${Math.round(performance.now() - t0)}ms`);

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
