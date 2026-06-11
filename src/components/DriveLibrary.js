export async function fetchClips(accessToken) {
  // First find the RiffCatalog root folder
  const rootQuery = `name='RiffCatalog' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;
  const rootRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(rootQuery)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const rootData = await rootRes.json();
  if (!rootData.files || rootData.files.length === 0) return [];

  const rootFolderId = rootData.files[0].id;

  // Search for all audio files anywhere under RiffCatalog
  const audioQuery = `'${rootFolderId}' in parents or mimeType contains 'audio'`;
  const allAudioQuery = `mimeType contains 'audio' and trashed=false`;

  const filesRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(allAudioQuery)}&fields=files(id,name,mimeType,size,createdTime,webContentLink)&orderBy=createdTime desc&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const filesData = await filesRes.json();
  return filesData.files || [];
}

export async function getAudioUrl(accessToken, fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
