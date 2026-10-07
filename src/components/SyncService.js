// Uploads recordings that were saved on the device (see OfflineStore) to
// Google Drive.
//
// The rule everything here serves: a device copy is deleted ONLY after
// Drive has confirmed the audio file exists, isn't trashed, and is exactly
// the expected size — never before, never on a guess. Every failure path
// simply leaves the device copy where it is for the next attempt.
//
// Per recording, in order:
//   1. Find out whether it's already on Drive — via the id we recorded
//      after a previous upload, or (if the app died before recording it)
//      via the localId tag attached to the Drive file at upload time.
//   2. If not, upload it.
//   3. Make sure its metadata (.json) file exists beside it.
//   4. Verify the audio on Drive (exists, not trashed, exact byte size).
//   5. Only then delete the device copy.

import {
  listPending, updatePending, deletePending, pendingToBlob, isInFlight,
} from './OfflineStore';
import {
  uploadToDrive, verifyDriveFile, findUploadByLocalId, ensureSidecar,
} from './DriveUploader';

let syncRunning = false;
export const isSyncRunning = () => syncRunning;

const isAuthError = (err) => /\b(401|403)\b/.test(String(err?.message || ''));

async function syncOne(accessToken, rec) {
  let audioId = rec.driveAudioId || null;
  let freshUploadWithSidecar = false;

  // 1. Already on Drive from an earlier attempt?
  if (!audioId) {
    const found = await findUploadByLocalId(accessToken, rec.id);
    if (found) {
      audioId = found.id;
      console.log(`[sync] "${rec.name}" was already on Drive — not re-uploading`);
    }
  }

  // 2. Upload if it genuinely isn't there.
  if (!audioId) {
    const result = await uploadToDrive(
      accessToken, pendingToBlob(rec), rec.name, rec.mimeType,
      rec.metadata || {}, rec.createdTime, rec.id
    );
    audioId = result.id;
    freshUploadWithSidecar = !!result.sidecarSaved;
    // Remember it immediately: if anything below fails, the next attempt
    // goes straight to verifying instead of uploading again.
    await updatePending(rec.id, { driveAudioId: audioId, driveAudioName: result.name });
  }

  // 3. Metadata file (skipped when the upload itself just saved it).
  if (!freshUploadWithSidecar) {
    await ensureSidecar(accessToken, audioId, rec.name, rec.metadata || {});
  }

  // 4. Verify, 5. delete.
  const verified = await verifyDriveFile(accessToken, audioId, rec.size);
  if (!verified) {
    throw new Error('Could not confirm the upload on Drive — kept on this device');
  }
  await deletePending(rec.id);
}

// Syncs every on-device recording (or just `onlyIds`), one at a time —
// sequential on purpose: these are large files on a possibly weak
// connection, and parallel uploads would just compete.
//
// onProgress({ done, total, currentId, currentName }) fires as it goes.
// Returns { synced, failed: [{ id, name, reason }], authExpired, skipped }.
export async function syncPendingClips(accessToken, { onlyIds = null, onProgress = null } = {}) {
  if (syncRunning) return { synced: 0, failed: [], authExpired: false, skipped: 0, alreadyRunning: true };
  syncRunning = true;
  const summary = { synced: 0, failed: [], authExpired: false, skipped: 0 };

  try {
    let records = await listPending();
    if (onlyIds) records = records.filter(r => onlyIds.includes(r.id));
    // Anything a live save is uploading right now is left alone, or it
    // would be uploaded twice.
    const ready = records.filter(r => !isInFlight(r.id));
    summary.skipped = records.length - ready.length;

    const total = ready.length;
    let done = 0;
    for (const rec of ready) {
      onProgress?.({ done, total, currentId: rec.id, currentName: rec.name });
      try {
        await syncOne(accessToken, rec);
        summary.synced++;
        console.log(`[sync] ✓ "${rec.name}" is on Drive; device copy removed`);
      } catch (err) {
        console.warn(`[sync] ✗ "${rec.name}":`, err);
        summary.failed.push({ id: rec.id, name: rec.name, reason: err?.message || 'Unknown error' });
        if (isAuthError(err)) { summary.authExpired = true; break; } // every remaining one would fail the same way
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break; // connection dropped mid-sync
      }
      done++;
      onProgress?.({ done, total, currentId: null, currentName: null });
    }
  } finally {
    syncRunning = false;
  }
  return summary;
}
