export async function fetchClips(accessToken) {
  const allAudioQuery = `mimeType contains 'audio' and trashed=false`;
  let files = [];
  let pageToken = null;

  do {
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(allAudioQuery)}&fields=files(id,name,mimeType,size,createdTime,webContentLink),nextPageToken&orderBy=createdTime desc&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    files = files.concat(data.files || []);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return files;
}

export async function getAudioUrl(accessToken, fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
