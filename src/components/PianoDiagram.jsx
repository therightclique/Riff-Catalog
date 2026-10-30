import { getScaleNotes } from './FretboardDiagram';
import { noteIn, keyLabel } from './Notation';
import { NOTE_ROLE_COLORS, NOTE_ROLE_TEXT } from './theme';

// Piano versions of the Key Finder's diagrams:
//   • PianoKeyboard    — a three-octave keyboard (C3–B5, spanning middle C)
//                        with the notes of a key highlighted (the piano
//                        counterpart of the fretboard)
//   • PianoChordDiagram — one octave, with a chord's three notes highlighted
// Root / 3rd / 5th use the same colors (from theme.js, chosen in Settings) as
// every other diagram; the remaining notes of the key use the "other" color
// (blue by default), as on the fretboard.

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_PITCH_CLASS = new Set([1, 3, 6, 8, 10]);
const WHITE_KEY = '#f5f5f5';
const BLACK_KEY = '#1c1c1c';

// Lays out keys for MIDI notes first..last (inclusive). White keys sit side
// by side; each black key straddles the boundary after the white key before it.
function layoutKeys(first, last, whiteW, blackW) {
  const keys = [];
  let whiteCount = 0;
  for (let midi = first; midi <= last; midi++) {
    const pc = midi % 12;
    if (BLACK_PITCH_CLASS.has(pc)) {
      keys.push({ midi, pc, black: true, x: whiteCount * whiteW - blackW / 2 });
    } else {
      keys.push({ midi, pc, black: false, x: whiteCount * whiteW });
      whiteCount++;
    }
  }
  return { keys, whiteCount };
}

// role: 'root' | 'third' | 'fifth' | 'other' | null
function keyColors(role) {
  if (!role) return null;
  return { fill: NOTE_ROLE_COLORS[role], ink: NOTE_ROLE_TEXT[role] };
}

function Keys({ keys, whiteW, blackW, whiteH, blackH, top, roleOf, labelSize, blackLabelSize, nameOf = (pc) => CHROMATIC[pc] }) {
  const whites = keys.filter(k => !k.black);
  const blacks = keys.filter(k => k.black);
  return (
    <>
      {whites.map(k => {
        const c = keyColors(roleOf(k.pc));
        return (
          <g key={k.midi}>
            <rect x={k.x} y={top} width={whiteW} height={whiteH} fill={c ? c.fill : WHITE_KEY} stroke="#333" strokeWidth="0.8" />
            {c && labelSize > 0 && (
              <text x={k.x + whiteW / 2} y={top + whiteH - 6} textAnchor="middle" fontSize={labelSize} fontWeight="700" fill={c.ink}
                style={{ pointerEvents: 'none', userSelect: 'none' }}>{nameOf(k.pc)}</text>
            )}
          </g>
        );
      })}
      {blacks.map(k => {
        const c = keyColors(roleOf(k.pc));
        return (
          <g key={k.midi}>
            <rect x={k.x} y={top} width={blackW} height={blackH} fill={c ? c.fill : BLACK_KEY} stroke="#000" strokeWidth="0.8" rx="1" />
            {c && blackLabelSize > 0 && (
              <text x={k.x + blackW / 2} y={top + blackH - 5} textAnchor="middle" fontSize={blackLabelSize} fontWeight="700" fill={c.ink}
                style={{ pointerEvents: 'none', userSelect: 'none' }}>{nameOf(k.pc)}</text>
            )}
          </g>
        );
      })}
    </>
  );
}

// ── The three-octave keyboard for a key ─────────────────────────────────────────
export function PianoKeyboard({ selectedKey }) {
  if (!selectedKey) return null;
  const scaleNotes = getScaleNotes(selectedKey);
  if (!scaleNotes.length) return null;

  const roleByPc = {};
  scaleNotes.forEach(n => {
    const role = n.degree === '1' ? 'root' : n.degree === '3' ? 'third' : n.degree === '5' ? 'fifth' : 'other';
    roleByPc[CHROMATIC.indexOf(n.note)] = role;
  });

  const whiteW = 24, blackW = 14, whiteH = 130, blackH = 82, top = 4;
  const { keys, whiteCount } = layoutKeys(48, 83, whiteW, blackW); // C3 … B5 — three octaves, middle C (C4) in the middle
  const svgWidth = whiteCount * whiteW;
  const svgHeight = top + whiteH + 20;
  const dot = (color, extra = {}) => (
    <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: color, verticalAlign: 'middle', marginRight: '4px', ...extra }}></span>
  );

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ fontSize: '12px', color: '#888', textAlign: 'center', marginBottom: '6px' }}>
        {dot(NOTE_ROLE_COLORS.root)}Root &nbsp;
        {dot(NOTE_ROLE_COLORS.third, { marginLeft: '8px' })}3rd &nbsp;
        {dot(NOTE_ROLE_COLORS.fifth, { marginLeft: '8px' })}5th &nbsp;
        {dot(NOTE_ROLE_COLORS.other, { marginLeft: '8px' })}Other — {keyLabel(selectedKey)}
      </div>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', maxWidth: `${svgWidth}px`, display: 'block', margin: '0 auto' }}>
        <Keys keys={keys} whiteW={whiteW} blackW={blackW} whiteH={whiteH} blackH={blackH} top={top}
          roleOf={pc => roleByPc[pc] || null} labelSize={13} blackLabelSize={10}
          nameOf={pc => noteIn(CHROMATIC[pc], selectedKey)} />
        {/* Octave numbers under each C (C4 = middle C) */}
        {keys.filter(k => k.pc === 0).map(k => (
          <text key={k.midi} x={k.x + whiteW / 2} y={top + whiteH + 14} textAnchor="middle" fontSize="12" fill="#888">
            C{Math.floor(k.midi / 12) - 1}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── One chord, on a single octave ───────────────────────────────────────
// roleByNote: { 'C': 'R', 'E': '3', 'G': '5' } (same shape KeyFinder builds
// for the guitar diagrams).
export function PianoChordDiagram({ chordName, roleByNote, scale = 1.04, spellKey }) {
  const roleMap = { R: 'root', '3': 'third', '5': 'fifth' };
  const whiteW = 14, blackW = 8.4, whiteH = 62, blackH = 38, top = 10;
  const { keys, whiteCount } = layoutKeys(60, 71, whiteW, blackW); // one octave, C–B
  const w = whiteCount * whiteW + 2, h = 90;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: `${w * scale}px`, height: `${h * scale}px` }}>
      <g transform="translate(1,0)">
        <Keys keys={keys} whiteW={whiteW} blackW={blackW} whiteH={whiteH} blackH={blackH} top={top}
          roleOf={pc => roleMap[roleByNote[CHROMATIC[pc]]] || null} labelSize={7.5} blackLabelSize={6}
          nameOf={pc => noteIn(CHROMATIC[pc], spellKey)} />
      </g>
      <text x={w / 2} y={h - 2} textAnchor="middle" fontSize="9" fill="#aaa">{chordName}</text>
    </svg>
  );
}
