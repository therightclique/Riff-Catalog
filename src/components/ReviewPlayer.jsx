import { useEffect, useRef, useState } from 'react';
import { applySpeakerToElement } from './AudioDevices';

// Lets you listen to a take on the "Recording complete" screen before deciding to save or discard it.
// Uses the browser's own player (play/pause and a seek bar), so it behaves like every other audio player on the device.

// Chrome records WebM without a length, which breaks the seek bar. Jumping to the end once makes it work out the real length.
function fixLength(e) {
  const a = e.currentTarget;
  if (a.duration !== Infinity) return;
  const done = () => { a.removeEventListener('timeupdate', done); a.currentTime = 0; };
  a.addEventListener('timeupdate', done);
  a.currentTime = 1e101;
}

export default function ReviewPlayer({ blob, disabled }) {
  const [url, setUrl] = useState(null);
  const audioRef = useRef(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return undefined; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  useEffect(() => { applySpeakerToElement(audioRef.current); }, [url]);
  if (!url) return null;
  return (
    <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--rc-line)', backgroundColor: 'var(--rc-surface)' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--rc-ink)', marginBottom: '6px', textAlign: 'center' }}>🎧 Listen before you save</div>
      <audio ref={audioRef} controls preload="metadata" src={url} onLoadedMetadata={fixLength} style={{ width: '100%', opacity: disabled ? 0.6 : 1 }}>
        Your browser can&rsquo;t play this recording here.
      </audio>
    </div>
  );
}
