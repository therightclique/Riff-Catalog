const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_QUALITIES = ['M', 'm', 'm', 'M', 'M', 'm', 'dim'];
const MINOR_QUALITIES = ['m', 'dim', 'M', 'm', 'm', 'M', 'M'];

// Strings printed top-to-bottom: high e at top, low E at bottom
const OPEN_STRINGS = ['E', 'B', 'G', 'D', 'A', 'E'];
const FRET_MARKERS = [3, 5, 7, 9, 12];

export function getScaleNotes(key) {
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

function getFretNote(stringNote, fret) {
  const rootIdx = CHROMATIC.indexOf(stringNote);
  return CHROMATIC[(rootIdx + fret) % 12];
}

export function FretboardDiagram({ selectedKey }) {
  if (!selectedKey) return null;
  const scaleNotes = getScaleNotes(selectedKey);
  if (!scaleNotes.length) return null;

  const scaleSet = new Set(scaleNotes.map(n => n.chromaticNote));
  const parts = selectedKey.split(' ');
  const rootNote = parts.slice(0, -1).join(' ');

  const numFrets = 12, stringCount = 6, fretW = 44, stringH = 28;
  const leftPad = 28, topPad = 20;
  const svgWidth = leftPad + fretW * (numFrets + 1);
  const svgHeight = topPad + stringH * (stringCount - 1) + 40;

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ fontSize: '12px', color: '#888', textAlign: 'center', marginBottom: '6px' }}>
        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#cc0000', verticalAlign: 'middle', marginRight: '4px' }}></span>
        Root &nbsp;
        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#1a73e8', verticalAlign: 'middle', marginRight: '4px', marginLeft: '8px' }}></span>
        Scale note — {selectedKey}
      </div>
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
    </div>
  );
}
