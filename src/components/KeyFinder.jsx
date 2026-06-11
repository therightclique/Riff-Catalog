import { useState } from 'react';

const ALL_KEYS = [
  'A Major', 'A# Major', 'B Major', 'C Major', 'C# Major', 'D Major',
  'D# Major', 'E Major', 'F Major', 'F# Major', 'G Major', 'G# Major',
  'A Minor', 'A# Minor', 'B Minor', 'C Minor', 'C# Minor', 'D Minor',
  'D# Minor', 'E Minor', 'F Minor', 'F# Minor', 'G Minor', 'G# Minor',
];

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_QUALITIES = ['M', 'm', 'm', 'M', 'M', 'm', 'dim'];
const MINOR_QUALITIES = ['m', 'dim', 'M', 'm', 'm', 'M', 'M'];

// Chord shapes: [string6, string5, string4, string3, string2, string1]
// Values: fret number (1-based), 0 = open, -1 = muted, 'b' prefix = barre
// Each shape: { frets: [...], fingers: [...], barre: null | fret, label: 'open'|'barre' }
const CHORD_SHAPES = {
  // MAJOR OPEN/BARRE
  'C': { frets: [-1, 3, 2, 0, 1, 0], fingers: [0,3,2,0,1,0], barre: null },
  'D': { frets: [-1, -1, 0, 2, 3, 2], fingers: [0,0,0,1,3,2], barre: null },
  'E': { frets: [0, 2, 2, 1, 0, 0], fingers: [0,2,3,1,0,0], barre: null },
  'F': { frets: [1, 1, 2, 3, 3, 1], fingers: [1,1,2,3,4,1], barre: 1 },
  'G': { frets: [3, 2, 0, 0, 0, 3], fingers: [2,1,0,0,0,3], barre: null },
  'A': { frets: [-1, 0, 2, 2, 2, 0], fingers: [0,0,1,2,3,0], barre: null },
  'A#': { frets: [-1, 1, 3, 3, 3, 1], fingers: [0,1,2,3,4,1], barre: 1 },
  'B': { frets: [-1, 2, 4, 4, 4, 2], fingers: [0,1,2,3,4,1], barre: 2 },
  'C#': { frets: [-1, 4, 3, 1, 2, 1], fingers: [0,4,3,1,2,1], barre: 1 },
  'D#': { frets: [-1, -1, 1, 3, 4, 3], fingers: [0,0,1,2,4,3], barre: null },
  'F#': { frets: [2, 4, 4, 3, 2, 2], fingers: [1,3,4,2,1,1], barre: 2 },
  'G#': { frets: [4, 6, 6, 5, 4, 4], fingers: [1,3,4,2,1,1], barre: 4 },

  // MINOR OPEN/BARRE
  'Cm': { frets: [-1, 3, 5, 5, 4, 3], fingers: [0,1,3,4,2,1], barre: 3 },
  'Dm': { frets: [-1, -1, 0, 2, 3, 1], fingers: [0,0,0,2,3,1], barre: null },
  'Em': { frets: [0, 2, 2, 0, 0, 0], fingers: [0,2,3,0,0,0], barre: null },
  'Fm': { frets: [1, 3, 3, 1, 1, 1], fingers: [1,3,4,1,1,1], barre: 1 },
  'Gm': { frets: [3, 5, 5, 3, 3, 3], fingers: [1,3,4,1,1,1], barre: 3 },
  'Am': { frets: [-1, 0, 2, 2, 1, 0], fingers: [0,0,2,3,1,0], barre: null },
  'A#m': { frets: [-1, 1, 3, 3, 2, 1], fingers: [0,1,3,4,2,1], barre: 1 },
  'Bm': { frets: [-1, 2, 4, 4, 3, 2], fingers: [0,1,3,4,2,1], barre: 2 },
  'C#m': { frets: [-1, 4, 6, 6, 5, 4], fingers: [0,1,3,4,2,1], barre: 4 },
  'D#m': { frets: [-1, -1, 1, 3, 4, 2], fingers: [0,0,1,3,4,2], barre: null },
  'F#m': { frets: [2, 4, 4, 2, 2, 2], fingers: [1,3,4,1,1,1], barre: 2 },
  'G#m': { frets: [4, 6, 6, 4, 4, 4], fingers: [1,3,4,1,1,1], barre: 4 },

  // DIMINISHED (simplified — using common voicings)
  'Cdim': { frets: [-1, 3, 4, 5, 4, 3], fingers: [0,1,2,4,3,1], barre: null },
  'Ddim': { frets: [-1, -1, 0, 1, 0, 1], fingers: [0,0,0,1,0,2], barre: null },
  'Edim': { frets: [0, 1, 2, 3, 2, 0], fingers: [0,1,2,4,3,0], barre: null },
  'Fdim': { frets: [1, 2, 3, 4, 3, 1], fingers: [1,2,3,4,3,1], barre: null },
  'Gdim': { frets: [3, 4, 5, 6, 5, 3], fingers: [1,2,3,4,3,1], barre: null },
  'Adim': { frets: [-1, 0, 1, 2, 1, 0], fingers: [0,0,1,3,2,0], barre: null },
  'A#dim': { frets: [-1, 1, 2, 3, 2, 0], fingers: [0,1,2,3,2,0], barre: null },
  'Bdim': { frets: [-1, 2, 3, 4, 3, 2], fingers: [0,1,2,4,3,1], barre: null },
  'C#dim': { frets: [-1, 4, 5, 6, 5, 4], fingers: [0,1,2,4,3,1], barre: null },
  'D#dim': { frets: [-1, -1, 1, 2, 1, 2], fingers: [0,0,1,3,2,4], barre: null },
  'F#dim': { frets: [2, 3, 4, 5, 4, 2], fingers: [1,2,3,4,3,1], barre: null },
  'G#dim': { frets: [4, 5, 6, 7, 6, 4], fingers: [1,2,3,4,3,1], barre: null },
};

function getChordShape(note, quality) {
  if (quality === 'dim') return CHORD_SHAPES[`${note}dim`] || null;
  if (quality === 'm') return CHORD_SHAPES[`${note}m`] || null;
  return CHORD_SHAPES[note] || null;
}

// Open string notes for each string index (0=low E, 5=high E)
const OPEN_STRING_NOTES = ['E', 'A', 'D', 'G', 'B', 'E'];

// Mini chord diagram SVG
// frets array: index 0 = low E (left), index 5 = high E (right)
function ChordDiagram({ shape, chordName, rootNote }) {
  if (!shape) return null;

  const { frets, barre } = shape;
  const minFret = barre || Math.min(...frets.filter(f => f > 0));
  const displayFret = minFret > 3 ? minFret : 1;
  const numFrets = 4;
  const strings = 6;

  const w = 80, h = 90;
  const padLeft = 14, padTop = 18, padBottom = 14;
  const colW = (w - padLeft - 6) / (strings - 1);
  const rowH = (h - padTop - padBottom) / numFrets;

  // Compute which fret positions are root notes
  const dots = [];
  frets.forEach((fret, strIdx) => {
    if (fret <= 0) return;
    const col = strIdx * colW + padLeft;
    const relFret = fret - displayFret + 1;
    if (relFret < 1 || relFret > numFrets) return;
    const row = (relFret - 0.5) * rowH + padTop;
    // Determine actual note played at this position
    const openIdx = CHROMATIC.indexOf(OPEN_STRING_NOTES[strIdx]);
    const actualNote = CHROMATIC[(openIdx + fret) % 12];
    const isRoot = rootNote && actualNote === rootNote;
    dots.push({ col, row, isRoot });
  });

  // Sort so root dots render last (on top)
  dots.sort((a, b) => a.isRoot - b.isRoot);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '80px', height: '90px' }}>
      {/* Nut or fret number */}
      {displayFret === 1 ? (
        <rect x={padLeft} y={padTop - 3} width={(strings - 1) * colW} height={3} fill="#ccc" />
      ) : (
        <text x={2} y={padTop + rowH * 0.6} fontSize="8" fill="#aaa">{displayFret}</text>
      )}

      {/* Fret lines */}
      {Array.from({ length: numFrets + 1 }, (_, i) => (
        <line key={i}
          x1={padLeft} y1={padTop + i * rowH}
          x2={padLeft + (strings - 1) * colW} y2={padTop + i * rowH}
          stroke="#888" strokeWidth="0.5" />
      ))}

      {/* String lines */}
      {Array.from({ length: strings }, (_, i) => (
        <line key={i}
          x1={padLeft + i * colW} y1={padTop}
          x2={padLeft + i * colW} y2={padTop + numFrets * rowH}
          stroke="#aaa" strokeWidth={i < 2 ? 1.5 : 0.5} />
      ))}

      {/* Muted / open indicators */}
      {frets.map((fret, strIdx) => {
        const x = padLeft + strIdx * colW;
        if (fret === -1) return <text key={strIdx} x={x} y={padTop - 5} fontSize="8" fill="#aaa" textAnchor="middle">×</text>;
        if (fret === 0) {
          const openIdx = CHROMATIC.indexOf(OPEN_STRING_NOTES[strIdx]);
          const actualNote = CHROMATIC[openIdx % 12];
          const isRoot = rootNote && actualNote === rootNote;
          return isRoot
            ? <circle key={strIdx} cx={x} cy={padTop - 6} r="4" fill="#cc0000" />
            : <circle key={strIdx} cx={x} cy={padTop - 6} r="3" fill="none" stroke="#aaa" strokeWidth="0.8" />;
        }
        return null;
      })}

      {/* Barre bar */}
      {barre && (() => {
        const relFret = barre - displayFret + 1;
        if (relFret < 1 || relFret > numFrets) return null;
        const y = padTop + (relFret - 0.5) * rowH;
        return <rect key="barre" x={padLeft} y={y - 5} width={(strings - 1) * colW} height={10} rx="5" fill="#1a73e8" opacity="0.9" />;
      })()}

      {/* Dots — non-root first, root on top */}
      {dots.map((d, i) => (
        <circle key={i} cx={d.col} cy={d.row} r="6" fill={d.isRoot ? '#cc0000' : '#1a73e8'} />
      ))}

      {/* Chord name */}
      <text x={w / 2} y={h - 2} textAnchor="middle" fontSize="9" fill="#aaa">{chordName}</text>
    </svg>
  );
}

function getScaleNotes(key) {
  const parts = key.split(' ');
  const mode = parts[parts.length - 1];
  const root = parts.slice(0, -1).join(' ');
  const rootIdx = CHROMATIC.indexOf(root);
  if (rootIdx === -1) return [];
  const intervals = mode === 'Major' ? MAJOR_INTERVALS : MINOR_INTERVALS;
  const qualities = mode === 'Major' ? MAJOR_QUALITIES : MINOR_QUALITIES;
  return intervals.map((interval, i) => ({
    degree: String(i + 1),
    quality: qualities[i],
    note: CHROMATIC[(rootIdx + interval) % 12],
    chromaticNote: CHROMATIC[(rootIdx + interval) % 12],
  }));
}

const OPEN_STRINGS = ['E', 'B', 'G', 'D', 'A', 'E'];
const FRET_MARKERS = [3, 5, 7, 9, 12];

function getFretNote(stringNote, fret) {
  const rootIdx = CHROMATIC.indexOf(stringNote);
  return CHROMATIC[(rootIdx + fret) % 12];
}

function Fretboard({ scaleNotes, selectedKey }) {
  const scaleSet = new Set(scaleNotes.map(n => n.chromaticNote));
  const parts = selectedKey?.split(' ');
  const rootNote = parts ? parts.slice(0, -1).join(' ') : null;

  const numFrets = 12, stringCount = 6, fretW = 44, stringH = 28;
  const leftPad = 28, topPad = 20;
  const svgWidth = leftPad + fretW * (numFrets + 1);
  const svgHeight = topPad + stringH * (stringCount - 1) + 40;

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      style={{ width: '100%', maxWidth: `${svgWidth}px`, display: 'block', margin: '0 auto' }}>
      <line x1={leftPad} y1={topPad} x2={leftPad} y2={topPad + stringH * (stringCount - 1)} stroke="#aaa" strokeWidth="3" />
      {Array.from({ length: numFrets }, (_, f) => (
        <line key={f} x1={leftPad + fretW * (f + 1)} y1={topPad} x2={leftPad + fretW * (f + 1)} y2={topPad + stringH * (stringCount - 1)} stroke="#555" strokeWidth="1" />
      ))}
      {OPEN_STRINGS.map((_, s) => (
        <line key={s} x1={leftPad} y1={topPad + stringH * s} x2={leftPad + fretW * numFrets} y2={topPad + stringH * s} stroke="#888" strokeWidth={s >= 4 ? 2 : 1} />
      ))}
      {FRET_MARKERS.map(f => (
        f === 12 ? (
          <g key={f}>
            <circle cx={leftPad + fretW * f - fretW / 2} cy={topPad + stringH * 2 - 5} r="4" fill="#444" />
            <circle cx={leftPad + fretW * f - fretW / 2} cy={topPad + stringH * 2 + 9} r="4" fill="#444" />
          </g>
        ) : (
          <circle key={f} cx={leftPad + fretW * f - fretW / 2} cy={topPad + stringH * 2.5 - 4} r="4" fill="#444" />
        )
      ))}
      {[1, 3, 5, 7, 9, 12].map(f => (
        <text key={f} x={leftPad + fretW * f - fretW / 2} y={svgHeight - 8} textAnchor="middle" fontSize="11" fill="#888">{f}</text>
      ))}
      {OPEN_STRINGS.map((s, i) => (
        <text key={i} x={leftPad - 8} y={topPad + stringH * i + 4} textAnchor="middle" fontSize="11" fill="#aaa">{s}</text>
      ))}
      {OPEN_STRINGS.map((openNote, stringIdx) =>
        Array.from({ length: numFrets + 1 }, (_, fret) => {
          const note = getFretNote(openNote, fret);
          if (!scaleSet.has(note)) return null;
          const isRoot = note === rootNote;
          const cx = fret === 0 ? leftPad - 14 : leftPad + fretW * fret - fretW / 2;
          const cy = topPad + stringH * stringIdx;
          return (
            <g key={`${stringIdx}-${fret}`}>
              <circle cx={cx} cy={cy} r="11" fill={isRoot ? '#cc0000' : '#1a73e8'} opacity="0.9" />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fill="white" fontWeight="600">{note}</text>
            </g>
          );
        })
      )}
    </svg>
  );
}

function KeyFinder({ onFilterByKey }) {
  const [selectedKey, setSelectedKey] = useState('');
  const scaleNotes = selectedKey ? getScaleNotes(selectedKey) : [];

  return (
    <div style={{ marginTop: '20px' }}>
      <h2 style={{ marginBottom: '16px', textAlign: 'center' }}>Key Finder</h2>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
        <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)}
          style={{ padding: '10px 14px', fontSize: '16px', borderRadius: '8px',
            border: '1px solid #ccc', backgroundColor: 'white', color: '#222', width: '100%', maxWidth: '300px' }}>
          <option value="">— Select a key —</option>
          <optgroup label="Major Keys">
            {ALL_KEYS.filter(k => k.includes('Major')).map(k => <option key={k} value={k}>{k}</option>)}
          </optgroup>
          <optgroup label="Minor Keys">
            {ALL_KEYS.filter(k => k.includes('Minor')).map(k => <option key={k} value={k}>{k}</option>)}
          </optgroup>
        </select>
      </div>

      {scaleNotes.length > 0 && (
        <>
          {/* Scale degree cards — no chord diagrams here */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', width: '100%', maxWidth: '500px' }}>
              {scaleNotes.map(({ degree, quality, note }) => {
                const chordLabel = quality === 'M' ? note : quality === 'dim' ? `${note}°` : `${note}m`;
                return (
                  <div key={degree} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '12px 4px', borderRadius: '8px',
                    backgroundColor: quality === 'M' ? '#e8f5e2' : quality === 'dim' ? '#fde8e8' : '#e8eeff',
                    border: `1px solid ${quality === 'M' ? '#b5d9a5' : quality === 'dim' ? '#f0b8b8' : '#b5c8f0'}`,
                  }}>
                    <span style={{
                      fontSize: '16px', fontWeight: '700',
                      color: quality === 'M' ? '#2a6b17' : quality === 'dim' ? '#8b1a1a' : '#1a3d8b',
                    }}>
                      {degree}<span style={{ fontSize: '11px', fontWeight: '400' }}>{quality}</span>
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '600', marginTop: '6px', color: '#333' }}>{note}</span>
                    {onFilterByKey && (
                      <button
                        onClick={() => onFilterByKey(`${note} ${quality === 'M' ? 'Major' : quality === 'dim' ? 'Major' : 'Minor'}`)}
                        title={`Find clips in ${chordLabel}`}
                        style={{
                          marginTop: '6px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer',
                          border: '1px solid #ccc', borderRadius: '4px', backgroundColor: 'white', color: '#555',
                        }}
                      >
                        Find clips
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '12px', color: '#888' }}>
              <span><span style={{ backgroundColor: '#e8f5e2', padding: '2px 8px', borderRadius: '4px', color: '#2a6b17', fontWeight: '600' }}>M</span> Major</span>
              <span><span style={{ backgroundColor: '#e8eeff', padding: '2px 8px', borderRadius: '4px', color: '#1a3d8b', fontWeight: '600' }}>m</span> minor</span>
              <span><span style={{ backgroundColor: '#fde8e8', padding: '2px 8px', borderRadius: '4px', color: '#8b1a1a', fontWeight: '600' }}>dim</span> diminished</span>
            </div>
          </div>

          {/* Fretboard */}
          <div style={{ marginBottom: '8px', fontSize: '13px', color: '#888', textAlign: 'center' }}>
            <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#cc0000', verticalAlign: 'middle', marginRight: '4px' }}></span>
            Root &nbsp;
            <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#1a73e8', verticalAlign: 'middle', marginRight: '4px', marginLeft: '8px' }}></span>
            Scale note
          </div>
          <Fretboard scaleNotes={scaleNotes} selectedKey={selectedKey} />

          {/* Chord diagrams below fretboard */}
          <div style={{ marginTop: '28px', marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', color: '#888', textAlign: 'center', marginBottom: '12px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#cc0000', verticalAlign: 'middle', marginRight: '4px' }}></span>Root &nbsp;
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#1a73e8', verticalAlign: 'middle', marginRight: '4px', marginLeft: '8px' }}></span>Fingered
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px' }}>
              {scaleNotes.map(({ degree, quality, note }) => {
                const shape = getChordShape(note, quality);
                const chordLabel = quality === 'M' ? note : quality === 'dim' ? `${note}°` : `${note}m`;
                return (
                  <div key={degree} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <span style={{ fontSize: '11px', color: '#888' }}>{degree}{quality}</span>
                    <ChordDiagram shape={shape} chordName={chordLabel} rootNote={note} />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default KeyFinder;
