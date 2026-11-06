import { useState, useEffect, useRef, useReducer } from 'react';
import { jwtDecode } from 'jwt-decode';
import Recorder from './components/Recorder';
import { uploadToDrive, verifyDriveFile } from './components/DriveUploader';
import { savePending, updatePending, deletePending, listPendingSummaries, markInFlight, clearInFlight } from './components/OfflineStore';
import { syncPendingClips } from './components/SyncService';
import Library from './components/Library';
import { analyzeAudio } from './components/AudioAnalyzer';
import KeyFinder from './components/KeyFinder';
import KeyNotes from './components/KeyNotes';
import Practice from './components/Practice';
import { CURRENT_VERSION, LAST_UPDATED } from './components/Changelog';
import Randomizer from './components/Randomizer';
import Settings from './components/Settings';
import Jam from './components/Jam';
import About from './components/About';
import Dashboard from './components/Dashboard';
import Feedback from './components/Feedback';
import ReviewPlayer from './components/ReviewPlayer';
import ShareButton from './components/ShareButton';
import UpdateBanner from './components/UpdateBanner';
import { SignInBanner, SignInGate } from './components/SignIn';
import { reportUsage, fetchSupportUnread, noteTabView, noteRecording, noteEvent, noteMilestone, noteUpload, noteProblem, problemCode, installErrorCapture, installActiveTimer } from './components/UsageLog';
import { syncSettings } from './components/SettingsService';
import { subscribeNoteRoleColors } from './components/theme';
import { keyLabel, subscribeAccidentals } from './components/Notation';
import { initDebugLog } from './components/DebugLog';

initDebugLog();

const CLIENT_ID = '495492558072-8ohvj2v3npv2coeq1alndbh0g0lk95s2.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

const ALL_KEYS = [
  'A Major', 'A# Major', 'B Major', 'C Major', 'C# Major', 'D Major',
  'D# Major', 'E Major', 'F Major', 'F# Major', 'G Major', 'G# Major',
  'A Minor', 'A# Minor', 'B Minor', 'C Minor', 'C# Minor', 'D Minor',
  'D# Minor', 'E Minor', 'F Minor', 'F# Minor', 'G Minor', 'G# Minor',
];

function abbreviateKey(key) {
  if (!key) return key;
  return keyLabel(key).replace('Major', 'Maj').replace('Minor', 'Min');
}

// Gives up waiting on something that isn't answering. The work itself can't be cancelled, so callers decide what to do next.
function withTimeout(promise, ms, label = 'request') {
  let timer;
  const stop = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms); });
  return Promise.race([promise, stop]).finally(() => clearTimeout(timer));
}
// How long a save may take before it is handed over to the automatic retry: 45 seconds plus 20 more per megabyte, at most 3 minutes.
const uploadTimeoutMs = (bytes) => (typeof window !== 'undefined' && window.__RC_UPLOAD_MS) || Math.min(180000, 45000 + Math.ceil((bytes || 0) / 1048576) * 20000);   // window.__RC_UPLOAD_MS: only for automated tests
const DUPLICATE_CHECK_MS = 8000;

async function checkDuplicate(accessToken, name) {
  const query = `(name='${name}.webm' or name='${name}.m4a') and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.files && data.files.length > 0;
}

async function findAvailableName(accessToken, baseName) {
  let suffix = 2;
  while (true) {
    const candidate = `${baseName}-${suffix}`;
    const isDupe = await checkDuplicate(accessToken, candidate);
    if (!isDupe) return candidate;
    suffix++;
  }
}

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('rc_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Google's implicit-flow access tokens are short-lived (~1hr) and are
  // never persisted anywhere by default — every fresh page load starts
  // with none and has to ask Google for a new one. That request is silent
  // and relies on Google's own session cookie. In a standalone home-screen
  // app on iOS, each relaunch gets its OWN isolated storage/cookie jar
  // completely separate from Safari's, so there's no session for the
  // silent request to use — it fails every single time you reopen the app,
  // which is what caused the constant hourglass.
  //
  // The fix: store the token itself (with its real expiry) so relaunches
  // within that ~1hr window reuse it instantly with no network request and
  // no prompt at all, instead of depending on a cookie that doesn't exist
  // in this context.
  const [accessToken, setAccessToken] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('rc_drive_token') || 'null');
      if (saved?.token && saved?.expiresAt && Date.now() < saved.expiresAt) {
        return saved.token;
      }
    } catch { /* ignore malformed storage */ }
    return null;
  });

  const storeToken = (token, expiresInSeconds) => {
    setAccessToken(token);
    try {
      const expiresAt = Date.now() + (Math.max(expiresInSeconds || 3600, 60) - 60) * 1000; // 60s safety margin
      localStorage.setItem('rc_drive_token', JSON.stringify({ token, expiresAt }));
    } catch { /* storage full/unavailable — token still works for this session */ }
  };

  const [pendingRecording, setPendingRecording] = useState(null);
  const capturedRef = useRef(null);   // the raw take (samples, tempo) for the recording waiting to be saved
  const [clipName, setClipName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [lastUpload, setLastUpload] = useState(null);
  // The refresh button reloads with ?view=<tab> so you land back where you
  // were (fresh state, not the old state). Read once at startup, validated
  // against the real tab list so a stale or hand-edited URL can't leave
  // the app on a blank view, then stripped from the address so a later
  // manual reload starts normally.
  const VALID_VIEWS = ['record', 'library', 'keyfinder', 'practice', 'randomizer', 'feedback', 'settings', 'jam', 'about', 'dashboard'];
  // Changelog lives inside About and Debug inside Support; old links to them open that section on the right tab.
  const [aboutRequest, setAboutRequest] = useState(() => {
    try { const v = new URLSearchParams(window.location.search).get('view'); return v === 'changelog' ? { tab: v, n: 1 } : null; } catch { return null; }
  });
  const [supportRequest] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('view') === 'debug' ? { tab: 'debug', n: 1 } : null; } catch { return null; }
  });
  const [view, setView] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('view');
      if (v || params.has('r')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      if (v === 'changelog') return 'about';
      if (v === 'debug') return 'feedback';
      // Someone who hasn't signed in yet lands on About (what the app is); signed-in people land on Record.
      return VALID_VIEWS.includes(v) ? v : (user ? 'record' : 'about');
    } catch {
      return 'record';
    }
  });
  const [keyFinderFilter, setKeyFinderFilter] = useState(null);
  const [signInPrompt, setSignInPrompt] = useState(false);   // signed-out person tapped Record

  // Bumped after each successful save so the (always-mounted) Library
  // re-fetches and the new clip appears immediately.
  const [libraryRefreshToken, setLibraryRefreshToken] = useState(0);
  // True while Library holds metadata edits not yet saved to Drive.
  const [libraryHasUnsaved, setLibraryHasUnsaved] = useState(false);
  // True while the Recorder is actively capturing a take.
  const [isRecording, setIsRecording] = useState(false);

  // ── Recordings saved on the device, waiting to reach Drive ──────────
  // pendingClips holds summaries (no audio bytes) of everything in the
  // on-device store, for the banner and the Library's orange cards.
  const [pendingClips, setPendingClips] = useState([]);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [syncState, setSyncState] = useState(null);     // { running, done, total, currentId, currentName }
  const [syncMessage, setSyncMessage] = useState(null); // { kind: 'ok' | 'warn', text }

  const refreshPending = async () => {
    try {
      setPendingClips(await listPendingSummaries());
    } catch (err) {
      console.warn('[offline] could not read on-device recordings:', err);
    }
  };

  useEffect(() => {
    refreshPending();
    const goOnline = () => { setIsOnline(true); refreshPending(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Navigation history for the app-wide back button. viewHistory is a
  // stack of previously-visited views (not including the current one);
  // visitedViews tracks which tabs have EVER been mounted, so each one
  // still only does its normal first-visit work (e.g. Library's initial
  // Drive fetch) the first time you go there, not eagerly on app load.
  // Once a tab has been visited, it's never unmounted again — switching
  // away just toggles CSS display, which is what actually preserves
  // "everything you were looking at" (scroll position, expanded cards,
  // filters, in-progress edits — anything living in that tab's own
  // React state) instead of destroying it every time you switch tabs.
  const [viewHistory, setViewHistory] = useState([]);
  const [visitedViews, setVisitedViews] = useState(() => new Set(['record', view]));

  // Owner-only Dashboard: the server says whether this account is the owner; remembered on this device.
  const [isOwner, setIsOwner] = useState(() => { try { return localStorage.getItem('rc_owner') === '1'; } catch { return false; } });
  // Hamburger menu: top-level sections live here. Add a section by adding
  // one line to MENU_ITEMS (plus its view below); the menu scrolls on its own.
  const MENU_ITEMS = [
    { id: 'record', label: 'Record', icon: '●' },
    { id: 'library', label: 'Library', icon: '📚' },
    { id: 'keyfinder', label: 'Key Finder', icon: '🎹' },
    { id: 'practice', label: 'Practice', icon: '🎯' },
    { id: 'jam', label: 'Jam', icon: '🥁' },
    { id: 'randomizer', label: 'Randomizer', icon: '🎲' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'feedback', label: 'Support', icon: '💬' },
    { id: 'about', label: 'About', icon: 'ℹ️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },   // Settings stays last
  ];
  const [menuOpen, setMenuOpen] = useState(false);

  // Re-draw everything when the interval colors change (picked here, or
  // adopted from another device), so no screen keeps showing the old ones.
  const [, bumpColors] = useReducer(n => n + 1, 0);
  useEffect(() => subscribeNoteRoleColors(bumpColors), []);
  useEffect(() => subscribeAccidentals(bumpColors), []);   // sharps/flats changed in Settings
  // Sync saved settings with Google Drive: on sign-in / new token, when the
  // app returns to the foreground, and when the connection comes back.
  useEffect(() => {
    if (!accessToken) return;
    syncSettings(accessToken);
    const resync = () => { if (document.visibilityState !== 'hidden') syncSettings(accessToken); };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
    };
  }, [accessToken]);
  // Usage summary (counts only, one row per email on the server). Once per
  // page load when signed in; UsageLog throttles and never blocks the UI.
  useEffect(() => { installErrorCapture(); installActiveTimer(); }, []);
  const usageReported = useRef(false);
  useEffect(() => {
    if (!accessToken || !user || usageReported.current) return;
    usageReported.current = true;
    noteTabView(view);
    Promise.resolve(reportUsage(accessToken, CURRENT_VERSION)).then(() => {
      try { setIsOwner(localStorage.getItem('rc_owner') === '1'); } catch { /* ignore */ }
    }).catch(() => {});
  }, [accessToken, user]);
  // Owner only: tell the owner how many support requests are waiting. Checked when the app opens (even on a quick
  // reopen) and whenever the app comes back to the front, at most every 5 minutes.
  const [supportUnread, setSupportUnread] = useState(0);
  const [supportDismissed, setSupportDismissed] = useState(false);
  const supportCheckedAt = useRef(0);
  useEffect(() => {
    if (!isOwner || !accessToken || !user) return undefined;
    const check = async () => {
      if (Date.now() - supportCheckedAt.current < 5 * 60000) return;
      supportCheckedAt.current = Date.now();
      const r = await fetchSupportUnread(accessToken);
      if (r) setSupportUnread(prev => { if (r.unread > prev) setSupportDismissed(false); return r.unread; });
    };
    check();
    const onShow = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [isOwner, accessToken, user]);
  useEffect(() => {
    const onRead = (e) => { const n = Number(e?.detail?.unread); if (Number.isFinite(n)) setSupportUnread(n); };
    window.addEventListener('rc-support-unread', onRead);
    return () => window.removeEventListener('rc-support-unread', onRead);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const goToView = (newView) => {
    setMenuOpen(false);
    if (newView === view) return;
    noteTabView(newView);
    setViewHistory(prev => [...prev, view]);
    setVisitedViews(prev => (prev.has(newView) ? prev : new Set(prev).add(newView)));
    setView(newView);
  };

  const goBack = () => {
    setMenuOpen(false);
    setViewHistory(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop();
      setView(last);
      return next;
    });
  };

  const handleFilterByKey = (key) => {
    setKeyFinderFilter(key);
    goToView('library');
  };
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [showOtherKey, setShowOtherKey] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { original, suggested }
  const driveRequested = useRef(false);
  const [reconnecting, setReconnecting] = useState(false);

  const requestDriveAccess = () => {
    if (driveRequested.current) return;
    driveRequested.current = true;
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPES, prompt: '',
      callback: (tokenResponse) => {
        if (tokenResponse.access_token) storeToken(tokenResponse.access_token, tokenResponse.expires_in);
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  };

  // Sets up Google sign-in (once) and tells every sign-in button on screen to draw itself.
  const gsiInited = useRef(false);
  const initGsi = (showOneTap) => {
    if (!window.google?.accounts?.id) return;
    if (!gsiInited.current) {
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => {
          const decoded = jwtDecode(response.credential);
          setUser(decoded);
          localStorage.setItem('rc_user', JSON.stringify(decoded));
          driveRequested.current = false;
          requestDriveAccess();
        },
        auto_select: true,
      });
      gsiInited.current = true;
    }
    window.__rcGsiReady = true;
    window.dispatchEvent(new Event('rc-gsi-ready'));
    if (showOneTap) window.google.accounts.id.prompt();
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (user) {
        // A still-valid stored token was already loaded into state above —
        // only ask Google for a new one if we don't already have one.
        if (!accessToken) requestDriveAccess();
      } else {
        initGsi(true);
      }
    };
    document.body.appendChild(script);
  }, []);

  // A standalone home-screen app on iOS is frequently fully unloaded by the
  // OS while backgrounded, then reloaded from scratch when reopened — this
  // fires the same way a fresh launch does. Browsers won't let us silently
  // pop an OAuth window without a real tap, so a background retry can only
  // ever try the silent (no-UI) path; it can't complete a full reconnect on
  // its own. This at least catches the cases where silent auth *can*
  // succeed (token merely expired but Google still recognizes the session)
  // without making the person do anything, and skips the attempt entirely
  // if a still-valid stored token was already found.
  useEffect(() => {
    const tryReconnectOnForeground = () => {
      if (document.visibilityState !== 'visible') return;
      if (accessToken) return; // already have a valid token, nothing to do
      if (!user || !window.google?.accounts?.oauth2) return;
      driveRequested.current = false; // allow another attempt
      requestDriveAccess();
    };
    document.addEventListener('visibilitychange', tryReconnectOnForeground);
    window.addEventListener('pageshow', tryReconnectOnForeground);
    return () => {
      document.removeEventListener('visibilitychange', tryReconnectOnForeground);
      window.removeEventListener('pageshow', tryReconnectOnForeground);
    };
  }, [accessToken, user]);

  const handleLogout = () => {
    window.google.accounts.id.disableAutoSelect();
    if (accessToken) window.google.accounts.oauth2.revoke(accessToken);
    localStorage.removeItem('rc_user');
    localStorage.removeItem('rc_drive_token');
    setUser(null);
    setAccessToken(null);
    driveRequested.current = false;
    initGsi(false);   // so the Sign in button works again straight away
    setMenuOpen(false); setViewHistory([]); setVisitedViews(prev => new Set(prev).add('about')); setView('about'); window.scrollTo(0, 0); setTimeout(() => window.scrollTo(0, 0), 50);   // land on About, not a stale signed-in screen
  };

  const handleRecordingComplete = async (blob, mimeType, capturedPcm = null) => {
    console.log('Recording complete. Blob type:', blob.type, 'size:', blob.size, 'passed mimeType:', mimeType, 'pcm samples:', capturedPcm?.pcm?.length || 0);
    capturedRef.current = capturedPcm;
    setPendingRecording({ blob, mimeType });
    setClipName('');
    setLastUpload(null);
    setAnalysis(null);
    setSelectedKey(null);
    setShowOtherKey(false);
    setDuplicateWarning(null);
    setAnalyzing(true);
    let result = null;
    try {
      result = await analyzeAudio(blob, capturedPcm);
    } catch (err) {
      console.error('Record-time analysis failed:', err);
      noteProblem('analysis', problemCode(err));
    }
    console.log('Analysis result:', result);
    // A take recorded with the metronome has a known tempo: use it rather than the detected one.
    const metroTempo = capturedPcm?.tempo || null;
    if (metroTempo) result = { ...(result || { candidates: [], analyzerVersion: null }), bpm: metroTempo, bpmFromMetronome: true };
    setAnalysis(result);
    if (result?.candidates?.length > 0) setSelectedKey(result.candidates[0].key);
    setAnalyzing(false);
  };

  const handleUpload = async () => {
    if (!clipName.trim()) { alert('Please enter a name for this clip.'); return; }
    setUploading(true);
    setDuplicateWarning(null);

    const t0 = performance.now();
    // The duplicate-name check needs Drive. With no connection or sign-in,
    // skip it rather than stall on a request that can't succeed.
    if (!accessToken || !navigator.onLine) {
      await doUpload(clipName.trim());
      return;
    }
    try {
      const isDupe = await withTimeout(checkDuplicate(accessToken, clipName.trim()), DUPLICATE_CHECK_MS, 'duplicate check');
      console.log(`[timing] duplicate check: ${Math.round(performance.now() - t0)}ms`);
      if (isDupe) {
        const suggested = await withTimeout(findAvailableName(accessToken, clipName.trim()), DUPLICATE_CHECK_MS, 'name search');
        setDuplicateWarning({ original: clipName.trim(), suggested });
        setUploading(false);
        return;
      }
    } catch (err) {
      console.error('Duplicate check skipped:', err);   // slow or failed: carry on and save; the clip is safe on the device first
    }

    await doUpload(clipName.trim());
  };

  // Local-first save. Order matters — a recording is never at risk:
  //   1. write it to the device (OfflineStore / IndexedDB)
  //   2. if Drive is reachable, upload it
  //   3. verify on Drive that the file exists at exactly the right size
  //   4. only then delete the device copy
  // Anything short of a verified upload (offline, signed out, expired
  // token, Drive error, size mismatch) leaves it safely on the device to
  // sync later. If the audio verifies but its metadata file failed, the
  // device copy is kept with driveAudioId set, so the next sync only has
  // to send the metadata instead of uploading a duplicate clip.
  const doUpload = async (name) => {
    setUploading(true);
    setDuplicateWarning(null);
    const t0 = performance.now();
    const { blob, mimeType } = pendingRecording;
    const initialMetadata = {
      dateRecorded: new Date().toISOString(),
      key: selectedKey || '',
      bpm: analysis?.bpm?.toString() || '',
      candidates: analysis?.candidates || [],
      analyzerVersion: analysis?.analyzerVersion || null,
    };

    const captured = capturedRef.current;
    const takeSeconds = captured?.pcm && captured?.sampleRate ? captured.pcm.length / captured.sampleRate : 0;
    const finishReview = (saved) => {
      noteRecording(takeSeconds);
      capturedRef.current = null;
      setLastUpload(saved);
      setLibraryRefreshToken(t => t + 1);
      setPendingRecording(null);
      setClipName('');
      setAnalysis(null);
      setSelectedKey(null);
      setShowOtherKey(false);
    };

    // 1. Device first.
    let local = null;
    try {
      local = await savePending({ name, mimeType, blob, metadata: initialMetadata });
    } catch (err) {
      console.error('[offline] could not save on device:', err);
    }

    // While this save is uploading, keep the sync service's hands off it —
    // otherwise a "Sync now" tapped at the same moment would upload the
    // same recording a second time.
    if (local) markInFlight(local.id);
    const settle = async () => {
      if (local) clearInFlight(local.id);
      await refreshPending();
    };

    // 2–4. Drive, if there's any chance of reaching it.
    // The work runs on its own; if it hasn't finished in time the person is told the clip is safe on the device and
    // will upload automatically. The work itself is left to finish in the background (and the sync service is kept
    // away from this clip until it does), so a late success can't turn into a second copy on Drive.
    let timedOut = false;
    if (accessToken && navigator.onLine) {
      const driveWork = (async () => {
        try {
          const result = await uploadToDrive(
            accessToken, blob, name, mimeType, initialMetadata, local?.createdTime, local?.id
          );
          console.log(`[timing] uploadToDrive total: ${Math.round(performance.now() - t0)}ms`);
          noteUpload((performance.now() - t0) / 1000);
          const verified = await verifyDriveFile(accessToken, result.id, blob.size);

          if (verified && result.sidecarSaved) {
            noteMilestone('driveSave');
            if (local) await deletePending(local.id);
            return { status: 'saved', name: result.name };
          }
          // Audio may well be on Drive — remember where, so sync can
          // re-verify it instead of uploading a second copy.
          if (local) {
            await updatePending(local.id, {
              driveAudioId: result.id,
              driveAudioName: result.name,
              sidecarSaved: result.sidecarSaved,
            });
          }
          if (verified) {
            console.warn('[upload] audio confirmed on Drive, but its details file failed — kept for next sync');
            return { status: 'detailsPending', name: result.name };
          }
          console.warn('[upload] could not verify upload on Drive — keeping device copy');
          noteEvent('uploadFail');
          noteProblem('upload', 'unverified');
          return { status: 'failed' };
        } catch (err) {
          console.error('[upload] Drive upload failed — keeping device copy:', err);
          noteEvent('uploadFail');
          noteProblem('upload', problemCode(err));
          return { status: 'failed' };
        }
      })();

      // With no copy on the device there is nothing to fall back on, so wait for the real answer.
      const outcome = local
        ? await Promise.race([driveWork, new Promise(r => setTimeout(() => r({ status: 'timeout' }), uploadTimeoutMs(blob.size)))])
        : await driveWork;

      if (outcome.status === 'timeout') {
        timedOut = true;
        console.warn('[upload] taking too long — clip kept on the device, will upload automatically');
        noteEvent('uploadFail');
        noteProblem('upload', 'timeout');
        // Finish in the background; keep the sync service off this clip until the upload has really ended (10 minutes at most).
        const giveUp = setTimeout(() => { clearInFlight(local.id); refreshPending(); }, 10 * 60 * 1000);
        driveWork.then(async (late) => {
          clearTimeout(giveUp);
          clearInFlight(local.id);
          await refreshPending();
          if (late.status === 'saved' || late.status === 'detailsPending') setLibraryRefreshToken(t => t + 1);
        });
        finishReview({ name: local.name, offline: true, timedOut: true });
        await refreshPending();
        setUploading(false);
        return;
      }
      if (outcome.status === 'saved') {
        finishReview({ name: outcome.name, offline: false });
        await settle();
        setUploading(false);
        return;
      }
      if (outcome.status === 'detailsPending') {
        finishReview({ name: outcome.name, offline: false, detailsPending: !!local });
        await settle();
        setUploading(false);
        return;
      }
    }

    // Not confirmed on Drive.
    if (local) {
      finishReview({ name: local.name, offline: true });
    } else {
      // Couldn't save locally AND couldn't upload: keep the review screen
      // up with the recording intact, exactly as before this change.
      alert("Couldn't upload, and couldn't save on this device either. Your recording is still here — please try again.");
    }
    await settle();
    setUploading(false);
  };

  const handleDiscard = () => {
    capturedRef.current = null;
    setPendingRecording(null);
    setClipName('');
    setAnalysis(null);
    setSelectedKey(null);
    setShowOtherKey(false);
    setDuplicateWarning(null);
  };

  const candidateBtnStyle = (isSelected, isFirst) => ({
    padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px',
    border: isSelected ? '2px solid #1a73e8' : isFirst ? '2px solid #2a6b17' : '1px solid var(--rc-line)',
    backgroundColor: isSelected ? '#1a73e8' : 'var(--rc-surface)',
    color: isSelected ? 'white' : 'var(--rc-ink)',
    fontWeight: isSelected || isFirst ? '600' : '400',
  });

  // Tries silent reconnect first (no UI); if that genuinely fails, falls
  // back to the lightest interactive prompt Google will show. Returns true
  // if a token was obtained. Used by both the global banner (one tap) and
  // the Record-tab refresh link.
  const reconnectDrive = async () => {
    if (!window.google?.accounts?.oauth2) return false;
    noteEvent('reauth');
    try {
      const gotToken = await new Promise((resolve) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          prompt: '',
          callback: (tokenResponse) => {
            if (tokenResponse.access_token) {
              storeToken(tokenResponse.access_token, tokenResponse.expires_in);
              resolve(true);
            } else {
              resolve(false);
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: '' });
        setTimeout(() => resolve(false), 3000);
      });

      if (gotToken) return true;

      // Silent path genuinely failed — this is the only case that needs a
      // visible prompt, and we deliberately omit `prompt` so Google shows
      // the lightest UI it can (often just an account tap) rather than the
      // full re-consent screen.
      return await new Promise((resolve) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (tokenResponse) => {
            if (tokenResponse.access_token) {
              storeToken(tokenResponse.access_token, tokenResponse.expires_in);
              resolve(true);
            } else {
              resolve(false);
            }
          },
        });
        tokenClient.requestAccessToken();
      });
    } catch (err) {
      console.warn('Drive reconnect attempt failed:', err);
      return false;
    }
  };

  const handleRefreshApp = async () => {
    // Refreshing mid-review discards whatever hasn't been saved to Drive
    // yet. This used to only be flagged as a warning note next to the
    // Record tab's own refresh link — now that refresh is reachable from
    // any tab via the header button, the protection has to live in the
    // action itself so it still applies no matter where it's triggered
    // from.
    const unsaved = [];
    if (isRecording) unsaved.push('the recording in progress');
    if (pendingRecording) unsaved.push('your unsaved recording');
    if (libraryHasUnsaved) unsaved.push('unsaved clip details in the Library');
    if (unsaved.length > 0) {
      const proceed = window.confirm(`Refreshing will discard ${unsaved.join(' and ')}. Continue?`);
      if (!proceed) return;
    }

    if (!accessToken) {
      const reconnected = await reconnectDrive();
      if (reconnected) return;
      // fall through to the full refresh below
    }

    // In standalone (home-screen) mode there's no address bar or browser
    // reload button, so this is the escape hatch when the app misbehaves
    // in other ways. Clear caches first so a stale bundle can't survive it.
    //
    // Only when online, though: these caches are also what lets the app
    // launch offline (see public/sw.js). Clearing them with no connection
    // would delete the only copy of the app, leaving it unable to load
    // until internet returned. Offline, the reload still happens — it just
    // reloads from the cached copy.
    try {
      if (navigator.onLine && window.caches?.keys) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map(k => window.caches.delete(k)));
      }
    } catch (err) {
      console.warn('Cache clear failed:', err);
    }
    window.location.replace(
      window.location.pathname + '?r=' + Date.now() + '&view=' + encodeURIComponent(view)
    );
  };

  // Uploads on-device recordings to Drive. Tapped by the user (banner or a
  // card's Sync button) — never automatic. With no valid sign-in token the
  // tap itself is used to reconnect first, which is also what lets the
  // browser allow Google's sign-in popup.
  const handleSync = async (onlyIds = null, opts = {}) => {
    const silent = opts?.silent === true;   // the automatic retry: never pops a sign-in window, never nags
    if (syncState?.running) return;
    if (!silent) setSyncMessage(null);

    let token = accessToken;
    if (!token) {
      if (silent) return;
      const ok = await reconnectDrive();
      if (!ok) {
        setSyncMessage({ kind: 'warn', text: "Couldn't connect to Google Drive. Your recordings are safe on this device — tap Sync to try again." });
        return;
      }
      try {
        token = JSON.parse(localStorage.getItem('rc_drive_token') || 'null')?.token || null;
      } catch { token = null; }
      if (!token) return;
    }

    setSyncState({ running: true, done: 0, total: 0, currentId: null, currentName: null });
    const result = await syncPendingClips(token, {
      onlyIds,
      onProgress: (p) => setSyncState({ running: true, ...p }),
    });
    setSyncState(null);
    if (result?.failed?.length) {
      noteEvent('uploadFail', result.failed.length);
      for (const f of result.failed.slice(0, 5)) noteProblem('sync', problemCode({ message: f?.reason }));   // status number only, never the clip name
    }
    await refreshPending();
    if (result.alreadyRunning) return;
    if (result.synced > 0) setLibraryRefreshToken(t => t + 1);

    if (result.authExpired) {
      // The stored token is dead — clear it so the next tap reconnects.
      setAccessToken(null);
      try { localStorage.removeItem('rc_drive_token'); } catch { /* ignore */ }
      if (!silent) setSyncMessage({ kind: 'warn', text: 'Your Google sign-in expired. Your recordings are safe on this device — tap Sync again to reconnect and finish.' });
    } else if (result.failed.length > 0) {
      const n = result.failed.length;
      if (!silent) setSyncMessage({ kind: 'warn', text: `${n} recording${n === 1 ? '' : 's'} couldn't be synced yet. ${n === 1 ? 'It is' : 'They are'} still safe on this device — tap Sync to retry.` });
    } else if (result.synced > 0) {
      setSyncMessage({ kind: 'ok', text: result.synced === 1 ? '✅ Synced to Google Drive!' : `✅ All ${result.synced} recordings synced to Google Drive!` });
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  // Removing a recording from the device without uploading it. Confirmed
  // first, because for an un-uploaded recording this is permanent.

  // Automatic retry: while recordings are waiting on the device and Drive is reachable, try to upload them by
  // themselves. First after 20 seconds, then 1, 3, 10 and then every 15 minutes, for as long as it takes. Coming
  // back online or returning to the app starts the schedule again. Nothing here ever opens a sign-in window.
  const handleSyncRef = useRef(null);
  handleSyncRef.current = handleSync;
  const autoTry = useRef(0);
  const [retryTick, setRetryTick] = useState(0);
  useEffect(() => {
    const again = () => { if (document.visibilityState !== 'hidden') { autoTry.current = 0; setRetryTick(t => t + 1); } };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('online', again);
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('online', again); };
  }, []);
  useEffect(() => {
    if (pendingClips.length === 0) { autoTry.current = 0; return undefined; }
    if (!accessToken || !isOnline || syncState?.running) return undefined;
    const DELAYS = (typeof window !== 'undefined' && window.__RC_RETRY_SECS) || [20, 60, 180, 600, 900];   // window.__RC_RETRY_SECS: only for automated tests
    const wait = DELAYS[Math.min(autoTry.current, DELAYS.length - 1)] * 1000;
    const t = setTimeout(() => { autoTry.current += 1; handleSyncRef.current?.(null, { silent: true }); }, wait);
    return () => clearTimeout(t);
  }, [accessToken, isOnline, pendingClips.length, syncState?.running, retryTick]);

  const handleDiscardPending = async (id) => {
    const rec = pendingClips.find(r => r.id === id);
    if (!rec) return;
    const msg = rec.driveAudioId
      ? `Remove the device copy of "${rec.name}"? The audio is already on Google Drive.`
      : `Delete "${rec.name}" from this device?\n\nIt has NOT been uploaded to Google Drive, so this can't be undone.`;
    if (!window.confirm(msg)) return;
    await deletePending(id);
    await refreshPending();
  };

  return (
    <div style={{ padding: '44px 16px 20px', fontFamily: 'sans-serif', maxWidth: '600px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {(
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              style={{
                background: menuOpen ? '#1a73e8' : 'none', border: '1px solid var(--rc-line)',
                borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer',
                color: menuOpen ? 'white' : 'var(--rc-ink2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          <button
            onClick={goBack}
            disabled={viewHistory.length === 0}
            aria-label="Back"
            style={{
              position: 'relative', background: 'none',
              border: `1px solid ${viewHistory.length === 0 ? '#3a3a3a' : 'var(--rc-line)'}`,
              borderRadius: '50%', width: '32px', height: '32px',
              cursor: viewHistory.length === 0 ? 'default' : 'pointer',
              fontSize: '16px', color: viewHistory.length === 0 ? 'var(--rc-ink2)' : 'var(--rc-ink2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}>
            ←
          </button>
        </div>
        <h1 style={{ textAlign: 'center', margin: 0, flex: 1, minWidth: 0, fontSize: '24px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🎸 Riff Catalog</h1>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {/* Always-visible shortcut back to Record, from any section. */}
          {(
            <button
              onClick={() => goToView('record')}
              aria-label="Go to Record"
              title="Record"
              style={{
                background: view === 'record' ? '#cc0000' : 'none', border: '1px solid #cc0000',
                borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer',
                color: view === 'record' ? 'white' : '#cc0000', fontSize: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}>
              ●
            </button>
          )}
          {/* Same full-app-reset handleRefreshApp already used on the Record
              tab — now the only place it lives, reachable from any tab. */}
          <button
            onClick={handleRefreshApp}
            aria-label="Refresh app"
            title={accessToken ? 'Refresh app' : 'Reconnect Drive & refresh'}
            style={{
              background: 'none', border: '1px solid var(--rc-line)',
              borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer',
              color: 'var(--rc-ink2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 40, backgroundColor: 'rgba(0,0,0,0.35)' }} />
            <div role="menu" style={{
              position: 'absolute', top: '40px', left: 0, zIndex: 50, width: '240px', maxWidth: '85vw',
              maxHeight: 'calc(100vh - 90px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-line)', borderRadius: '10px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.3)', padding: '6px 0', textAlign: 'left',
            }}>
              {MENU_ITEMS.map(item => {
                const active = view === item.id;
                return (
                  <button key={item.id} role="menuitem" onClick={() => goToView(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                      padding: '14px 16px', border: 'none', cursor: 'pointer', fontSize: '16px',
                      backgroundColor: active ? 'var(--rc-sel)' : 'transparent',
                      color: active ? '#1a73e8' : 'var(--rc-ink)', fontWeight: active ? '600' : '400',
                      textAlign: 'left',
                    }}>
                    <span style={{ width: '22px', textAlign: 'center', color: item.id === 'record' ? '#cc0000' : undefined }}>{item.icon}</span>
                    {item.label}
                    {item.id === 'dashboard' && isOwner && supportUnread > 0 && (
                      <span aria-label={`${supportUnread} unread support requests`} style={{ marginLeft: 'auto', minWidth: '22px', padding: '1px 7px', borderRadius: '11px', backgroundColor: '#d93025', color: 'white', fontSize: '12px', fontWeight: '700', textAlign: 'center' }}>{supportUnread}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      {(
        <div>
          {user ? (
            <p style={{ color: 'var(--rc-ink2)', textAlign: 'center' }}>
            Signed in as {user.name} &nbsp;·&nbsp;
            <span style={{ color: accessToken ? 'green' : 'orange' }}>
              Drive {accessToken ? '✅' : '⏳'}
            </span>
          </p>
          ) : <SignInBanner onLearnMore={view === 'about' ? undefined : () => goToView('about')} />}

          {user && !accessToken && isOnline && (
            <button
              onClick={async () => { setReconnecting(true); await reconnectDrive(); setReconnecting(false); }}
              disabled={reconnecting}
              style={{
                display: 'block', width: '100%', margin: '0 0 16px', padding: '10px 14px',
                backgroundColor: 'var(--rc-warn2)', border: '1px solid #f0c060', borderRadius: '8px',
                color: 'var(--rc-warn-ink)', fontSize: '13px', cursor: reconnecting ? 'default' : 'pointer',
                textAlign: 'center',
              }}>
              {reconnecting ? '⏳ Reconnecting to Drive…' : '⏳ Drive disconnected — tap to reconnect'}
            </button>
          )}

          {/* Recordings waiting on the device. Shown on every tab, so it's
              visible the moment the connection returns. */}
          {pendingClips.length > 0 && (
            <div style={{
              margin: '0 0 16px', padding: '10px 14px', backgroundColor: 'var(--rc-warn2)',
              border: '1px solid #f0a050', borderRadius: '8px', color: 'var(--rc-warn-ink)',
              fontSize: '13px', textAlign: 'center',
            }}>
              {syncState?.running ? (
                <>🔄 Syncing {Math.min(syncState.done + 1, Math.max(syncState.total, 1))} of {syncState.total || pendingClips.length}…
                  {syncState.currentName && <span style={{ display: 'block', fontSize: '12px', opacity: 0.8 }}>{syncState.currentName}</span>}
                </>
              ) : isOnline ? (
                <>
                  📱 {pendingClips.length} recording{pendingClips.length === 1 ? '' : 's'} saved on this device, not on Drive yet
                  {accessToken && <span style={{ display: 'block', fontSize: '12px', opacity: 0.85 }}>Retrying automatically.</span>}
                  <button onClick={() => handleSync()} style={{
                    display: 'block', margin: '8px auto 0', padding: '6px 18px', backgroundColor: '#e07a10',
                    color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  }}>Sync now</button>
                </>
              ) : (
                <>📴 Offline — {pendingClips.length} recording{pendingClips.length === 1 ? '' : 's'} saved safely on this device. You can sync {pendingClips.length === 1 ? 'it' : 'them'} when you're back online.</>
              )}
            </div>
          )}
          {syncMessage && (
            <div style={{
              margin: '0 0 16px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', textAlign: 'center',
              backgroundColor: syncMessage.kind === 'ok' ? 'var(--rc-ok)' : 'var(--rc-warn2)',
              border: `1px solid ${syncMessage.kind === 'ok' ? '#9fd4ab' : '#f0c060'}`,
              color: syncMessage.kind === 'ok' ? 'var(--rc-ok-ink)' : 'var(--rc-warn-ink)',
            }}>
              {syncMessage.text}
            </div>
          )}

          {/* Which section you're in (the tab bar is now the hamburger menu).
              A section with its own sub-tabs puts them inside its own view. */}
          <div style={{ borderBottom: '1px solid var(--rc-line)', marginBottom: '20px', padding: '6px 0 8px', fontSize: '15px', fontWeight: '600', color: '#1a73e8', textAlign: 'center' }}>
            {(MENU_ITEMS.find(i => i.id === view) || {}).label}
          </div>

          <div style={{ display: view === 'record' ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center' }}>
              {!pendingRecording ? (
                <>
                  <div style={{ position: 'relative' }}>
                    <Recorder onRecordingComplete={handleRecordingComplete} onRecordingStateChange={setIsRecording} />
                    {/* Signed out: the recorder can be seen, but tapping it asks for sign-in first (nothing is recorded). */}
                    {!user && <button aria-label="Sign in to record" onClick={() => setSignInPrompt(true)} style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'transparent', border: 'none', cursor: 'pointer' }} />}
                  </div>
                  {!user && signInPrompt && <SignInGate what="record and save your riffs to your Google Drive" />}
                  {lastUpload && (lastUpload.offline ? (
                    <p style={{ color: '#d97706', marginTop: '16px', textAlign: 'center', maxWidth: '400px' }}>
                      {lastUpload.timedOut ? '⏱' : '📱'} Saved on this device: <strong>{lastUpload.name}</strong>
                      <br />
                      <span style={{ fontSize: '13px' }}>{lastUpload.timedOut ? 'The upload to Google Drive is taking longer than expected. ' : ''}It will upload automatically as soon as it can. You can also tap "Sync now" at the top to try right away.</span>
                    </p>
                  ) : (
                    <p style={{ color: 'green', marginTop: '16px', textAlign: 'center', maxWidth: '400px' }}>
                      ✅ Saved: <strong>{lastUpload.name}</strong>
                      {lastUpload.detailsPending && (
                        <>
                          <br />
                          <span style={{ fontSize: '13px', color: '#d97706' }}>Its key/tempo details will be attached on the next sync.</span>
                        </>
                      )}
                    </p>
                  ))}
                  <p style={{ marginTop: '24px', fontSize: '13px', color: '#888', textAlign: 'center', maxWidth: '400px' }}>
                    🗂 Your recordings are saved to your Google Drive in a folder called <strong>RiffCatalog</strong>. Only you can access them — this app cannot see anything else in your Drive.
                  </p>
                  <p style={{ marginTop: '6px', fontSize: '13px', textAlign: 'center' }}>
                    <button onClick={() => { setAboutRequest(r => ({ tab: 'changelog', n: ((r && r.n) || 0) + 1 })); goToView('about'); }} style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', padding: 0 }}>
                      View changelog
                    </button>
                  </p>
                  <p style={{ marginTop: '4px', fontSize: '11px', color: 'var(--rc-ink2)', textAlign: 'center' }}>
                    Version {CURRENT_VERSION} · Updated {LAST_UPDATED}
                  </p>
                </>
              ) : (
                <div style={{ marginTop: '20px', width: '100%' }}>
                  <p style={{ textAlign: 'center' }}><strong>Recording complete!</strong> Give it a name:</p>

                  {analyzing && <p style={{ color: '#888', fontSize: '14px', textAlign: 'center' }}>🔍 Analyzing audio...</p>}

                  {analysis && (
                    <div style={{ backgroundColor: 'var(--rc-info)', border: '1px solid #b5d4f0', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '14px', marginBottom: '10px', textAlign: 'center' }}>
                        <strong>🥁 BPM:</strong> {analysis.bpm || '—'}{analysis.bpmFromMetronome && <span style={{ color: '#888', fontSize: '12px' }}> (metronome)</span>}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--rc-ink2)', marginBottom: '8px', textAlign: 'center' }}>
                        <strong>🎵 Possible keys</strong> — tap to select:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                        {analysis.candidates.map((c, i) => (
                          <button key={c.key} onClick={() => { setSelectedKey(c.key); setShowOtherKey(false); }}
                            style={candidateBtnStyle(selectedKey === c.key, i === 0)}>
                            {abbreviateKey(c.key)}{c.isRelative ? ' ↔' : ''} <span style={{ opacity: 0.6, fontSize: '11px' }}>{c.confidence}%</span>
                          </button>
                        ))}
                        <button onClick={() => { setShowOtherKey(!showOtherKey); setSelectedKey(null); }}
                          style={{ padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
                            border: showOtherKey ? '2px solid #1a73e8' : '1px dashed #aaa',
                            backgroundColor: showOtherKey ? 'var(--rc-sel)' : 'transparent',
                            color: showOtherKey ? '#1a73e8' : '#888', fontSize: '13px' }}>
                          Other…
                        </button>
                        <button onClick={() => { setSelectedKey(null); setShowOtherKey(false); }}
                          style={{ padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
                            border: '1px dashed #aaa', backgroundColor: 'transparent',
                            color: '#888', fontSize: '13px' }}>
                          None
                        </button>
                      </div>
                      {showOtherKey && (
                        <div style={{ marginTop: '10px' }}>
                          <select style={{ width: '100%', padding: '8px', fontSize: '14px',
                            border: '1px solid #1a73e8', borderRadius: '6px', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)' }}
                            value={selectedKey || ''} onChange={e => setSelectedKey(e.target.value)}>
                            <option value="">— Select a key —</option>
                            {ALL_KEYS.map(k => <option key={k} value={k}>{keyLabel(k)}</option>)}
                          </select>
                        </div>
                      )}
                      {selectedKey && (
                        <>
                          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#1a73e8', textAlign: 'center' }}>
                            Selected: <strong>{keyLabel(selectedKey)}</strong>
                          </p>
                          {/* Notes of the selected key, so the suggestion can be
                              checked against what was actually played. Derived
                              from selectedKey on every render, so picking another
                              candidate (or a key from Other…) updates it. */}
                          <KeyNotes keyName={selectedKey} />
                        </>
                      )}
                    </div>
                  )}

                  {/* Listen to the take before saving or discarding it */}
                  <ReviewPlayer blob={pendingRecording.blob} disabled={uploading} />
                  <ShareButton getBlob={async () => pendingRecording.blob} name={clipName.trim()} disabled={uploading} />

                  {/* Duplicate warning */}
                  {duplicateWarning && (
                    <div style={{ backgroundColor: 'var(--rc-warn)', border: '1px solid #f0c040', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                      <p style={{ fontSize: '13px', color: 'var(--rc-warn-ink)', margin: '0 0 10px' }}>
                        ⚠️ A clip named <strong>"{duplicateWarning.original}"</strong> already exists in your library.
                        Both files would be kept — nothing would be replaced.
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button onClick={() => { setClipName(duplicateWarning.suggested); setDuplicateWarning(null); }}
                          style={{ padding: '6px 14px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          Use "{duplicateWarning.suggested}"
                        </button>
                        <button onClick={() => doUpload(duplicateWarning.original)}
                          style={{ padding: '6px 14px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          Upload anyway
                        </button>
                        <button onClick={() => setDuplicateWarning(null)}
                          style={{ padding: '6px 14px', background: 'none', border: '1px solid var(--rc-line)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--rc-ink2)' }}>
                          Edit name
                        </button>
                      </div>
                    </div>
                  )}

                  <input type="text" value={clipName}
                    onChange={(e) => { setClipName(e.target.value); setDuplicateWarning(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpload()}
                    placeholder="e.g. verse-riff-capo2"
                    style={{ padding: '8px', fontSize: '16px', width: '100%', marginBottom: '12px', boxSizing: 'border-box' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button onClick={handleUpload} disabled={uploading || analyzing}
                      style={{ padding: '10px 20px', backgroundColor: '#1a73e8', color: 'white',
                        border: 'none', borderRadius: '6px', fontSize: '16px', cursor: 'pointer' }}>
                      {uploading ? 'Checking...' : '⬆ Save to Drive'}
                    </button>
                    <button onClick={handleDiscard} disabled={uploading}
                      style={{ padding: '10px 20px', backgroundColor: '#999', color: 'white',
                        border: 'none', borderRadius: '6px', fontSize: '16px', cursor: 'pointer' }}>
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>

          {/* Each tab, once first visited, stays mounted (display toggle
              instead of removal) so switching away and using the back
              button to return preserves everything — scroll position,
              expanded cards, in-progress edits, filters, whatever state
              that tab's own component holds. Not yet visiting a tab this
              session means it's simply not in the tree at all, so it
              still only does its normal first-mount work (data fetches,
              etc.) the first time you actually go there. */}
          {visitedViews.has('library') && (
            <div style={{ display: view === 'library' ? 'block' : 'none' }}>
              {user ? (
                <Library
                  accessToken={accessToken}
                  initialKeyFilter={keyFinderFilter}
                  onFilterConsumed={() => setKeyFinderFilter(null)}
                  refreshToken={libraryRefreshToken}
                  onUnsavedChange={setLibraryHasUnsaved}
                  pendingClips={pendingClips}
                  isOnline={isOnline}
                  syncState={syncState}
                  onSyncPending={handleSync}
                  onDiscardPending={handleDiscardPending}
                />
              ) : <SignInGate what="keep and list your recordings" />}
            </div>
          )}
          {visitedViews.has('keyfinder') && (
            <div style={{ display: view === 'keyfinder' ? 'block' : 'none' }}>
              <KeyFinder onFilterByKey={handleFilterByKey} />
            </div>
          )}
          {visitedViews.has('practice') && (
            <div style={{ display: view === 'practice' ? 'block' : 'none' }}>
              <Practice />
            </div>
          )}
          {/* Jam stays mounted (like every tab), so a running beat keeps playing while you switch sections. */}
          {visitedViews.has('jam') && (
            <div style={{ display: view === 'jam' ? 'block' : 'none' }}>
              <Jam />
            </div>
          )}
          {visitedViews.has('settings') && (
            <div style={{ display: view === 'settings' ? 'block' : 'none' }}>
              <Settings user={user} signedIn={!!accessToken} online={isOnline} pendingCount={pendingClips.length}
                onSync={() => handleSync()} onSignOut={handleLogout} version={CURRENT_VERSION} updated={LAST_UPDATED} />
            </div>
          )}
          {visitedViews.has('about') && (
            <div style={{ display: view === 'about' ? 'block' : 'none' }}>
              <About version={CURRENT_VERSION} accessToken={accessToken} request={aboutRequest} />
            </div>
          )}
          {visitedViews.has('dashboard') && (
            <div style={{ display: view === 'dashboard' ? 'block' : 'none' }}>
              {user ? <Dashboard accessToken={accessToken} isOwner={isOwner} version={CURRENT_VERSION} /> : <SignInGate what="show the numbers kept about your account" />}
            </div>
          )}
          {visitedViews.has('feedback') && (
            <div style={{ display: view === 'feedback' ? 'block' : 'none' }}>
              {user ? <Feedback version={CURRENT_VERSION} accessToken={accessToken} email={user?.email} request={supportRequest} /> : <SignInGate what="send you a message and know who it is from, so we can reply" />}
            </div>
          )}
          {visitedViews.has('randomizer') && (
            <div style={{ display: view === 'randomizer' ? 'block' : 'none' }}>
              <Randomizer accessToken={accessToken} />
            </div>
          )}
        </div>
      )}
      <UpdateBanner />
    </div>
  );
}

export default App;
