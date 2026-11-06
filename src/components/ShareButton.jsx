import { useState } from 'react';

// Share / Export: hands a recording to the phone's own share sheet (AirDrop, Messages, email, Files, Dropbox, OneDrive...)
// or, where the device has no share sheet, downloads it as a normal audio file.

const EXT_BY_TYPE = [
  [/webm/i, 'webm'], [/mp4|m4a|aac/i, 'm4a'], [/ogg|opus/i, 'ogg'], [/mpeg|mp3/i, 'mp3'], [/wav/i, 'wav'],
];

export function fileNameFor(name, mimeType) {
  const clean = String(name || '').replace(/[\\/:*?"<>|]+/g, '-').trim();
  const base = clean || `riff-${new Date().toISOString().slice(0, 10)}`;
  if (/\.(webm|ogg|m4a|mp4|mp3|wav|aac)$/i.test(base)) return base;
  const hit = EXT_BY_TYPE.find(([re]) => re.test(mimeType || ''));
  return `${base}.${hit ? hit[1] : 'webm'}`;
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Returns 'shared' | 'cancelled' | 'downloaded' | 'needs-tap'
export async function shareFile(file) {
  const canShare = typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] });
  if (!canShare) { downloadFile(file); return 'downloaded'; }
  try {
    await navigator.share({ files: [file], title: file.name });
    return 'shared';
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
    if (e?.name === 'NotAllowedError') return 'needs-tap';
    downloadFile(file);
    return 'downloaded';
  }
}

// getBlob: () => Promise<Blob> (called on tap, so Drive clips are fetched only when asked for)
export default function ShareButton({ getBlob, name, compact = false, disabled = false, label = '📤 Share / Export' }) {
  const [state, setState] = useState('idle'); // idle | busy | ready
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');

  const finish = (r) => {
    if (r === 'needs-tap') { setState('ready'); setMsg('Ready — tap again to share.'); return; }
    setState('idle'); setFile(null);
    setMsg(r === 'downloaded' ? 'Saved to your device’s downloads.' : r === 'shared' ? 'Shared.' : '');
  };

  const onClick = async (e) => {
    e.stopPropagation();
    if (state === 'busy') return;
    setMsg('');
    try {
      let f = file;
      if (!f) {
        setState('busy');
        const blob = await getBlob();
        if (!blob) throw new Error('no audio');
        f = new File([blob], fileNameFor(name, blob.type), { type: (blob.type || 'audio/webm').split(';')[0] });
        setFile(f);
      }
      finish(await shareFile(f));
    } catch (err) {
      setState('idle'); setFile(null);
      setMsg('Couldn’t get that clip. Check your connection and try again.');
    }
  };

  if (compact) {
    return (
      <>
        <button onClick={onClick} disabled={disabled} title="Share / Export"
          aria-label={`Share or export ${name || 'clip'}`}
          style={{ background: 'none', border: '1px solid var(--rc-line)', borderRadius: '6px', width: '32px', height: '32px', boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'var(--rc-ink2)', flexShrink: 0, padding: 0,
            opacity: state === 'busy' ? 0.5 : 1 }}>
          {state === 'busy' ? '…' : state === 'ready' ? '✅' : '📤'}
        </button>
        {msg && <span role="status" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>{msg}</span>}
      </>
    );
  }
  return (
    <div style={{ marginBottom: '12px', textAlign: 'center' }}>
      <button onClick={onClick} disabled={disabled || state === 'busy'}
        style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--rc-line)', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', color: 'var(--rc-ink)' }}>
        {state === 'busy' ? 'Getting it ready…' : state === 'ready' ? '📤 Tap to share' : label}
      </button>
      {msg && <div role="status" style={{ fontSize: '12px', color: 'var(--rc-ink2)', marginTop: '6px' }}>{msg}</div>}
      <div style={{ fontSize: '11px', color: 'var(--rc-ink2)', marginTop: '4px' }}>Send the audio to another app or save it as a file.</div>
    </div>
  );
}
