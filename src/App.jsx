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

  const handleFilterByKey = (key) => {
    setKeyFinderFilter(key);
    setView('library');
  };
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [showOtherKey, setShowOtherKey] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { original, suggested }
  const driveRequested = useRef(false);

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

  const handleRefreshApp = async () => {
    // Reconnect Drive if needed. Try silently first — most of the time
    // (token merely expired, or Google still recognizes the browser) this
    // succeeds instantly with no UI at all. Only fall back to an
    // interactive prompt if the silent attempt genuinely fails, and even
    // then avoid forcing the full permissions screen — the scope was
    // already granted previously, so a light prompt is usually enough.
    if (!accessToken && window.google?.accounts?.oauth2) {
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

        if (!gotToken) {
          // Silent path genuinely failed — this is the only case that
          // needs a visible prompt, and we deliberately omit `prompt` so
          // Google shows the lightest UI it can (often just an account
          // tap) rather than the full re-consent screen.
          await new Promise((resolve) => {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: CLIENT_ID,
              scope: SCOPES,
              callback: (tokenResponse) => {
                if (tokenResponse.access_token) storeToken(tokenResponse.access_token, tokenResponse.expires_in);
                resolve();
              },
            });
            tokenClient.requestAccessToken();
          });
        }
        return;
      } catch (err) {
        console.warn('Drive reconnect attempt failed:', err);
        // fall through to the full refresh below
      }
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
      <h1 style={{ textAlign: 'center' }}>🎸 Riff Catalog</h1>
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

          <div style={{ borderBottom: '1px solid #ddd', marginBottom: '20px', display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button style={tabStyle(view === 'record')} onClick={() => setView('record')}>Record</button>
            <button style={tabStyle(view === 'library')} onClick={() => setView('library')}>Library</button>
            <button style={tabStyle(view === 'keyfinder')} onClick={() => setView('keyfinder')}>Key Finder</button>
            <button style={tabStyle(view === 'practice')} onClick={() => setView('practice')}>Practice</button>
            <button style={tabStyle(view === 'debug')} onClick={() => setView('debug')}>Debug</button>
          </div>

          {view === 'record' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                    <button onClick={() => setView('changelog')} style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', padding: 0 }}>
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
          )}

          {view === 'library' && <Library accessToken={accessToken} initialKeyFilter={keyFinderFilter} onFilterConsumed={() => setKeyFinderFilter(null)} />}
          {view === 'keyfinder' && <KeyFinder onFilterByKey={handleFilterByKey} />}
          {view === 'practice' && <Practice />}
          {view === 'changelog' && <Changelog />}
          {view === 'debug' && <Debug accessToken={accessToken} />}
        </div>
      )}
    </div>
  );
}

export default App;
