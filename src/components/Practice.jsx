import { useState } from 'react';

const ALL_KEYS = [
  'A Major', 'A# Major', 'B Major', 'C Major', 'C# Major', 'D Major',
  'D# Major', 'E Major', 'F Major', 'F# Major', 'G Major', 'G# Major',
  'A Minor', 'A# Minor', 'B Minor', 'C Minor', 'C# Minor', 'D Minor',
  'D# Minor', 'E Minor', 'F Minor', 'F# Minor', 'G Minor', 'G# Minor',
];

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Scale intervals from root
const SCALES = {
  'Minor Pentatonic': [0, 3, 5, 7, 10],
  'Major Pentatonic': [0, 2, 4, 7, 9],
  'Natural Minor':    [0, 2, 3, 5, 7, 8, 10],
  'Major':            [0, 2, 4, 5, 7, 9, 11],
  'Blues':            [0, 3, 5, 6, 7, 10],
};

// Open string notes low to high
const OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E'];

// Find fret number for a given note on a given string
function fretFor(stringNote, targetNote) {
  const openIdx = CHROMATIC.indexOf(stringNote);
  const targetIdx = CHROMATIC.indexOf(targetNote);
  return (targetIdx - openIdx + 12) % 12;
}

// Get scale notes for a key
function getScaleNotes(rootNote, scaleType) {
  const rootIdx = CHROMATIC.indexOf(rootNote);
  return SCALES[scaleType].map(interval => CHROMATIC[(rootIdx + interval) % 12]);
}

// Lick library — defined as sequences of {string (0=low E), scaleDegree (0-based index into scale)}
// Plus metadata: name, description, difficulty, scaleType, technique
const LICKS = [
  // ── MINOR PENTATONIC ──
  {
    id: 1,
    name: 'Classic Box 1 Ascend',
    scale: 'Minor Pentatonic',
    difficulty: 'Beginner',
    description: 'The foundational ascending pattern through box 1. Every blues and rock player learns this first.',
    technique: 'Alternate picking',
    // Notes as [stringIdx, semitones from root] — we map to tab at render time
    notes: [
      { s: 4, semi: 0 }, { s: 4, semi: 3 }, { s: 3, semi: 0 }, { s: 3, semi: 3 },
      { s: 2, semi: 0 }, { s: 2, semi: 2 }, { s: 1, semi: 0 }, { s: 1, semi: 2 },
    ],
    tab: [
      { string: 4, degree: 0 }, { string: 4, degree: 1 },
      { string: 3, degree: 0 }, { string: 3, degree: 1 },
      { string: 2, degree: 0 }, { string: 2, degree: 2 },
      { string: 1, degree: 2 }, { string: 1, degree: 3 },
    ],
  },
  {
    id: 2,
    name: 'BB King Bend & Release',
    scale: 'Minor Pentatonic',
    difficulty: 'Intermediate',
    description: 'Bend the b3 up a whole step to the 4, then release. A signature blues move.',
    technique: 'String bend',
    tab: [
      { string: 1, degree: 1 }, { string: 1, degree: 1, bend: true },
      { string: 1, degree: 2 }, { string: 1, degree: 1 },
    ],
  },
  {
    id: 3,
    name: 'Albert King Pull-off',
    scale: 'Minor Pentatonic',
    difficulty: 'Intermediate',
    description: 'Hammer on to the b7 then pull off back to the root. Strong and simple.',
    technique: 'Hammer-on / Pull-off',
    tab: [
      { string: 2, degree: 3 }, { string: 2, degree: 4, ho: true },
      { string: 2, degree: 3, po: true }, { string: 2, degree: 3 },
    ],
  },
  {
    id: 4,
    name: 'Box 1 Triplet Descend',
    scale: 'Minor Pentatonic',
    difficulty: 'Intermediate',
    description: 'Descending triplet run from the top of box 1. Great for fills.',
    technique: 'Alternate picking, triplets',
    tab: [
      { string: 0, degree: 4 }, { string: 0, degree: 3 }, { string: 0, degree: 2 },
      { string: 1, degree: 4 }, { string: 1, degree: 3 }, { string: 1, degree: 2 },
      { string: 2, degree: 4 }, { string: 2, degree: 2 }, { string: 2, degree: 0 },
    ],
  },
  {
    id: 5,
    name: 'Eric Clapton Double Stop',
    scale: 'Minor Pentatonic',
    difficulty: 'Advanced',
    description: 'Two-string double stop on strings 1 and 2 sliding up. Bluesy and expressive.',
    technique: 'Double stop, slide',
    tab: [
      { string: 1, degree: 1 }, { string: 1, degree: 2 },
      { string: 0, degree: 2 }, { string: 0, degree: 3 },
    ],
  },

  // ── MAJOR PENTATONIC ──
  {
    id: 6,
    name: 'Country Major Lick',
    scale: 'Major Pentatonic',
    difficulty: 'Beginner',
    description: 'Classic ascending major pentatonic run. Happy, bright tone — country and pop staple.',
    technique: 'Alternate picking',
    tab: [
      { string: 4, degree: 0 }, { string: 4, degree: 1 },
      { string: 3, degree: 1 }, { string: 3, degree: 2 },
      { string: 2, degree: 2 }, { string: 2, degree: 3 },
      { string: 1, degree: 3 }, { string: 1, degree: 4 },
    ],
  },
  {
    id: 7,
    name: 'Major Add9 Bend',
    scale: 'Major Pentatonic',
    difficulty: 'Intermediate',
    description: 'Bend the major 2nd up a half step, releasing for a sweet country sound.',
    technique: 'String bend',
    tab: [
      { string: 2, degree: 0 }, { string: 2, degree: 1 },
      { string: 2, degree: 1, bend: true }, { string: 2, degree: 2 },
    ],
  },
  {
    id: 8,
    name: 'Major Pentatonic Descend',
    scale: 'Major Pentatonic',
    difficulty: 'Beginner',
    description: 'Simple descending run from the 5th scale degree back to root. Great for ending phrases.',
    technique: 'Downpicking',
    tab: [
      { string: 1, degree: 4 }, { string: 1, degree: 3 },
      { string: 2, degree: 3 }, { string: 2, degree: 2 },
      { string: 3, degree: 2 }, { string: 3, degree: 1 },
      { string: 4, degree: 1 }, { string: 4, degree: 0 },
    ],
  },

  // ── BLUES ──
  {
    id: 9,
    name: 'Blues Scale Blue Note',
    scale: 'Blues',
    difficulty: 'Intermediate',
    description: 'Passes through the blue note (b5) chromatically on the way up. The defining sound of the blues.',
    technique: 'Chromatic passing tone',
    tab: [
      { string: 4, degree: 0 }, { string: 4, degree: 1 },
      { string: 3, degree: 1 }, { string: 3, degree: 2 },
      { string: 3, degree: 3 }, { string: 3, degree: 4 },
    ],
  },
  {
    id: 10,
    name: 'Stevie Ray Shuffle',
    scale: 'Blues',
    difficulty: 'Advanced',
    description: 'Quick descending blues run with the b5 passing tone. Tasty SRV flavour.',
    technique: 'Alternate picking, vibrato on last note',
    tab: [
      { string: 1, degree: 5 }, { string: 1, degree: 4 },
      { string: 1, degree: 3 }, { string: 1, degree: 2 },
      { string: 2, degree: 3 }, { string: 2, degree: 1 }, { string: 2, degree: 0 },
    ],
  },

  // ── NATURAL MINOR ──
  {
    id: 11,
    name: 'Natural Minor Ascend',
    scale: 'Natural Minor',
    difficulty: 'Beginner',
    description: 'Straight ascending natural minor scale run. Great for melodic leads.',
    technique: 'Alternate picking',
    tab: [
      { string: 4, degree: 0 }, { string: 4, degree: 1 }, { string: 4, degree: 2 },
      { string: 3, degree: 2 }, { string: 3, degree: 3 }, { string: 3, degree: 4 },
      { string: 2, degree: 4 }, { string: 2, degree: 5 }, { string: 2, degree: 6 },
    ],
  },
  {
    id: 12,
    name: 'Aeolian Hammer Burst',
    scale: 'Natural Minor',
    difficulty: 'Intermediate',
    description: 'Quick 3-note hammer-on burst repeating across strings. Great for building speed.',
    technique: 'Hammer-on, three notes per string',
    tab: [
      { string: 3, degree: 0 }, { string: 3, degree: 1, ho: true }, { string: 3, degree: 2, ho: true },
      { string: 2, degree: 3 }, { string: 2, degree: 4, ho: true }, { string: 2, degree: 5, ho: true },
    ],
  },
  {
    id: 13,
    name: 'Minor Scale Sequence of 4s',
    scale: 'Natural Minor',
    difficulty: 'Advanced',
    description: 'Classic sequence — play 4 notes ascending, then start one note higher and repeat. Very musical.',
    technique: 'Alternate picking, position shifts',
    tab: [
      { string: 4, degree: 0 }, { string: 4, degree: 1 }, { string: 4, degree: 2 }, { string: 3, degree: 2 },
      { string: 4, degree: 1 }, { string: 4, degree: 2 }, { string: 3, degree: 2 }, { string: 3, degree: 3 },
      { string: 4, degree: 2 }, { string: 3, degree: 2 }, { string: 3, degree: 3 }, { string: 3, degree: 4 },
    ],
  },

  // ── MAJOR ──
  {
    id: 14,
    name: 'Major Scale Two Octave Run',
    scale: 'Major',
    difficulty: 'Intermediate',
    description: 'Two octave ascending major scale run starting from the root. Clean and melodic.',
    technique: 'Alternate picking',
    tab: [
      { string: 4, degree: 0 }, { string: 4, degree: 1 }, { string: 4, degree: 2 },
      { string: 3, degree: 2 }, { string: 3, degree: 3 }, { string: 3, degree: 4 },
      { string: 2, degree: 4 }, { string: 2, degree: 5 },
      { string: 1, degree: 5 }, { string: 1, degree: 6 }, { string: 1, degree: 0 },
    ],
  },
  {
    id: 15,
    name: 'Major Scale Thirds',
    scale: 'Major',
    difficulty: 'Advanced',
    description: 'Playing in diatonic thirds — skip a scale degree each note. Very melodic, classical sound.',
    technique: 'Alternate picking, string skipping',
    tab: [
      { string: 4, degree: 0 }, { string: 3, degree: 2 },
      { string: 4, degree: 1 }, { string: 3, degree: 3 },
      { string: 4, degree: 2 }, { string: 3, degree: 4 },
      { string: 3, degree: 2 }, { string: 2, degree: 4 },
    ],
  },
];

const DIFFICULTY_COLORS = {
  'Beginner': { bg: '#e8f5e2', color: '#2a6b17', border: '#b5d9a5' },
  'Intermediate': { bg: '#fff8e1', color: '#7a5000', border: '#f0c040' },
  'Advanced': { bg: '#fde8e8', color: '#8b1a1a', border: '#f0b8b8' },
};

// Compute tab string for a lick in a given key
function renderTab(lick, rootNote, scaleType) {
  const scaleNotes = getScaleNotes(rootNote, scaleType);
  const lines = ['e |', 'B |', 'G |', 'D |', 'A |', 'E |'];

  // For each note in the lick, compute the fret on the given string
  const positions = lick.tab.map(({ string: strIdx, degree, bend, ho, po }) => {
    const note = scaleNotes[degree % scaleNotes.length];
    const openNote = OPEN_STRINGS[strIdx];
    let fret = fretFor(openNote, note);
    // Prefer playing in a reasonable position — if fret is 0-3 on first pass, use it
    // For higher positions, add 12 if needed
    const suffix = bend ? 'b' : ho ? 'h' : po ? 'p' : '';
    return { strIdx, fret, suffix };
  });

  // Build tab columns
  const cols = positions.map(({ strIdx, fret, suffix }) => {
    const col = Array(6).fill('-');
    col[strIdx] = `${fret}${suffix}`;
    return col;
  });

  // Render each string line
  const result = [0, 1, 2, 3, 4, 5].map(strIdx => {
    const label = ['e', 'B', 'G', 'D', 'A', 'E'][strIdx];
    const notes = cols.map(col => {
      const val = col[strIdx];
      return val === '-' ? '-' : val;
    }).join('-');
    return `${label} |${notes}-|`;
  });

  return result.join('\n');
}

function Practice() {
  const [selectedKey, setSelectedKey] = useState('');
  const [selectedScale, setSelectedScale] = useState('Minor Pentatonic');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [currentLickId, setCurrentLickId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const rootNote = selectedKey ? selectedKey.split(' ').slice(0, -1).join(' ') : null;

  const filteredLicks = LICKS.filter(l => {
    if (l.scale !== selectedScale) return false;
    if (selectedDifficulty && l.difficulty !== selectedDifficulty) return false;
    return true;
  });

  const currentLick = currentLickId ? LICKS.find(l => l.id === currentLickId) : null;

  const randomLick = () => {
    if (filteredLicks.length === 0) return;
    const pick = filteredLicks[Math.floor(Math.random() * filteredLicks.length)];
    setCurrentLickId(pick.id);
    setShowAll(false);
  };

  const tabText = (lick) => rootNote ? renderTab(lick, rootNote, lick.scale) : null;

  return (
    <div style={{ marginTop: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '6px' }}>Practice</h2>
      <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '20px' }}>
        Browse licks and phrases organized by scale. Select a key to see tab in that key.
      </p>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
        <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)}
          style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: 'white', color: '#222' }}>
          <option value="">— Select key (optional) —</option>
          <optgroup label="Major Keys">
            {ALL_KEYS.filter(k => k.includes('Major')).map(k => <option key={k} value={k}>{k}</option>)}
          </optgroup>
          <optgroup label="Minor Keys">
            {ALL_KEYS.filter(k => k.includes('Minor')).map(k => <option key={k} value={k}>{k}</option>)}
          </optgroup>
        </select>

        <select value={selectedScale} onChange={e => { setSelectedScale(e.target.value); setCurrentLickId(null); }}
          style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: 'white', color: '#222' }}>
          {Object.keys(SCALES).map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={selectedDifficulty} onChange={e => setSelectedDifficulty(e.target.value)}
          style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: 'white', color: '#222' }}>
          <option value="">Any difficulty</option>
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Advanced">Advanced</option>
        </select>
      </div>

      {/* Random button */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '24px' }}>
        <button onClick={randomLick}
          style={{ padding: '10px 24px', backgroundColor: '#cc0000', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', fontWeight: '600' }}>
          🎲 Random Lick
        </button>
        <button onClick={() => { setShowAll(!showAll); setCurrentLickId(null); }}
          style={{ padding: '10px 24px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' }}>
          {showAll ? 'Hide all' : `Browse all (${filteredLicks.length})`}
        </button>
      </div>

      {/* Single lick display */}
      {currentLick && !showAll && (
        <LickCard lick={currentLick} tab={tabText(currentLick)} selectedKey={selectedKey} />
      )}

      {/* All licks */}
      {showAll && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredLicks.map(lick => (
            <LickCard key={lick.id} lick={lick} tab={tabText(lick)} selectedKey={selectedKey} />
          ))}
        </div>
      )}

      {filteredLicks.length === 0 && (
        <p style={{ textAlign: 'center', color: '#888' }}>No licks found for this combination.</p>
      )}
    </div>
  );
}

function LickCard({ lick, tab, selectedKey }) {
  const diff = DIFFICULTY_COLORS[lick.difficulty];

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#fafafa' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', backgroundColor: '#f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span style={{ fontWeight: '700', fontSize: '15px' }}>{lick.name}</span>
          <span style={{ marginLeft: '10px', fontSize: '12px', color: '#666' }}>{lick.scale}</span>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
          backgroundColor: diff.bg, color: diff.color, border: `1px solid ${diff.border}`,
        }}>
          {lick.difficulty}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: '13px', color: '#555', margin: '0 0 10px' }}>{lick.description}</p>
        <p style={{ fontSize: '12px', color: '#888', margin: '0 0 12px' }}>
          <strong>Technique:</strong> {lick.technique}
        </p>

        {tab ? (
          <div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>
              Tab in <strong>{selectedKey}</strong>:
            </div>
            <pre style={{
              fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.8',
              backgroundColor: '#111', color: '#e0e0e0', padding: '12px 16px',
              borderRadius: '8px', margin: 0, overflowX: 'auto',
            }}>
              {tab}
            </pre>
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>
            Select a key above to see tab notation.
          </p>
        )}
      </div>
    </div>
  );
}

export default Practice;
