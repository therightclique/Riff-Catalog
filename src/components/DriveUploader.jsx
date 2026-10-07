const FOLDER_NAME = 'RiffCatalog';

// Folder IDs don't change during a session. Caching them removes 3+
// sequential Drive round trips from every upload after the first.
const folderIdCache = new Map();

async function getOrCreateFolder(accessToken, folderName, parentId = null) {
  const cacheKey = `${parentId || 'root'}/${folderName}`;
  if (folderIdCache.has(cacheKey)) return folderIdCache.get(cacheKey);

  const query = parentId
    ? `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    folderIdCache.set(cacheKey, searchData.files[0].id);
    return searchData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : ['root'],
    }),
  });
  const createData = await createRes.json();
  folderIdCache.set(cacheKey, createData.id);
  return createData.id;
}

export async function uploadTextFile(accessToken, fileName, text, subfolder = 'Debug') {
  const rootFolderId = await getOrCreateFolder(accessToken, FOLDER_NAME);
  const subFolderId = await getOrCreateFolder(accessToken, subfolder, rootFolderId);

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({
    name: fileName,
    parents: [subFolderId],
  })], { type: 'application/json' }));
  form.append('file', new Blob([text], { type: 'text/plain' }));

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );
  if (!res.ok) throw new Error(`Drive upload failed (${res.status})`);
  return res.json();
}

// Lists saved text files in RiffCatalog/<subfolder>. Returns [] if the
// subfolder doesn't exist yet (nothing saved there), rather than creating
// it — listing shouldn't have the side effect of creating folders.
export async function listTextFiles(accessToken, subfolder) {
  const rootQuery = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;
  const rootRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(rootQuery)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const rootData = await rootRes.json();
  if (!rootData.files?.length) return [];
  const rootId = rootData.files[0].id;

  const subQuery = `name='${subfolder}' and mimeType='application/vnd.google-apps.folder' and '${rootId}' in parents and trashed=false`;
  const subRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQuery)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const subData = await subRes.json();
  if (!subData.files?.length) return [];
  const subFolderId = subData.files[0].id;

  const filesQuery = `'${subFolderId}' in parents and trashed=false`;
  const filesRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(filesQuery)}&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const filesData = await filesRes.json();
  return filesData.files || [];
}

export async function readTextFile(accessToken, fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Read failed (${res.status})`);
  return res.text();
}

// Uploads a recording and its metadata sidecar. Throws if Drive did not
// accept the audio — previously the response was never checked, so a
// rejected upload (e.g. an expired sign-in) was reported as a success and
// the recording was discarded. Returns the audio file's { id, name, size }
// plus sidecarSaved, which is false if the audio landed but the sidecar
// still failed after retries (the caller keeps the metadata to resend).
// recordedAt sets the year/month folder, so a clip recorded offline in one
// month but synced in the next still files under the month it was made.
export async function uploadToDrive(accessToken, blob, fileName, mimeType, initialMetadata = {}, recordedAt = null, localId = null) {
  const now = recordedAt ? new Date(recordedAt) : new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');

  const rootFolderId = await getOrCreateFolder(accessToken, FOLDER_NAME);
  const yearFolderId = await getOrCreateFolder(accessToken, year, rootFolderId);
  const monthFolderId = await getOrCreateFolder(accessToken, month, yearFolderId);

  const extension = mimeType.includes('webm') ? 'webm' :
                    mimeType.includes('ogg') ? 'ogg' :
                    mimeType.includes('mp4') ? 'm4a' : 'audio';
  const fullFileName = `${fileName}.${extension}`;

  const metadata = {
    name: fullFileName,
    parents: [monthFolderId],
    // Tags the Drive file with the id of the on-device copy it came from.
    // If the app is killed after Drive accepts the upload but before the
    // device records that fact, the next sync finds the file by this tag
    // instead of uploading the recording a second time.
    ...(localId ? { appProperties: { localId } } : {}),
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', blob);

  // Sidecar only needs monthFolderId, same as the audio file — upload both
  // at the same time instead of waiting for the audio upload to finish.
  const sidecarName = `${fileName}.json`;
  const sidecarBody = JSON.stringify(initialMetadata, null, 2);
  // FormData bodies can only be sent once, so build a fresh one per attempt.
  const postSidecar = () => {
    const sidecarForm = new FormData();
    sidecarForm.append('metadata', new Blob([JSON.stringify({
      name: sidecarName,
      parents: [monthFolderId],
    })], { type: 'application/json' }));
    sidecarForm.append('file', new Blob([sidecarBody], { type: 'application/json' }));
    return fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: sidecarForm,
      }
    );
  };

  const [uploadRes, firstSidecarRes] = await Promise.all([
    fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webContentLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      }
    ),
    postSidecar().catch(err => ({ ok: false, err })),
  ]);

  if (!uploadRes.ok) {
    throw new Error(`Drive rejected the audio upload (${uploadRes.status})`);
  }
  const uploadData = await uploadRes.json();
  if (!uploadData?.id) throw new Error('Drive returned no file id for the audio upload');

  // The audio is safely on Drive at this point. If only the sidecar
  // failed, retry it a couple of times rather than re-uploading the audio
  // (which would create a duplicate clip).
  let sidecarSaved = firstSidecarRes.ok;
  for (let attempt = 1; !sidecarSaved && attempt <= 2; attempt++) {
    console.warn(`[upload] sidecar failed, retry ${attempt}/2`);
    try {
      sidecarSaved = (await postSidecar()).ok;
    } catch { /* keep trying */ }
  }

  return { ...uploadData, sidecarSaved };
}

// Confirms a file genuinely exists on Drive, isn't trashed, and is exactly
// the expected size — the check that must pass before a local copy of a
// recording is ever deleted. Returns false (never throws) on any doubt.
export async function verifyDriveFile(accessToken, fileId, expectedSize) {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,size,trashed`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return false;
    const data = await res.json();
    const ok = data.id === fileId && !data.trashed && Number(data.size) === expectedSize;
    if (!ok) console.warn('[upload] verification mismatch:', data, 'expected size', expectedSize);
    return ok;
  } catch {
    return false;
  }
}

// Finds a Drive file previously uploaded from the on-device copy with this
// id (see the localId tag in uploadToDrive). Returns { id, name, size } or
// null. Drive queries are eventually consistent, so a miss right after an
// upload is possible; the worst case is one duplicate clip, never a lost one.
export async function findUploadByLocalId(accessToken, localId) {
  const q = `appProperties has { key='localId' and value='${localId}' } and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,size)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Drive lookup failed (${res.status})`);
  const data = await res.json();
  return data.files?.[0] || null;
}

// Makes sure a metadata (.json) file exists beside an already-uploaded
// audio file, creating it only if it's genuinely missing. Used when the
// audio reached Drive but its details file didn't.
export async function ensureSidecar(accessToken, audioFileId, baseName, metadata) {
  const parentRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${audioFileId}?fields=parents`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!parentRes.ok) throw new Error(`Drive lookup failed (${parentRes.status})`);
  const parentId = (await parentRes.json()).parents?.[0];
  if (!parentId) throw new Error('Audio file has no folder on Drive');

  const jsonName = `${baseName}.json`;
  // Drive query strings are single-quoted, so a name like "Don't Stop"
  // would otherwise end the string early. Escape \ first, then '.
  const escaped = jsonName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `name='${escaped}' and '${parentId}' in parents and trashed=false`;
  const existsRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!existsRes.ok) throw new Error(`Drive lookup failed (${existsRes.status})`);
  if ((await existsRes.json()).files?.length > 0) return true;

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ name: jsonName, parents: [parentId] })], { type: 'application/json' }));
  form.append('file', new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }));
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
  );
  if (!res.ok) throw new Error(`Drive rejected the details file (${res.status})`);
  return true;
}
