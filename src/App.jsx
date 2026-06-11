import { useState, useEffect, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import Recorder from './components/Recorder';
import { uploadToDrive } from './components/DriveUploader';
import Library from './components/Library';
import { analyzeAudio } from './components/AudioAnalyzer';
import KeyFinder from './components/KeyFinder';
import Practice from './components/Practice';

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
  const [accessToken, setAccessToken] = useState(null);
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
        if (tokenResponse.access_token) setAccessToken(tokenResponse.access_token);
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
        requestDriveAccess();
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
    setUser(null);
    setAccessToken(null);
    driveRequested.current = false;
  };

  const handleRecordingComplete = async (blob, mimeType) => {
    setPendingRecording({ blob, mimeType });
    setClipName('');
    setLastUpload(null);
    setAnalysis(null);
    setSelectedKey(null);
    setShowOtherKey(false);
    setDuplicateWarning(null);
    setAnalyzing(true);
    const result = await analyzeAudio(blob);
    setAnalysis(result);
    if (result?.candidates?.length > 0) setSelectedKey(result.candidates[0].key);
    setAnalyzing(false);
  };

  const handleUpload = async () => {
    if (!clipName.trim()) { alert('Please enter a name for this clip.'); return; }
    setUploading(true);
    setDuplicateWarning(null);

    try {
      const isDupe = await checkDuplicate(accessToken, clipName.trim());
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
    padding: '8px 20px', cursor: 'pointer', border: 'none',
    borderBottom: active ? '2px solid #1a73e8' : '2px solid transparent',
    backgroundColor: 'transparent', fontSize: '16px',
    fontWeight: active ? '600' : '400',
    color: active ? '#1a73e8' : '#555',
  });

  const candidateBtnStyle = (isSelected, isFirst) => ({
    padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px',
    border: isSelected ? '2px solid #1a73e8' : isFirst ? '2px solid #2a6b17' : '1px solid #ccc',
    backgroundColor: isSelected ? '#1a73e8' : 'white',
    color: isSelected ? 'white' : '#333',
    fontWeight: isSelected || isFirst ? '600' : '400',
  });

  return (
    <div style={{ padding: '40px 20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
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

          <div style={{ borderBottom: '1px solid #ddd', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
            <button style={tabStyle(view === 'record')} onClick={() => setView('record')}>Record</button>
            <button style={tabStyle(view === 'library')} onClick={() => setView('library')}>Library</button>
            <button style={tabStyle(view === 'keyfinder')} onClick={() => setView('keyfinder')}>Key Finder</button>
            <button style={tabStyle(view === 'practice')} onClick={() => setView('practice')}>Practice</button>
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
                </div>
              )}
            </div>
          )}

          {view === 'library' && <Library accessToken={accessToken} initialKeyFilter={keyFinderFilter} onFilterConsumed={() => setKeyFinderFilter(null)} />}
          {view === 'keyfinder' && <KeyFinder onFilterByKey={handleFilterByKey} />}
          {view === 'practice' && <Practice />}
        </div>
      )}
    </div>
  );
}

export default App;
