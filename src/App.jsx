import { useState, useEffect, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import Recorder from './components/Recorder';
import { uploadToDrive } from './components/DriveUploader';
import Library from './components/Library';
import { analyzeAudio } from './components/AudioAnalyzer';
import KeyFinder from './components/KeyFinder';
import Practice from './components/Practice';
import Changelog, { CURRENT_VERSION, LAST_UPDATED } from './components/Changelog';
import Debug from './components/Debug';
import Randomizer from './components/Randomizer';
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
  return key.replace('Major', 'Maj').replace('Minor', 'Min');
}

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
  const [clipName, setClipName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [lastUpload, setLastUpload] = useState(null);
  const [view, setView] = useState('record');
  const [keyFinderFilter, setKeyFinderFilter] = useState(null);

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
  const [visitedViews, setVisitedViews] = useState(() => new Set(['record']));

  const goToView = (newView) => {
    if (newView === view) return;
    setViewHistory(prev => [...prev, view]);
    setVisitedViews(prev => (prev.has(newView) ? prev : new Set(prev).add(newView)));
    setView(newView);
  };

  const goBack = () => {
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
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => {
            const decoded = jwtDecode(response.credential);
            setUser(decoded);
            localStorage.setItem('rc_user', JSON.stringify(decoded));
            requestDriveAccess();
          },
          auto_select: true,
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          { theme: 'outline', size: 'large' }
        );
        window.google.accounts.id.prompt();
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
  };

  const handleRecordingComplete = async (blob, mimeType, capturedPcm = null) => {
    console.log('Recording complete. Blob type:', blob.type, 'size:', blob.size, 'passed mimeType:', mimeType, 'pcm samples:', capturedPcm?.pcm?.length || 0);
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
    }
    console.log('Analysis result:', result);
    setAnalysis(result);
    if (result?.candidates?.length > 0) setSelectedKey(result.candidates[0].key);
    setAnalyzing(false);
  };

  const handleUpload = async () => {
    if (!clipName.trim()) { alert('Please enter a name for this clip.'); return; }
    setUploading(true);
    setDuplicateWarning(null);

    const t0 = performance.now();
    try {
      const isDupe = await checkDuplicate(accessToken, clipName.trim());
      console.log(`[timing] duplicate check: ${Math.round(performance.now() - t0)}ms`);
      if (isDupe) {
        const suggested = await findAvailableName(accessToken, clipName.trim());
        setDuplicateWarning({ original: clipName.trim(), suggested });
        setUploading(false);
        return;
      }
    } catch (err) {
      console.error('Duplicate check failed:', err);
    }

    await doUpload(clipName.trim());
  };

  const doUpload = async (name) => {
    setUploading(true);
    setDuplicateWarning(null);
    const t0 = performance.now();
    try {
      const initialMetadata = {
        dateRecorded: new Date().toISOString(),
        key: selectedKey || '',
        bpm: analysis?.bpm?.toString() || '',
        candidates: analysis?.candidates || [],
      };
      const result = await uploadToDrive(
        accessToken, pendingRecording.blob, name,
        pendingRecording.mimeType, initialMetadata
      );
      console.log(`[timing] uploadToDrive total: ${Math.round(performance.now() - t0)}ms`);
      setLastUpload(result);
      setPendingRecording(null);
      setClipName('');
      setAnalysis(null);
      setSelectedKey(null);
      setShowOtherKey(false);
    } catch (err) {
      alert('Upload failed. Please try again.');
      console.error(err);
    }
    setUploading(false);
  };

  const handleDiscard = () => {
    setPendingRecording(null);
    setClipName('');
    setAnalysis(null);
    setSelectedKey(null);
    setShowOtherKey(false);
    setDuplicateWarning(null);
  };

  const tabStyle = (active) => ({
    padding: '8px 12px', cursor: 'pointer', border: 'none',
    borderBottom: active ? '2px solid #1a73e8' : '2px solid transparent',
    backgroundColor: 'transparent', fontSize: '14px',
    fontWeight: active ? '600' : '400',
    color: active ? '#1a73e8' : '#555',
    whiteSpace: 'nowrap',
  });

  const candidateBtnStyle = (isSelected, isFirst) => ({
    padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px',
    border: isSelected ? '2px solid #1a73e8' : isFirst ? '2px solid #2a6b17' : '1px solid #ccc',
    backgroundColor: isSelected ? '#1a73e8' : 'white',
    color: isSelected ? 'white' : '#333',
    fontWeight: isSelected || isFirst ? '600' : '400',
  });

  // Tries silent reconnect first (no UI); if that genuinely fails, falls
  // back to the lightest interactive prompt Google will show. Returns true
  // if a token was obtained. Used by both the global banner (one tap) and
  // the Record-tab refresh link.
  const reconnectDrive = async () => {
    if (!window.google?.accounts?.oauth2) return false;
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
    if (!accessToken) {
      const reconnected = await reconnectDrive();
      if (reconnected) return;
      // fall through to the full refresh below
    }

    // In standalone (home-screen) mode there's no address bar or browser
    // reload button, so this is the escape hatch when the app misbehaves
    // in other ways. Clear caches first so a stale bundle can't survive it.
    try {
      if (window.caches?.keys) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map(k => window.caches.delete(k)));
      }
    } catch (err) {
      console.warn('Cache clear failed:', err);
    }
    window.location.replace(window.location.pathname + '?r=' + Date.now());
  };

  const RefreshLink = () => (
    <button
      onClick={handleRefreshApp}
      style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', padding: 0 }}>
      {accessToken ? '🔄 Refresh app' : '🔄 Reconnect Drive & refresh'}
    </button>
  );

  return (
    <div style={{ padding: '20px 16px', fontFamily: 'sans-serif', maxWidth: '600px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: '16px' }}>
        <button
          onClick={goBack}
          disabled={viewHistory.length === 0}
          aria-label="Back"
          style={{
            position: 'absolute', left: 0, background: 'none',
            border: `1px solid ${viewHistory.length === 0 ? '#3a3a3a' : '#ccc'}`,
            borderRadius: '50%', width: '32px', height: '32px',
            cursor: viewHistory.length === 0 ? 'default' : 'pointer',
            fontSize: '16px', color: viewHistory.length === 0 ? '#555' : '#444',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}>
          ←
        </button>
        <h1 style={{ textAlign: 'center', margin: 0 }}>🎸 Riff Catalog</h1>
        {/* Same full-app-reset handleRefreshApp already used on the Record
            tab (RefreshLink) — this just makes it reachable from any tab
            instead of only there. */}
        <button
          onClick={handleRefreshApp}
          aria-label="Refresh app"
          title={accessToken ? 'Refresh app' : 'Reconnect Drive & refresh'}
          style={{
            position: 'absolute', right: 0, background: 'none', border: '1px solid #ccc',
            borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer',
            fontSize: '16px', color: '#444',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}>
          🔄
        </button>
      </div>
      {!user ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
          <div id="google-signin-btn"></div>
        </div>
      ) : (
        <div>
          <p style={{ color: '#555', textAlign: 'center' }}>
            Signed in as {user.name} &nbsp;·&nbsp;
            <span style={{ color: accessToken ? 'green' : 'orange' }}>
              Drive {accessToken ? '✅' : '⏳'}
            </span>
            &nbsp;·&nbsp;
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px' }}>Sign out</button>
          </p>

          {!accessToken && (
            <button
              onClick={async () => { setReconnecting(true); await reconnectDrive(); setReconnecting(false); }}
              disabled={reconnecting}
              style={{
                display: 'block', width: '100%', margin: '0 0 16px', padding: '10px 14px',
                backgroundColor: '#fff4e0', border: '1px solid #f0c060', borderRadius: '8px',
                color: '#7a5000', fontSize: '13px', cursor: reconnecting ? 'default' : 'pointer',
                textAlign: 'center',
              }}>
              {reconnecting ? '⏳ Reconnecting to Drive…' : '⏳ Drive disconnected — tap to reconnect'}
            </button>
          )}

          <div style={{ borderBottom: '1px solid #ddd', marginBottom: '20px', display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button style={tabStyle(view === 'record')} onClick={() => goToView('record')}>Record</button>
            <button style={tabStyle(view === 'library')} onClick={() => goToView('library')}>Library</button>
            <button style={tabStyle(view === 'keyfinder')} onClick={() => goToView('keyfinder')}>Key Finder</button>
            <button style={tabStyle(view === 'practice')} onClick={() => goToView('practice')}>Practice</button>
            <button style={tabStyle(view === 'randomizer')} onClick={() => goToView('randomizer')}>Randomizer</button>
            <button style={tabStyle(view === 'debug')} onClick={() => goToView('debug')}>Debug</button>
          </div>

          <div style={{ display: view === 'record' ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center' }}>
              {!pendingRecording ? (
                <>
                  <Recorder onRecordingComplete={handleRecordingComplete} />
                  {lastUpload && (
                    <p style={{ color: 'green', marginTop: '16px' }}>
                      ✅ Saved: <strong>{lastUpload.name}</strong>
                    </p>
                  )}
                  <p style={{ marginTop: '24px', fontSize: '13px', color: '#888', textAlign: 'center', maxWidth: '400px' }}>
                    🗂 Your recordings are saved to your Google Drive in a folder called <strong>RiffCatalog</strong>. Only you can access them — this app cannot see anything else in your Drive.
                  </p>
                  <p style={{ marginTop: '12px', fontSize: '13px', textAlign: 'center' }}>
                    <RefreshLink />
                  </p>
                  <p style={{ marginTop: '6px', fontSize: '13px', textAlign: 'center' }}>
                    <button onClick={() => goToView('changelog')} style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', padding: 0 }}>
                      View changelog
                    </button>
                  </p>
                  <p style={{ marginTop: '4px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
                    Version {CURRENT_VERSION} · Updated {LAST_UPDATED}
                  </p>
                </>
              ) : (
                <div style={{ marginTop: '20px', width: '100%' }}>
                  <p style={{ textAlign: 'center' }}><strong>Recording complete!</strong> Give it a name:</p>

                  {analyzing && <p style={{ color: '#888', fontSize: '14px', textAlign: 'center' }}>🔍 Analyzing audio...</p>}

                  {analysis && (
                    <div style={{ backgroundColor: '#f0f7ff', border: '1px solid #b5d4f0', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '14px', marginBottom: '10px', textAlign: 'center' }}>
                        <strong>🥁 BPM:</strong> {analysis.bpm || '—'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#555', marginBottom: '8px', textAlign: 'center' }}>
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
                            backgroundColor: showOtherKey ? '#e8f0fe' : 'transparent',
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
                            border: '1px solid #1a73e8', borderRadius: '6px', backgroundColor: '#fff', color: '#222' }}
                            value={selectedKey || ''} onChange={e => setSelectedKey(e.target.value)}>
                            <option value="">— Select a key —</option>
                            {ALL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </div>
                      )}
                      {selectedKey && (
                        <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#1a73e8', textAlign: 'center' }}>
                          Selected: <strong>{selectedKey}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Duplicate warning */}
                  {duplicateWarning && (
                    <div style={{ backgroundColor: '#fff8e1', border: '1px solid #f0c040', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                      <p style={{ fontSize: '13px', color: '#7a5000', margin: '0 0 10px' }}>
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
                          style={{ padding: '6px 14px', background: 'none', border: '1px solid #ccc', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#555' }}>
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
                  <p style={{ marginTop: '16px', fontSize: '13px', textAlign: 'center' }}>
                    <RefreshLink />
                  </p>
                  <p style={{ marginTop: '4px', fontSize: '11px', color: '#999', textAlign: 'center' }}>
                    Refreshing discards this unsaved recording.
                  </p>
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
              <Library accessToken={accessToken} initialKeyFilter={keyFinderFilter} onFilterConsumed={() => setKeyFinderFilter(null)} />
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
          {visitedViews.has('changelog') && (
            <div style={{ display: view === 'changelog' ? 'block' : 'none' }}>
              <Changelog />
            </div>
          )}
          {visitedViews.has('debug') && (
            <div style={{ display: view === 'debug' ? 'block' : 'none' }}>
              <Debug accessToken={accessToken} />
            </div>
          )}
          {visitedViews.has('randomizer') && (
            <div style={{ display: view === 'randomizer' ? 'block' : 'none' }}>
              <Randomizer accessToken={accessToken} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
