import { useState, useEffect } from 'react';
import { subscribe, clearEntries, formatAsText, addEntry } from './DebugLog';
import { uploadTextFile } from './DriveUploader';

const LEVEL_COLORS = {
  error: '#ff6b6b',
  warn:  '#ffc14d',
  info:  '#7fb8ff',
  debug: '#9aa0a6',
  log:   '#d0d0d0',
};

export default function Debug({ accessToken }) {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState('all');
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => subscribe(list => setEntries([...list])), []);

  const shown = filter === 'all'
    ? entries
    : filter === 'errors'
      ? entries.filter(e => e.level === 'error')
      : entries.filter(e => e.level === 'error' || e.level === 'warn');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatAsText());
      setStatus('Copied to clipboard.');
    } catch (err) {
      setStatus('Copy failed: ' + err.message);
    }
    setTimeout(() => setStatus(''), 3000);
  };

  const handleUpload = async () => {
    if (!accessToken) { setStatus('Not signed in to Drive.'); return; }
    setUploading(true);
    setStatus('Uploading…');
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const result = await uploadTextFile(accessToken, `debug-${stamp}.txt`, formatAsText());
      setStatus(`Saved to Drive: RiffCatalog/Debug/${result.name}`);
    } catch (err) {
      setStatus('Upload failed: ' + err.message);
    }
    setUploading(false);
    setTimeout(() => setStatus(''), 6000);
  };

  const handleClear = () => {
    clearEntries();
    addEntry('info', ['Log cleared']);
  };

  const btn = (bg) => ({
    padding: '8px 14px', backgroundColor: bg, color: 'white', border: 'none',
    borderRadius: '6px', fontSize: '13px', cursor: 'pointer', flexShrink: 0,
  });

  return (
    <div style={{ marginTop: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '6px' }}>Debug</h2>
      <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '16px' }}>
        Console output and errors captured from this session.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
        <button onClick={handleUpload} disabled={uploading} style={btn('#1a73e8')}>
          {uploading ? 'Saving…' : '☁ Save to Drive'}
        </button>
        <button onClick={handleCopy} style={btn('#555')}>📋 Copy</button>
        <button onClick={handleClear} style={btn('#cc0000')}>🗑 Clear</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
        {['all', 'warnings', 'errors'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: '5px 12px', fontSize: '12px', borderRadius: '20px', cursor: 'pointer',
              border: filter === f ? '2px solid #1a73e8' : '1px solid #444',
              backgroundColor: filter === f ? '#1a73e8' : 'transparent',
              color: filter === f ? 'white' : '#999',
            }}>
            {f}
          </button>
        ))}
      </div>

      {status && (
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#7fb8ff', marginBottom: '10px' }}>
          {status}
        </p>
      )}

      <div style={{
        backgroundColor: '#111', borderRadius: '8px', padding: '10px',
        maxHeight: '60vh', overflowY: 'auto', border: '1px solid #2a2a2a',
      }}>
        {shown.length === 0 ? (
          <p style={{ color: '#666', fontSize: '13px', textAlign: 'center', margin: '20px 0' }}>
            No entries.
          </p>
        ) : (
          shown.map((e, i) => (
            <div key={i} style={{
              fontFamily: '"Courier New", monospace', fontSize: '11px',
              lineHeight: '1.5', marginBottom: '6px', paddingBottom: '6px',
              borderBottom: '1px solid #1e1e1e', whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', color: LEVEL_COLORS[e.level] || '#d0d0d0',
            }}>
              <span style={{ color: '#666' }}>{e.time.slice(11)} </span>
              <strong>{e.level.toUpperCase()}</strong>{' '}
              {e.text}
            </div>
          ))
        )}
      </div>

      <p style={{ fontSize: '11px', color: '#666', textAlign: 'center', marginTop: '10px' }}>
        {entries.length} total entries • uploads go to RiffCatalog/Debug in your Drive
      </p>
    </div>
  );
}
