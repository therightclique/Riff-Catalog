import { useState, useRef } from 'react';
import { uploadTextFile, listTextFiles, readTextFile } from './DriveUploader';

// ── Category data ────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'key', label: 'Musical Key', options: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'] },
  { id: 'majorMinor', label: 'Major / Minor', options: ['Major', 'Minor'] },
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
  { id: 'timeSignature', label: 'Time Signature', options: ['4/4', '3/4', '2/4', '6/8', '5/4', '7/8', '9/8', '11/8', '12/8', '5/8'] },
  { id: 'chordDegree', label: 'Chord Progression (scale degree)', options: ['1', '2', '3', '4', '5', '6', '7'] },
  { id: 'tempo', label: 'Tempo (BPM)', options: ['60', '70', '80', '90', '100', '110', '120', '130', '140', '150', '160', '170', '180', '190', '200'], suffix: ' BPM' },
];

const SPIN_DURATION_MS = 5000;

// ── Geometry helpers ────────────────────────────────────────────────────

// Point on the wheel at `deg` clockwise from the top (12 o'clock), at
// radius `r` from center (cx, cy).
function pointAt(deg, r, cx, cy) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function sliceColor(i, n) {
  const hue = Math.round((360 / n) * i);
  return `hsl(${hue}, 62%, 46%)`;
}

// ── Wheel ────────────────────────────────────────────────────────────────

function Wheel({ options, rotation, spinning }) {
  const size = 300;
  const cx = size / 2, cy = size / 2, r = size / 2 - 6;
  const n = options.length;
  const step = 360 / n;

  return (
    <div style={{ position: 'relative', width: size, maxWidth: '90vw', margin: '0 auto' }}>
      {/* Pointer — fixed, does not rotate */}
      <div style={{
        position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0, zIndex: 2,
        borderLeft: '12px solid transparent', borderRight: '12px solid transparent',
        borderTop: '18px solid #fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
      }} />
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{
          width: '100%', height: 'auto', display: 'block', borderRadius: '50%',
          transform: `rotate(${rotation}deg)`,
          transformOrigin: '50% 50%',
          transition: spinning ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.67, 0.1, 1)` : 'none',
          boxShadow: '0 0 0 6px #1e1e1e, 0 4px 16px rgba(0,0,0,0.5)',
        }}>
        {options.map((opt, i) => {
          const a1 = i * step, a2 = (i + 1) * step;
          const p1 = pointAt(a1, r, cx, cy);
          const p2 = pointAt(a2, r, cx, cy);
          const largeArc = step > 180 ? 1 : 0;
          const mid = a1 + step / 2;
          const labelPos = pointAt(mid, r * 0.62, cx, cy);
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
                fontSize={n > 16 ? 9 : n > 10 ? 11 : 13}
                fontWeight="600"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${mid} ${labelPos.x} ${labelPos.y})`}
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
  const [result, setResult] = useState(null);
  const [accumulated, setAccumulated] = useState('');
  const [setName, setSetName] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSets, setSavedSets] = useState(null); // null = not loaded yet
  const [loadingList, setLoadingList] = useState(false);
  const spinTimeout = useRef(null);

  const category = CATEGORIES.find(c => c.id === categoryId);

  const handleCategoryChange = (id) => {
    setCategoryId(id);
    setResult(null);
  };

  const handleSpin = () => {
    if (spinning) return;
    const options = category.options;
    const idx = Math.floor(Math.random() * options.length);
    const step = 360 / options.length;
    const sliceCenter = idx * step + step / 2;
    // Rotate wheel so slice `idx` ends up under the fixed top pointer.
    const baseTarget = (360 - sliceCenter) % 360;
    const jitter = (Math.random() - 0.5) * step * 0.7;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const currentMod = ((rotation % 360) + 360) % 360;
    const delta = ((baseTarget + jitter - currentMod) % 360 + 360) % 360;
    const newRotation = rotation + extraSpins * 360 + delta;

    setResult(null);
    setSpinning(true);
    setRotation(newRotation);

    clearTimeout(spinTimeout.current);
    spinTimeout.current = setTimeout(() => {
      setSpinning(false);
      setResult(options[idx]);
    }, SPIN_DURATION_MS);
  };

  const handleAdd = () => {
    if (result === null) return;
    const value = category.suffix ? `${result}${category.suffix}` : result;
    setAccumulated(prev => (prev ? `${prev}, ${value}` : value));
  };

  const handleClear = () => setAccumulated('');

  const handleSave = async () => {
    if (!accessToken) { setStatus('Not signed in to Drive.'); return; }
    if (!accumulated.trim()) { setStatus('Nothing to save yet.'); return; }
    setSaving(true);
    setStatus('Saving…');
    try {
      const name = setName.trim() || 'Untitled idea';
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const fileName = `${name} (${stamp}).txt`;
      await uploadTextFile(accessToken, fileName, accumulated, 'Randomizer');
      setStatus(`Saved: ${fileName}`);
      setSavedSets(null); // force refresh next time the list is opened
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

  const selectStyle = {
    padding: '8px 12px', fontSize: '14px', borderRadius: '8px',
    border: '1px solid #ccc', backgroundColor: 'white', color: '#222',
  };
  const btn = (bg, disabled) => ({
    padding: '9px 18px', backgroundColor: disabled ? '#555' : bg, color: 'white',
    border: 'none', borderRadius: '8px', fontSize: '14px',
    cursor: disabled ? 'default' : 'pointer',
  });

  return (
    <div style={{ marginTop: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '6px' }}>Randomizer</h2>
      <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '18px' }}>
        Spin the wheel to seed a song idea, one piece at a time.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <select value={categoryId} onChange={e => handleCategoryChange(e.target.value)} style={selectStyle}>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      <Wheel options={category.options} rotation={rotation} spinning={spinning} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
        <button onClick={handleSpin} disabled={spinning} style={btn('#cc0000', spinning)}>
          {spinning ? '🎡 Spinning…' : '🎡 Spin'}
        </button>

        <div style={{ minHeight: '28px', fontSize: '16px', fontWeight: '700', color: '#1a73e8' }}>
          {result !== null && !spinning ? `You got: ${category.suffix ? result + category.suffix : result}` : ''}
        </div>

        <button onClick={handleAdd} disabled={result === null || spinning} style={btn('#1a73e8', result === null || spinning)}>
          ➕ Add to idea
        </button>
      </div>

      <div style={{ marginTop: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#888', textTransform: 'uppercase' }}>
            Your song idea
          </label>
          <button onClick={handleClear}
            style={{ background: 'none', border: 'none', color: '#a00', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
            Clear
          </button>
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
