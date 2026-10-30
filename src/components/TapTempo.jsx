import { useRef, useState } from 'react';

// Works out a tempo from a series of taps. Keeps the last few intervals and
// averages them; a pause of more than 2 seconds starts a fresh count.
const RESET_AFTER_MS = 2000;
const KEEP_INTERVALS = 6;

export function createTapTempo() {
  let times = [];
  return {
    // Register a tap at `now` (ms). Returns { bpm, taps } — bpm is null until the 2nd tap.
    tap(now = performance.now()) {
      if (times.length && now - times[times.length - 1] > RESET_AFTER_MS) times = [];
      times.push(now);
      if (times.length > KEEP_INTERVALS + 1) times.shift();
      if (times.length < 2) return { bpm: null, taps: times.length };
      const avg = (times[times.length - 1] - times[0]) / (times.length - 1);
      return { bpm: 60000 / avg, taps: times.length };
    },
    reset() { times = []; },
  };
}

// A "Tap" button. Tap along with the music; from the 2nd tap on, onBpm(rounded bpm)
// is called with the running estimate. Reacts on touch-down so it feels instant.
export function TapTempoButton({ onBpm, min = 40, max = 300, style }) {
  const tapper = useRef(null);
  const [taps, setTaps] = useState(0);
  const clear = useRef(null);
  if (!tapper.current) tapper.current = createTapTempo();

  const press = (e) => {
    e.preventDefault();
    const { bpm, taps: n } = tapper.current.tap();
    setTaps(n);
    clearTimeout(clear.current);
    clear.current = setTimeout(() => setTaps(0), RESET_AFTER_MS);
    if (bpm) onBpm(Math.min(max, Math.max(min, Math.round(bpm))));
  };

  return (
    <button type="button" onPointerDown={press} onContextMenu={e => e.preventDefault()} aria-label="Tap tempo"
      style={{
        padding: '8px 16px', fontSize: '14px', fontWeight: '700', borderRadius: '8px', cursor: 'pointer',
        border: '1px solid #1a73e8', backgroundColor: taps ? 'var(--rc-sel)' : 'var(--rc-surface)', color: '#1a73e8',
        touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
        ...style,
      }}>
      {taps ? `Tap (${taps})` : 'Tap tempo'}
    </button>
  );
}
