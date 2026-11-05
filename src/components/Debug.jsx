import { useState, useEffect } from 'react';
import { subscribe, clearEntries, formatAsText, addEntry, localFileStamp } from './DebugLog';
import { uploadTextFile } from './DriveUploader';
import { sendDiagnostic, recentProblems } from './UsageLog';

const LEVEL_COLORS = {
  error: '#ff6b6b',
  warn:  '#ffc14d',
  info:  '#7fb8ff',
  debug: '#9aa0a6',
  log:   '#d0d0d0',
};

export default function Debug({ accessToken, version }) {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState('all');
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [problems, setProblems] = useState(() => recentProblems());
  const [diagNote, setDiagNote] = useState('');
  const [diag, setDiag] = useState({ kind: 'idle', msg: '' });   // idle | sending | sent | error

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
      const result = await uploadTextFile(accessToken, `debug-${localFileStamp()}.txt`, formatAsText());
      setStatus(`Saved to Drive: RiffCatalog/Debug/${result.name}`);
    } catch (err) {
      setStatus('Upload failed: ' + err.message);
    }
    setUploading(false);
    setTimeout(() => setStatus(''), 6000);
  };

  const handleDiagnostic = async () => {
    if (diag.kind === 'sending') return;
    if (!accessToken) { setDiag({ kind: 'error', msg: 'Connect to Google Drive first, then try again.' }); return; }
    if (navigator.onLine === false) { setDiag({ kind: 'error', msg: 'You appear to be offline. Try again when you\u2019re connected.' }); return; }
    setDiag({ kind: 'sending', msg: '' });
    try {
      const ok = await sendDiagnostic(accessToken, version, diagNote);
      if (ok) { setDiag({ kind: 'sent', msg: 'Report sent. Thank you!' }); setDiagNote(''); }
      else setDiag({ kind: 'error', msg: 'Couldn\u2019t send the report right now. Please try again.' });
    } catch { setDiag({ kind: 'error', msg: 'Couldn\u2019t send the report right now. Please try again.' }); }
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
      <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '16px' }}>
        Console output and errors captured from this session.
      </p>

      <div style={{ backgroundColor: 'var(--rc-card)', border: '1px solid var(--rc-line)', borderRadius: '12px', padding: '14px', margin: '0 0 16px', color: 'var(--rc-ink)', textAlign: 'left' }}>
        <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>Send diagnostic report</div>
        <p style={{ fontSize: '13px', lineHeight: 1.5, margin: '0 0 10px', color: 'var(--rc-ink2)' }}>
          If something isn't working, you can send the app's maker a short report. It contains your app version, device, system, browser and screen size, whether you're online, how many recordings are waiting on this device, and the list of recent problem codes below (like "upload Error 401"). It never includes the console text underneath, your recordings, clip names, lyrics or anything you've written. It is only sent when you press the button.
        </p>
        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Recent problems on this device ({problems.length})</div>
        <div style={{ fontFamily: '"Courier New", monospace', fontSize: '11px', lineHeight: 1.5, maxHeight: '110px', overflowY: 'auto', backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-line)', borderRadius: '8px', padding: '6px 8px', marginBottom: '10px', color: 'var(--rc-ink)' }}>
          {problems.length === 0 ? <span style={{ color: 'var(--rc-ink2)' }}>None. Nothing has gone wrong lately.</span>
            : problems.slice().reverse().map((p, i) => (
              <div key={i}>{new Date(p.t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {p.area} · {p.code}{p.view ? ` · ${p.view}` : ''}{p.n > 1 ? ` ×${p.n}` : ''}</div>
            ))}
        </div>
        <label htmlFor="rc-diag-note" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>What happened? (optional, a sentence or two)</label>
        <textarea id="rc-diag-note" value={diagNote} onChange={e => setDiagNote(e.target.value.slice(0, 500))} rows={2} maxLength={500} disabled={diag.kind === 'sending'}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '16px', fontFamily: 'inherit', borderRadius: '8px', border: '1px solid var(--rc-line)', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)', resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
          <button onClick={handleDiagnostic} disabled={diag.kind === 'sending'}
            style={{ padding: '10px 16px', fontSize: '14px', fontWeight: '600', borderRadius: '8px', border: 'none', cursor: diag.kind === 'sending' ? 'default' : 'pointer', backgroundColor: '#1a73e8', color: 'white' }}>
            {diag.kind === 'sending' ? 'Sending\u2026' : 'Send report'}
          </button>
          <button onClick={() => setProblems(recentProblems())}
            style={{ padding: '10px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid var(--rc-line)', cursor: 'pointer', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)' }}>
            Refresh list
          </button>
        </div>
        <div role="status" aria-live="polite" style={{ marginTop: '8px', fontSize: '13px', fontWeight: '600', minHeight: '18px', color: diag.kind === 'error' ? '#d93025' : '#1e8e3e' }}>{diag.msg}</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
        <button onClick={handleUpload} disabled={uploading} style={btn('#1a73e8')}>
          {uploading ? 'Saving…' : '☁ Save to Drive'}
        </button>
        <button onClick={handleCopy} style={btn('#555')}>📋 Copy</button>
        <button onClick={handleClear} style={btn('#cc0000')}>🗑 Clear</button>
        <button
          onClick={async () => {
            try {
              if (window.caches?.keys) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(k => window.caches.delete(k)));
              }
            } catch (err) {
              console.warn('Cache clear failed:', err);
            }
            window.location.replace(window.location.pathname + '?r=' + Date.now());
          }}
          style={btn('#444')}>
          ↻ Refresh app
        </button>
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
          <p style={{ color: 'var(--rc-ink2)', fontSize: '13px', textAlign: 'center', margin: '20px 0' }}>
            No entries.
          </p>
        ) : (
          (() => {
            let lastDate = null;
            return shown.map((e, i) => {
              // e.time is "YYYY-MM-DD HH:MM:SS.mmm"
              const date = e.time.slice(0, 10);
              const time = e.time.slice(11);
              const showDivider = date !== lastDate;
              lastDate = date;
              return (
                <div key={i}>
                  {showDivider && (
                    <div style={{
                      fontFamily: '"Courier New", monospace', fontSize: '11px',
                      color: '#888', fontWeight: 'bold', margin: i === 0 ? '0 0 8px' : '14px 0 8px',
                      paddingBottom: '4px', borderBottom: '1px solid #333',
                    }}>
                      {date}
                    </div>
                  )}
                  <div style={{
                    fontFamily: '"Courier New", monospace', fontSize: '11px',
                    lineHeight: '1.5', marginBottom: '6px', paddingBottom: '6px',
                    borderBottom: '1px solid #1e1e1e', whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word', color: LEVEL_COLORS[e.level] || '#d0d0d0',
                  }}>
                    <span style={{ color: 'var(--rc-ink2)' }}>{time} </span>
                    <strong>{e.level.toUpperCase()}</strong>{' '}
                    {e.text}
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>

      <p style={{ fontSize: '11px', color: 'var(--rc-ink2)', textAlign: 'center', marginTop: '10px' }}>
        {entries.length} entries, saved across app sessions • tap Clear to reset • uploads go to RiffCatalog/Debug in your Drive
      </p>
    </div>
  );
}
