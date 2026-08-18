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
