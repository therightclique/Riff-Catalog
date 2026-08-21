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

export async function uploadToDrive(accessToken, blob, fileName, mimeType, initialMetadata = {}) {
  const now = new Date();
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
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', blob);

  // Sidecar only needs monthFolderId, same as the audio file — upload both
  // at the same time instead of waiting for the audio upload to finish.
  const sidecarName = `${fileName}.json`;
  const sidecarBody = JSON.stringify(initialMetadata, null, 2);
  const sidecarForm = new FormData();
  sidecarForm.append('metadata', new Blob([JSON.stringify({
    name: sidecarName,
    parents: [monthFolderId],
  })], { type: 'application/json' }));
  sidecarForm.append('file', new Blob([sidecarBody], { type: 'application/json' }));

  const [uploadRes] = await Promise.all([
    fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webContentLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      }
    ),
    fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: sidecarForm,
      }
    ),
  ]);

  const uploadData = await uploadRes.json();
  return uploadData;
}
