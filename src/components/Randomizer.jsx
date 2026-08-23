import { useState, useEffect, useRef } from 'react';
import { uploadTextFile, listTextFiles, readTextFile } from './DriveUploader';

// ── Shuffle helpers ──────────────────────────────────────────────────────

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shuffleNoAdjacentDupes(arr, maxAttempts = 200) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const copy = shuffle(arr);
    let ok = true;
    for (let i = 1; i < copy.length; i++) {
      if (copy[i] === copy[i - 1]) { ok = false; break; }
    }
    if (ok) return copy;
  }
  return arr;
}

// ── Category data (computed once at module load, stable for the session) ─

const OTHER_TIME_SIGS = ['3/4', '2/4', '6/8', '5/4', '7/8', '9/8', '11/8', '12/8', '5/8'];
const TIME_SIGNATURE_OPTIONS = OTHER_TIME_SIGS.flatMap(sig => ['4/4', sig]);

const MAJOR_MINOR_OPTIONS = Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? 'Major' : 'Minor'));

const CHORD_DEGREE_OPTIONS = shuffleNoAdjacentDupes(['1', '2', '3', '4', '5', '6', '7', '1', '2', '3', '4', '5', '6', '7']);

const TEMPO_OPTIONS = shuffle(['60', '70', '80', '90', '100', '110', '120', '130', '140', '150', '160', '170', '180', '190', '200']);

const CATEGORIES = [
  { id: 'key', label: 'Musical Key', options: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'] },
  { id: 'majorMinor', label: 'Major / Minor', options: MAJOR_MINOR_OPTIONS },
  {
    id: 'style', label: 'Style / Genre',
    options: ['Alternative', 'Ambient', 'Bluegrass', 'Blues', 'Classical', 'Country', 'Electronic', 'Folk', 'Funk', 'Gospel', 'Hip-Hop', 'Indie', 'Jazz', 'Metal', 'Pop', 'Punk', 'R&B / Soul', 'Reggae', 'Rock', 'Singer-Songwriter', 'World'],
  },
  {
    id: 'theme', label: 'Theme',
    options: ['Food', 'Horror', 'Sci-Fi', 'Politics/Government', 'Monsters', 'Society', 'Dating', 'Domestic Life', 'Animals', 'Money', 'Love/Romance', 'Cosmos', 'Cars', 'Trippy', 'Nature', 'Travel', 'Work', 'Nostalgia', 'Technology', 'Rebellion'],
  },
  {
    id: 'mood', label: 'Mood',
    options: ['Aggressive', 'Chill', 'Dark', 'Dreamy', 'Energetic', 'Happy', 'Hopeful', 'Melancholy', 'Mysterious', 'Nostalgic', 'Peaceful', 'Romantic', 'Sad', 'Tense', 'Uplifting'],
  },
  { id: 'timeSignature', label: 'Time Signature', options: TIME_SIGNATURE_OPTIONS },
  { id: 'chordDegree', label: 'Chord Progression (scale degree)', options: CHORD_DEGREE_OPTIONS },
  { id: 'tempo', label: 'Tempo (BPM)', options: TEMPO_OPTIONS, suffix: ' BPM' },
];

const SPIN_DURATION_MS = 5000;
const SNAP_DURATION_MS = 300;

// ── Momentum tuning ──────────────────────────────────────────────────────
// Velocity is tracked in degrees/millisecond throughout.
const FLICK_VELOCITY_THRESHOLD = 0.15; // release speed above this counts as a flick, not just a slow drag-release
const MOMENTUM_MIN_VELOCITY = 0.02;    // below this, momentum has decayed enough to stop and snap
const MOMENTUM_DECAY_PER_MS = 0.997;   // exponential decay factor — tuned so a hard flick coasts for roughly 1-2 seconds
const VELOCITY_SAMPLE_WINDOW_MS = 100; // how far back to look when estimating release velocity, so a single noisy last-frame sample doesn't dominate

// ── Geometry helpers ────────────────────────────────────────────────────

function pointAt(deg, r, cx, cy) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function angleFromPointer(dx, dy) {
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function shortestDelta(a, b) {
  return (((b - a + 540) % 360) + 360) % 360 - 180;
}

function sliceColor(i, n) {
  const hue = Math.round((360 / n) * i);
  return `hsl(${hue}, 62%, 46%)`;
}

function nearestSliceIndex(rotation, n) {
  const step = 360 / n;
  const currentMod = ((rotation % 360) + 360) % 360;
  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < n; i++) {
    const visualPos = (i * step + step / 2 + currentMod) % 360;
    const dist = Math.min(visualPos, 360 - visualPos);
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  return bestIdx;
}

// ── Wheel ────────────────────────────────────────────────────────────────

function Wheel({ options, rotation, animating, transitionMs, onPointerDownWheel }) {
  const size = 300;
  const cx = size / 2, cy = size / 2, r = size / 2 - 6;
  const n = options.length;
  const step = 360 / n;
  const fontSize = n > 18 ? 8 : n > 14 ? 9 : n > 10 ? 10 : n > 6 ? 12 : 14;

  return (
    <div
      style={{ position: 'relative', width: size, maxWidth: '90vw', margin: '0 auto', touchAction: 'none', cursor: 'grab' }}
      onPointerDown={onPointerDownWheel}
    >
      <div style={{
        position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0, zIndex: 2, pointerEvents: 'none',
        borderLeft: '12px solid transparent', borderRight: '12px solid transparent',
        borderTop: '18px solid #fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
      }} />
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{
          width: '100%', height: 'auto', display: 'block', borderRadius: '50%',
          transform: `rotate(${rotation}deg)`,
          transformOrigin: '50% 50%',
          transition: animating ? `transform ${transitionMs}ms cubic-bezier(0.12, 0.67, 0.1, 1)` : 'none',
          boxShadow: '0 0 0 6px #1e1e1e, 0 4px 16px rgba(0,0,0,0.5)',
          userSelect: 'none',
        }}>
        {options.map((opt, i) => {
          const a1 = i * step, a2 = (i + 1) * step;
          const p1 = pointAt(a1, r, cx, cy);
          const p2 = pointAt(a2, r, cx, cy);
          const largeArc = step > 180 ? 1 : 0;
          const mid = a1 + step / 2;
          const labelPos = pointAt(mid, r * 0.66, cx, cy);
          return (
            <g key={i}>
              <path
                d={`M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`}
                fill={sliceColor(i, n)}
                stroke="#111"
                strokeWidth="1"
              />
              <text
                x={labelPos.x} y={labelPos.y}
                fill="white"
                fontSize={fontSize}
                fontWeight="600"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${mid - 90} ${labelPos.x} ${labelPos.y})`}
                style={{ pointerEvents: 'none' }}>
                {opt}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={size * 0.09} fill="#1a73e8" stroke="#111" strokeWidth="3" />
      </svg>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export default function Randomizer({ accessToken }) {
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [momentumActive, setMomentumActive] = useState(false);
  const [result, setResult] = useState(null);
  // Persisted so the accumulating idea survives switching tabs (this
  // component fully unmounts then) and even closing/reopening the app —
  // it only clears when the user hits Clear.
  const [accumulated, setAccumulated] = useState(() => {
    try {
      return localStorage.getItem('rc_randomizer_idea') || '';
    } catch {
      return '';
    }
  });
  const [setName, setSetName] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSets, setSavedSets] = useState(null);
  const [loadingList, setLoadingList] = useState(false);

  const spinTimeout = useRef(null);
  const snapTimeout = useRef(null);
  const dragState = useRef(null);
  const momentumRafRef = useRef(null);
  const velocityHistoryRef = useRef([]);

  useEffect(() => {
    // Stop any in-flight momentum animation if this component unmounts
    // mid-coast — matters more now that tabs stay mounted in the
    // background rather than unmounting on switch, but a stray rAF loop
    // updating state after unmount is worth guarding against regardless.
    return () => {
      if (momentumRafRef.current) cancelAnimationFrame(momentumRafRef.current);
    };
  }, []);

  const category = CATEGORIES.find(c => c.id === categoryId);

  useEffect(() => {
    try {
      localStorage.setItem('rc_randomizer_idea', accumulated);
    } catch {
      // storage full/unavailable — the idea still works for this session,
      // it just won't survive a reload
    }
  }, [accumulated]);

  const clearPendingTimers = () => {
    clearTimeout(spinTimeout.current);
    clearTimeout(snapTimeout.current);
  };

  const handleCategoryChange = (id) => {
    clearPendingTimers();
    stopMomentum();
    setSpinning(false);
    setDragging(false);
    setSnapping(false);
    setMomentumActive(false);
    setCategoryId(id);
    setResult(null);
    setRotation(0);
  };

  const handleSpin = () => {
    if (spinning || dragging || snapping || momentumActive) return;
    const options = category.options;
    const idx = Math.floor(Math.random() * options.length);
    const step = 360 / options.length;
    const sliceCenter = idx * step + step / 2;
    const baseTarget = (360 - sliceCenter) % 360;
    const jitter = (Math.random() - 0.5) * step * 0.7;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const currentMod = ((rotation % 360) + 360) % 360;
    const delta = ((baseTarget + jitter - currentMod) % 360 + 360) % 360;
    const newRotation = rotation + extraSpins * 360 + delta;

    setResult(null);
    setSpinning(true);
    setRotation(newRotation);

    clearPendingTimers();
    spinTimeout.current = setTimeout(() => {
      setSpinning(false);
      setResult(options[idx]);
    }, SPIN_DURATION_MS);
  };

  // ── Manual drag-to-select, with momentum ────────────────────────────

  // Computes the snapped rotation for a given rotation value, starts the
  // snap-settle animation timer, and returns the new rotation — doesn't
  // set rotation state itself, so callers use it inside a setRotation
  // functional updater to always work off the true latest value rather
  // than a value captured in a stale closure (rotation changes rapidly,
  // many times a frame, during both dragging and momentum coasting).
  const beginSnap = (currentRotation) => {
    const n = category.options.length;
    const idx = nearestSliceIndex(currentRotation, n);
    const step = 360 / n;
    const sliceCenter = idx * step + step / 2;
    const targetMod = (360 - sliceCenter) % 360;
    const currentMod = ((currentRotation % 360) + 360) % 360;
    const snapDelta = shortestDelta(currentMod, targetMod);
    const newRotation = currentRotation + snapDelta;

    setSnapping(true);
    clearTimeout(snapTimeout.current);
    snapTimeout.current = setTimeout(() => {
      setSnapping(false);
      setResult(category.options[idx]);
    }, SNAP_DURATION_MS);

    return newRotation;
  };

  const stopMomentum = () => {
    if (momentumRafRef.current) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
    setMomentumActive(false);
  };

  // Coasts the wheel at the given release velocity (deg/ms), decaying it
  // toward zero each frame like real rotational friction, then hands off
  // to the same snap-to-nearest-slice logic a slow drag-release uses.
  const startMomentumSpin = (initialVelocity) => {
    stopMomentum();
    setMomentumActive(true);
    let velocity = initialVelocity;
    let lastTime = performance.now();

    const step = (now) => {
      const dt = now - lastTime;
      lastTime = now;

      setRotation(prev => prev + velocity * dt);
      velocity *= Math.pow(MOMENTUM_DECAY_PER_MS, dt);

      if (Math.abs(velocity) < MOMENTUM_MIN_VELOCITY) {
        momentumRafRef.current = null;
        setMomentumActive(false);
        setRotation(currentRotation => beginSnap(currentRotation));
        return;
      }
      momentumRafRef.current = requestAnimationFrame(step);
    };
    momentumRafRef.current = requestAnimationFrame(step);
  };

  const handlePointerMoveWheel = (e) => {
    if (!dragState.current) return;
    const { cx, cy, lastAngle } = dragState.current;
    const angle = angleFromPointer(e.clientX - cx, e.clientY - cy);
    const delta = shortestDelta(lastAngle, angle);
    dragState.current.lastAngle = angle;
    setRotation(prev => prev + delta);

    // Record recent {delta, time} samples so release velocity can be
    // estimated from a short window of real movement rather than just
    // the single last (often noisy) pointermove event.
    const now = performance.now();
    const history = velocityHistoryRef.current;
    history.push({ delta, t: now });
    const cutoff = now - VELOCITY_SAMPLE_WINDOW_MS;
    while (history.length > 1 && history[0].t < cutoff) history.shift();
  };

  const handlePointerUpWheel = (e) => {
    const container = e.currentTarget;
    container.removeEventListener('pointermove', handlePointerMoveWheel);
    container.removeEventListener('pointerup', handlePointerUpWheel);
    container.removeEventListener('pointercancel', handlePointerUpWheel);
    dragState.current = null;
    setDragging(false);

    const history = velocityHistoryRef.current;
    let releaseVelocity = 0;
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const totalDelta = history.reduce((sum, h) => sum + h.delta, 0);
      const dt = last.t - first.t;
      if (dt > 0) releaseVelocity = totalDelta / dt;
    }
    velocityHistoryRef.current = [];

    if (Math.abs(releaseVelocity) >= FLICK_VELOCITY_THRESHOLD) {
      startMomentumSpin(releaseVelocity);
    } else {
      setRotation(currentRotation => beginSnap(currentRotation));
    }
  };

  const handlePointerDownWheel = (e) => {
    if (spinning || snapping) return;
    // Grabbing the wheel stops any in-progress momentum coast, the same
    // way touching a real spinning wheel would — rather than blocking
    // interaction until it coasts to a stop on its own.
    stopMomentum();
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = angleFromPointer(e.clientX - cx, e.clientY - cy);
    dragState.current = { cx, cy, lastAngle: angle };
    velocityHistoryRef.current = [];
    setDragging(true);
    setResult(null);
    clearPendingTimers();
    container.setPointerCapture?.(e.pointerId);
    container.addEventListener('pointermove', handlePointerMoveWheel);
    container.addEventListener('pointerup', handlePointerUpWheel);
    container.addEventListener('pointercancel', handlePointerUpWheel);
  };

  // ── Accumulator ────────────────────────────────────────────────────────

  const handleAdd = () => {
    if (result === null) return;
    const value = category.suffix ? `${result}${category.suffix}` : result;
    setAccumulated(prev => (prev ? `${prev}, ${value}` : value));
  };

  const handleClear = () => setAccumulated('');

  const handleUndo = () => {
    setAccumulated(prev => {
      const lastComma = prev.lastIndexOf(',');
      if (lastComma === -1) return '';
      return prev.slice(0, lastComma).trimEnd();
    });
  };

  // ── Drive save/load ──────────────────────────────────────────────────

  const handleSave = async () => {
    if (!accessToken) { setStatus('Not signed in to Drive.'); return; }
    if (!accumulated.trim()) { setStatus('Nothing to save yet.'); return; }
    setSaving(true);
    setStatus('Saving…');
    try {
      const name = setName.trim() || 'Untitled idea';
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}--${pad(d.getHours())}-${pad(d.getMinutes())}`;
      const fileName = `${name} (${stamp}).txt`;
      await uploadTextFile(accessToken, fileName, accumulated, 'Randomizer');
      setStatus(`Saved: ${fileName}`);
      setSavedSets(null);
    } catch (err) {
      setStatus('Save failed: ' + err.message);
    }
    setSaving(false);
    setTimeout(() => setStatus(''), 5000);
  };

  const toggleSavedList = async () => {
    if (savedSets !== null) { setSavedSets(null); return; }
    if (!accessToken) { setStatus('Not signed in to Drive.'); return; }
    setLoadingList(true);
    try {
      const files = await listTextFiles(accessToken, 'Randomizer');
      setSavedSets(files);
    } catch (err) {
      setStatus('Could not load saved ideas: ' + err.message);
      setSavedSets([]);
    }
    setLoadingList(false);
  };

  const loadSavedSet = async (file) => {
    if (accumulated.trim() && !window.confirm('This replaces the current text below. Continue?')) return;
    try {
      const text = await readTextFile(accessToken, file.id);
      setAccumulated(text.trim());
      setSavedSets(null);
    } catch (err) {
      setStatus('Could not load: ' + err.message);
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────

  const selectStyle = {
    padding: '8px 12px', fontSize: '14px', borderRadius: '8px',
    border: '1px solid #ccc', backgroundColor: 'white', color: '#222',
  };
  const btn = (bg, disabled) => ({
    padding: '9px 18px', backgroundColor: disabled ? '#555' : bg, color: 'white',
    border: 'none', borderRadius: '8px', fontSize: '14px',
    cursor: disabled ? 'default' : 'pointer',
  });
  const spinBtnStyle = (disabled) => ({
    padding: '10px 26px', backgroundColor: disabled ? '#eee' : 'white',
    color: '#222', border: `3px solid ${disabled ? '#ccc' : '#f5c400'}`,
    borderRadius: '10px', fontSize: '16px', fontWeight: '700',
    cursor: disabled ? 'default' : 'pointer',
  });

  const busy = spinning || dragging || snapping || momentumActive;

  return (
    <div style={{ marginTop: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '6px' }}>Randomizer</h2>
      <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '18px' }}>
        Spin the wheel, drag it yourself, or give it a flick to seed a song idea one piece at a time.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <button
          onClick={() => {
            const idx = CATEGORIES.findIndex(c => c.id === categoryId);
            const prevIdx = (idx - 1 + CATEGORIES.length) % CATEGORIES.length;
            handleCategoryChange(CATEGORIES[prevIdx].id);
          }}
          aria-label="Previous category"
          style={{ background: 'none', border: '1px solid #444', borderRadius: '6px', color: '#ccc', width: '32px', height: '32px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ◀
        </button>
        <select value={categoryId} onChange={e => handleCategoryChange(e.target.value)} style={selectStyle}>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button
          onClick={() => {
            const idx = CATEGORIES.findIndex(c => c.id === categoryId);
            const nextIdx = (idx + 1) % CATEGORIES.length;
            handleCategoryChange(CATEGORIES[nextIdx].id);
          }}
          aria-label="Next category"
          style={{ background: 'none', border: '1px solid #444', borderRadius: '6px', color: '#ccc', width: '32px', height: '32px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ▶
        </button>
      </div>
      <p style={{ textAlign: 'center', fontSize: '11px', color: '#888', marginBottom: '16px' }}>
        {CATEGORIES.findIndex(c => c.id === categoryId) + 1} of {CATEGORIES.length}
      </p>

      <Wheel
        options={category.options}
        rotation={rotation}
        animating={spinning || snapping}
        transitionMs={spinning ? SPIN_DURATION_MS : SNAP_DURATION_MS}
        onPointerDownWheel={handlePointerDownWheel}
      />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
        <button onClick={handleSpin} disabled={busy} style={spinBtnStyle(busy)}>
          {spinning ? '🎡 Spinning…' : momentumActive ? '🎡 Coasting…' : dragging ? '🎡 Drag to pick…' : '🎡 Spin'}
        </button>

        <div style={{ minHeight: '28px', fontSize: '16px', fontWeight: '700', color: '#1a73e8' }}>
          {result !== null && !busy ? `You got: ${category.suffix ? result + category.suffix : result}` : ''}
        </div>

        <button onClick={handleAdd} disabled={result === null || busy} style={btn('#1a73e8', result === null || busy)}>
          ➕ Add to idea
        </button>
      </div>

      <div style={{ marginTop: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#888', textTransform: 'uppercase' }}>
            Your song idea
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleUndo}
              style={{ background: 'none', border: 'none', color: '#1a73e8', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
              Undo
            </button>
            <button onClick={handleClear}
              style={{ background: 'none', border: 'none', color: '#a00', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
              Clear
            </button>
          </div>
        </div>
        <textarea
          value={accumulated}
          onChange={e => setAccumulated(e.target.value)}
          placeholder="Spin the wheel and hit “Add to idea” to build this up — or type here directly."
          rows={4}
          style={{
            width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: '8px',
            border: '1px solid #ccc', boxSizing: 'border-box', resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{ marginTop: '18px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={setName}
          onChange={e => setSetName(e.target.value)}
          placeholder="Name this idea (optional)"
          style={{
            flex: 1, minWidth: '160px', padding: '8px 12px', fontSize: '14px',
            borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box',
          }}
        />
        <button onClick={handleSave} disabled={saving} style={btn('#1a73e8', saving)}>
          {saving ? 'Saving…' : '☁ Save to Drive'}
        </button>
      </div>

      {status && (
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#7fb8ff', marginTop: '10px' }}>
          {status}
        </p>
      )}

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button onClick={toggleSavedList}
          style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>
          {loadingList ? 'Loading…' : savedSets !== null ? 'Hide saved ideas' : 'Show saved ideas'}
        </button>
      </div>

      {savedSets !== null && (
        <div style={{
          marginTop: '10px', border: '1px solid #333', borderRadius: '8px',
          overflow: 'hidden', backgroundColor: '#151515',
        }}>
          {savedSets.length === 0 ? (
            <p style={{ padding: '14px', color: '#777', fontSize: '13px', textAlign: 'center', margin: 0 }}>
              No saved ideas yet.
            </p>
          ) : (
            savedSets.map(f => (
              <button key={f.id} onClick={() => loadSavedSet(f)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                  background: 'none', border: 'none', borderBottom: '1px solid #262626',
                  color: '#ddd', fontSize: '13px', cursor: 'pointer',
                }}>
                {f.name.replace(/\.txt$/, '')}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
