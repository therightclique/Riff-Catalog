import { useState, useRef, useEffect } from 'react';
import { FretboardDiagram } from './FretboardDiagram';

const ALL_KEYS = [
  'A Major','A# Major','B Major','C Major','C# Major','D Major',
  'D# Major','E Major','F Major','F# Major','G Major','G# Major',
  'A Minor','A# Minor','B Minor','C Minor','C# Minor','D Minor',
  'D# Minor','E Minor','F Minor','F# Minor','G Minor','G# Minor',
];

const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const OPEN_STRINGS = ['E','A','D','G','B','E'];
// Printed top to bottom: high e first, low E last
const STR_LABELS_TTB = ['e','B','G','D','A','E'];

const REF_ROOTS = {
  'Minor Pentatonic':'A','Major Pentatonic':'C',
  'Blues':'A','Natural Minor':'A','Major':'C',
};

// Transposes a moveable shape by ONE fret delta applied uniformly to
// every note, which is the only way to guarantee relative fret spacing
// is preserved exactly. The previous approach computed each note's new
// fret independently via a mod-12 wrap, which could shift two notes that
// started close together by different actual amounts whenever they
// straddled the wrap point differently — inflating a tight 3-fret shape
// into something spanning 10+ frets for certain semitone shifts.
function transposeByDelta(notes, refRoot, targetRoot) {
  if (!targetRoot) return notes;
  const sem = (CHROMATIC.indexOf(targetRoot) - CHROMATIC.indexOf(refRoot) + 12) % 12;
  if (!sem) return notes;
  const minFret = Math.min(...notes.map(n => n.f));
  const upDelta = sem;
  const downDelta = sem - 12;
  const canDown = (minFret + downDelta) >= 0;
  const delta = (canDown && Math.abs(downDelta) <= Math.abs(upDelta)) ? downDelta : upDelta;
  return notes.map(n => ({ ...n, f: n.f + delta }));
}

function transposeNote(si, f, sem) {
  const oi = CHROMATIC.indexOf(OPEN_STRINGS[si]);
  const ni = (oi + f) % 12;
  const newNi = (ni + sem + 12) % 12;
  let nf = (newNi - oi + 12) % 12;
  if (f >= 12) nf += 12;
  return nf;
}

function transposeLick(notes, group, targetRoot) {
  const ref = REF_ROOTS[group];
  if (!ref || !targetRoot) return notes;
  return transposeByDelta(notes, ref, targetRoot);
}

function transposeDS(pairs, group, targetRoot) {
  const ref = REF_ROOTS[group];
  if (!ref || !targetRoot) return pairs;
  return pairs.map(pair => transposeByDelta(pair, ref, targetRoot));
}

function renderSingleNote(notes) {
  const COL = 4;
  const rows = {};
  for (let i = 0; i < 6; i++) rows[i] = '';
  notes.forEach(({ s, f }) => {
    const cell = String(f);
    for (let i = 0; i < 6; i++)
      rows[i] += i === s ? cell.padEnd(COL,'-') : '-'.repeat(Math.max(COL, cell.length+1));
  });
  return STR_LABELS_TTB.map((label, li) => {
    const si = 5 - li;
    return `${label} |--${rows[si]}--|`;
  }).join('\n');
}

function renderDoubleStop(pairs) {
  let maxW = 3;
  pairs.forEach(pair => pair.forEach(({f}) => { maxW = Math.max(maxW, String(f).length+2); }));
  const rows = {};
  for (let i = 0; i < 6; i++) rows[i] = '';
  pairs.forEach(pair => {
    const occ = {};
    pair.forEach(({s,f}) => { occ[s] = String(f); });
    for (let i = 0; i < 6; i++)
      rows[i] += (occ[i] || '-').padEnd(maxW,'-');
  });
  return STR_LABELS_TTB.map((label, li) => {
    const si = 5 - li;
    return `${label} |--${rows[si]}--|`;
  }).join('\n');
}

function renderChords(chords) {
  let maxW = 1;
  chords.forEach(c => Object.values(c).forEach(v => { maxW = Math.max(maxW, String(v).length); }));
  const cellW = maxW + 2;
  const rows = {};
  for (let i = 0; i < 6; i++) rows[i] = '';
  chords.forEach(c => {
    for (let i = 0; i < 6; i++)
      rows[i] += (c[i] !== undefined ? String(c[i]) : '-').padEnd(cellW,'-');
  });
  return STR_LABELS_TTB.map((label, li) => {
    const si = 5 - li;
    return `${label} |--${rows[si]}--|`;
  }).join('\n');
}

// Box licks are generated per-lick against whichever root that specific
// lick was built on (A/E/D for minor pentatonic, G/C for major pentatonic,
// A/E for blues) rather than one fixed group-wide reference, since boxes
// are moveable shapes tied to wherever their root note actually sits.
function transposeBoxLick(notes, lickRoot, targetRoot) {
  return transposeByDelta(notes, lickRoot, targetRoot);
}

// Colors for the degrees Matt specifically asked for — root, 3rd, and
// 5th are the primary "target" tones (they outline the chord, so phrases
// often resolve to them); everything else (4th, b7th, b5 blue note, 2nd,
// 6th) is a passing tone and rendered plain white so it visibly recedes
// against the target tones.
const DEGREE_COLORS = {
  '1': '#ff4444',              // root — red, filled circle
  '3': '#ff9d2e', 'b3': '#ff9d2e', // 3rd (major or minor) — orange, hollow circle
  '5': '#ffe14d',              // 5th — yellow, hollow circle
};

// Same layout as renderSingleNote, but returns JSX with root/3rd/5th
// notes badge-marked instead of plain text — root gets a solid filled
// circle, 3rd/5th get a hollow (outline-only) circle in their own color,
// everything else renders plain white. Character-counted dash padding
// can't guarantee alignment against a circular badge, because the badge
// is sized in `em` (needed for it to actually look round) while the
// dashes are sized by the monospace font's character grid — those two
// units don't reliably convert to the same pixel width. The fix: give
// Same layout as renderSingleNote, but returns JSX with root/3rd/5th
// notes badge-marked instead of plain text — root gets a solid filled
// circle, 3rd/5th get a hollow (outline-only) circle in their own color,
// everything else renders plain white (dimmed labels/dashes make it
// stand out by contrast, see DIM below).
//
// The badge circle is drawn with `position: absolute`, sitting behind the
// digit rather than sizing the layout around it. This means the digit
// occupies EXACTLY the same width plain text would (position:absolute
// elements are removed from normal flow, so they can't add extra width) —
// which is what actually guarantees alignment with every other row,
// rather than approximating it with a specific em/ch/px size that may or
// may not match the surrounding character grid.
function renderSingleNoteWithRoot(notes, targetColumns = notes.length, labelRef = null, pipeRef = null, rowRefsContainer = null) {
  const COL = 4;
  const DIM = '#aaaaaa'; // midpoint between the tab's near-white default and pure white — dim enough to let white passing tones stand out, not so dark it looks broken
  const rows = {};
  for (let i = 0; i < 6; i++) rows[i] = [];
  // Split the filler evenly around the real notes rather than dumping it
  // all at the end — this is what makes the actual lick sit centered
  // within the fixed-length measure instead of hugging the left pipe
  // with a big trail of empty dashes after it. Any odd leftover column
  // goes on the right, an arbitrary but consistent choice.
  const totalFiller = Math.max(0, targetColumns - notes.length);
  const leftFiller = Math.floor(totalFiller / 2);
  const rightFiller = totalFiller - leftFiller;
  if (leftFiller > 0) {
    for (let i = 0; i < 6; i++) {
      rows[i].push(
        <span key={`filler-left-${i}`} style={{ color: DIM }}>
          {'-'.repeat(COL * leftFiller)}
        </span>
      );
    }
  }
  notes.forEach(({ s, f, degree }) => {
    const cell = String(f);
    const isRoot = degree === '1';
    const isThirdOrFifth = degree === '3' || degree === 'b3' || degree === '5';
    const color = DEGREE_COLORS[degree];
    const padCount = Math.max(COL, cell.length + 1) - cell.length;
    const circleStyle = isRoot
      ? { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '1.6em', height: '1.6em', borderRadius: '50%',
          backgroundColor: color, zIndex: 0 }
      : isThirdOrFifth
      ? { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '1.6em', height: '1.6em', borderRadius: '50%',
          border: `1.5px solid ${color}`, zIndex: 0 }
      : null;
    const textStyle = { position: 'relative', zIndex: 1, fontWeight: '700',
      color: isRoot ? '#111' : isThirdOrFifth ? color : '#fff' };
    for (let i = 0; i < 6; i++) {
      if (i === s) {
        rows[i].push(
          <span key={rows[i].length}>
            <span style={{ position: 'relative', display: 'inline-block' }}>
              {circleStyle && <span style={circleStyle} />}
              <span style={textStyle}>{cell}</span>
            </span>
            <span style={{ color: DIM }}>{'-'.repeat(padCount)}</span>
          </span>
        );
      } else {
        rows[i].push(
          <span key={rows[i].length} style={{ color: DIM }}>
            {'-'.repeat(Math.max(COL, cell.length + 1))}
          </span>
        );
      }
    }
  });
  // Trailing filler — see leftFiller/rightFiller split above. Together
  // with the leading filler, every row still resolves to exactly
  // `targetColumns` columns regardless of how the notes are distributed,
  // so the closing "--|" still lands in the same place on every card.
  if (rightFiller > 0) {
    for (let i = 0; i < 6; i++) {
      rows[i].push(
        <span key={`filler-right-${i}`} style={{ color: DIM }}>
          {'-'.repeat(COL * rightFiller)}
        </span>
      );
    }
  }
  return (
    <>
      {STR_LABELS_TTB.map((label, li) => {
        const si = 5 - li;
        return (
          <div key={li} style={{ whiteSpace: 'nowrap' }}>
            {/* This inline-block wrapper is what actually gets measured
                (via rowRefsContainer) to compute the box's real width —
                unlike the parent <pre>'s own shrink-to-fit calculation,
                which measurably undercounted the true content width. */}
            <span ref={el => { if (rowRefsContainer) rowRefsContainer.current[li] = el; }} style={{ display: 'inline-block' }}>
              <span ref={li === 0 ? labelRef : null} style={{ color: DIM }}>{label} |--</span>
              {rows[si]}
              <span ref={li === 0 ? pipeRef : null} style={{ color: DIM }}>--|</span>
            </span>
          </div>
        );
      })}
    </>
  );
}

const LICK_DATA = {
  'Minor Pentatonic': [
    {id:'min1',scale:'A Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 1, "f": 5}, {"s": 1, "f": 7}, {"s": 1, "f": 5}, {"s": 0, "f": 8}, {"s": 1, "f": 0}]},
    {id:'min2',scale:'A Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 1, "f": 5}, {"s": 1, "f": 7}, {"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 5}, {"s": 1, "f": 3}, {"s": 0, "f": 10}]},
    {id:'min3',scale:'A Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 1, "f": 0}, {"s": 0, "f": 8}, {"s": 0, "f": 5}, {"s": 0, "f": 3}, {"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 1, "f": 3}]},
    {id:'min4',scale:'A Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 1, "f": 3}, {"s": 2, "f": 7}, {"s": 1, "f": 3}, {"s": 1, "f": 0}, {"s": 2, "f": 5}]},
    {id:'min5',scale:'A Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 4, "f": 10}, {"s": 4, "f": 8}, {"s": 4, "f": 5}, {"s": 5, "f": 10}, {"s": 5, "f": 8}, {"s": 5, "f": 10}, {"s": 4, "f": 1}]},
    {id:'min6',scale:'A Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 4, "f": 5}, {"s": 4, "f": 3}, {"s": 3, "f": 5}, {"s": 3, "f": 7}, {"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 5}]},
    {id:'min7',scale:'A Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 3, "f": 2}, {"s": 3, "f": 0}, {"s": 2, "f": 2}, {"s": 2, "f": 0}, {"s": 2, "f": 2}, {"s": 3, "f": 0}]},
    {id:'min8',scale:'A Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 3, "f": 5}, {"s": 3, "f": 7}, {"s": 2, "f": 10}, {"s": 1, "f": 5}, {"s": 0, "f": 8}, {"s": 1, "f": 5}, {"s": 2, "f": 10}]},
    {id:'min9',scale:'A Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 0, "f": 5}, {"s": 1, "f": 3}, {"s": 1, "f": 0}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 2, "f": 10}, {"s": 1, "f": 5}]},
    {id:'min10',scale:'A Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 0, "f": 3}, {"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 1, "f": 3}]},
    {id:'min11',scale:'A Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 4, "f": 10}, {"s": 4, "f": 8}, {"s": 4, "f": 5}, {"s": 5, "f": 10}, {"s": 4, "f": 1}, {"s": 5, "f": 5}, {"s": 5, "f": 3}]},
    {id:'min12',scale:'A Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 2, "f": 10}, {"s": 1, "f": 5}, {"s": 2, "f": 10}, {"s": 3, "f": 7}, {"s": 2, "f": 10}, {"s": 3, "f": 2}, {"s": 3, "f": 5}, {"s": 3, "f": 2}]},
    {id:'min13',scale:'A Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 4, "f": 3}, {"s": 4, "f": 1}, {"s": 5, "f": 10}, {"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 2, "f": 10}]},
    {id:'min14',scale:'A Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 3, "f": 9}, {"s": 3, "f": 7}, {"s": 2, "f": 10}, {"s": 1, "f": 5}, {"s": 0, "f": 8}, {"s": 0, "f": 5}]},
    {id:'min15',scale:'A Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 4, "f": 3}, {"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 5}, {"s": 2, "f": 7}, {"s": 3, "f": 5}, {"s": 3, "f": 7}]},
    {id:'min16',scale:'A Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 5, "f": 5}, {"s": 5, "f": 8}, {"s": 4, "f": 3}, {"s": 5, "f": 8}, {"s": 4, "f": 3}]},
    {id:'min17',scale:'A Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 5, "f": 8}, {"s": 4, "f": 3}, {"s": 3, "f": 5}, {"s": 2, "f": 7}, {"s": 3, "f": 5}, {"s": 4, "f": 3}, {"s": 4, "f": 1}]},
    {id:'min18',scale:'E Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 4, "f": 8}, {"s": 3, "f": 9}, {"s": 4, "f": 8}, {"s": 3, "f": 9}, {"s": 4, "f": 3}]},
    {id:'min19',scale:'E Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 0, "f": 7}, {"s": 1, "f": 0}, {"s": 2, "f": 5}, {"s": 1, "f": 0}, {"s": 0, "f": 7}, {"s": 0, "f": 10}]},
    {id:'min20',scale:'E Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 3, "f": 2}, {"s": 2, "f": 5}, {"s": 1, "f": 0}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 1, "f": 2}, {"s": 1, "f": 5}]},
    {id:'min21',scale:'E Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 2, "f": 5}, {"s": 2, "f": 7}, {"s": 2, "f": 5}, {"s": 2, "f": 7}, {"s": 3, "f": 0}, {"s": 2, "f": 7}]},
    {id:'min22',scale:'E Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 5, "f": 5}, {"s": 4, "f": 0}, {"s": 3, "f": 7}, {"s": 3, "f": 9}, {"s": 4, "f": 8}, {"s": 4, "f": 10}]},
    {id:'min23',scale:'E Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 4, "f": 0}, {"s": 3, "f": 7}, {"s": 2, "f": 9}, {"s": 1, "f": 0}, {"s": 0, "f": 7}, {"s": 1, "f": 0}, {"s": 1, "f": 2}]},
    {id:'min24',scale:'E Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 1, "f": 2}, {"s": 0, "f": 5}, {"s": 0, "f": 7}, {"s": 0, "f": 5}, {"s": 1, "f": 2}, {"s": 1, "f": 0}]},
    {id:'min25',scale:'E Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 0, "f": 10}, {"s": 0, "f": 7}, {"s": 0, "f": 10}, {"s": 0, "f": 7}, {"s": 1, "f": 0}]},
    {id:'min26',scale:'E Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 4, "f": 3}, {"s": 3, "f": 4}, {"s": 4, "f": 3}, {"s": 4, "f": 0}, {"s": 5, "f": 5}, {"s": 4, "f": 0}, {"s": 3, "f": 2}]},
    {id:'min27',scale:'E Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 4, "f": 0}, {"s": 5, "f": 5}, {"s": 4, "f": 0}, {"s": 4, "f": 3}, {"s": 3, "f": 4}, {"s": 2, "f": 7}]},
    {id:'min28',scale:'E Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 0, "f": 10}, {"s": 0, "f": 7}, {"s": 1, "f": 0}]},
    {id:'min29',scale:'E Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 3, "f": 7}, {"s": 4, "f": 0}, {"s": 5, "f": 10}, {"s": 4, "f": 0}, {"s": 5, "f": 10}, {"s": 4, "f": 5}, {"s": 4, "f": 8}, {"s": 4, "f": 5}]},
    {id:'min30',scale:'E Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 2, "f": 7}, {"s": 3, "f": 0}, {"s": 2, "f": 7}, {"s": 3, "f": 0}, {"s": 3, "f": 2}]},
    {id:'min31',scale:'E Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 3, "f": 0}, {"s": 3, "f": 2}, {"s": 2, "f": 9}, {"s": 3, "f": 2}, {"s": 2, "f": 9}, {"s": 3, "f": 7}, {"s": 4, "f": 0}]},
    {id:'min32',scale:'E Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 5, "f": 3}, {"s": 5, "f": 5}, {"s": 4, "f": 0}, {"s": 3, "f": 2}, {"s": 2, "f": 5}, {"s": 2, "f": 7}, {"s": 2, "f": 9}]},
    {id:'min33',scale:'E Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 0, "f": 5}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 2, "f": 9}]},
    {id:'min34',scale:'E Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 5, "f": 10}, {"s": 4, "f": 0}, {"s": 3, "f": 2}, {"s": 2, "f": 5}, {"s": 2, "f": 7}, {"s": 3, "f": 0}, {"s": 2, "f": 2}]},
    {id:'min35',scale:'D Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 3, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 5}, {"s": 3, "f": 7}, {"s": 4, "f": 1}, {"s": 4, "f": 3}]},
    {id:'min36',scale:'D Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 0, "f": 1}, {"s": 0, "f": 3}, {"s": 0, "f": 1}, {"s": 0, "f": 3}, {"s": 0, "f": 5}, {"s": 1, "f": 3}, {"s": 1, "f": 5}]},
    {id:'min37',scale:'D Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 4, "f": 3}, {"s": 4, "f": 6}, {"s": 4, "f": 8}, {"s": 3, "f": 10}, {"s": 4, "f": 3}, {"s": 4, "f": 1}, {"s": 5, "f": 5}, {"s": 4, "f": 1}]},
    {id:'min38',scale:'D Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 5, "f": 5}, {"s": 4, "f": 1}, {"s": 5, "f": 10}, {"s": 5, "f": 8}, {"s": 4, "f": 3}]},
    {id:'min39',scale:'D Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 4, "f": 1}, {"s": 3, "f": 7}, {"s": 2, "f": 10}, {"s": 1, "f": 0}, {"s": 2, "f": 5}, {"s": 2, "f": 7}, {"s": 2, "f": 10}]},
    {id:'min40',scale:'D Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 3, "f": 5}, {"s": 4, "f": 3}, {"s": 5, "f": 8}, {"s": 4, "f": 3}, {"s": 5, "f": 8}, {"s": 5, "f": 10}, {"s": 4, "f": 1}]},
    {id:'min41',scale:'D Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 5, "f": 5}, {"s": 5, "f": 8}, {"s": 5, "f": 5}, {"s": 5, "f": 8}, {"s": 4, "f": 3}, {"s": 3, "f": 5}]},
    {id:'min42',scale:'D Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 3, "f": 7}, {"s": 3, "f": 5}, {"s": 3, "f": 2}, {"s": 3, "f": 0}, {"s": 2, "f": 3}, {"s": 2, "f": 0}]},
    {id:'min43',scale:'D Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 2, "f": 10}, {"s": 3, "f": 7}, {"s": 3, "f": 10}, {"s": 3, "f": 7}, {"s": 3, "f": 10}, {"s": 4, "f": 3}, {"s": 4, "f": 6}]},
    {id:'min44',scale:'D Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 3, "f": 5}, {"s": 2, "f": 7}, {"s": 3, "f": 5}, {"s": 3, "f": 7}, {"s": 4, "f": 6}, {"s": 5, "f": 10}]},
    {id:'min45',scale:'D Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 3, "f": 2}, {"s": 2, "f": 10}, {"s": 3, "f": 2}, {"s": 4, "f": 1}, {"s": 5, "f": 10}, {"s": 5, "f": 8}, {"s": 5, "f": 10}]},
    {id:'min46',scale:'D Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 4, "f": 1}, {"s": 3, "f": 7}, {"s": 4, "f": 1}, {"s": 5, "f": 10}, {"s": 4, "f": 6}, {"s": 5, "f": 10}, {"s": 5, "f": 8}]},
    {id:'min47',scale:'D Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 5, "f": 10}, {"s": 5, "f": 8}, {"s": 5, "f": 5}, {"s": 4, "f": 1}, {"s": 3, "f": 2}, {"s": 2, "f": 10}]},
    {id:'min48',scale:'D Minor Pentatonic',difficulty:'Intermediate',notes:[{"s": 5, "f": 8}, {"s": 4, "f": 3}, {"s": 4, "f": 1}, {"s": 4, "f": 3}, {"s": 3, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 5}]},
    {id:'min49',scale:'D Minor Pentatonic',difficulty:'Advanced',notes:[{"s": 1, "f": 5}, {"s": 2, "f": 10}, {"s": 1, "f": 0}, {"s": 1, "f": 3}, {"s": 0, "f": 5}, {"s": 0, "f": 8}, {"s": 1, "f": 5}]},
    {id:'min50',scale:'D Minor Pentatonic',difficulty:'Beginner',notes:[{"s": 3, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 5}, {"s": 2, "f": 7}, {"s": 1, "f": 3}, {"s": 0, "f": 10}]},
  ],
  'Major Pentatonic': [
    {id:'maj1',scale:'G Major Pentatonic',difficulty:'Beginner',notes:[{"s": 3, "f": 9}, {"s": 4, "f": 8}, {"s": 3, "f": 9}, {"s": 3, "f": 7}, {"s": 3, "f": 4}]},
    {id:'maj2',scale:'G Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 1, "f": 7}, {"s": 1, "f": 5}, {"s": 2, "f": 9}, {"s": 1, "f": 0}, {"s": 0, "f": 7}, {"s": 0, "f": 10}, {"s": 1, "f": 7}]},
    {id:'maj3',scale:'G Major Pentatonic',difficulty:'Advanced',notes:[{"s": 1, "f": 7}, {"s": 0, "f": 10}, {"s": 0, "f": 7}, {"s": 1, "f": 5}, {"s": 1, "f": 2}, {"s": 1, "f": 5}, {"s": 1, "f": 7}, {"s": 1, "f": 5}]},
    {id:'maj4',scale:'G Major Pentatonic',difficulty:'Beginner',notes:[{"s": 3, "f": 0}, {"s": 2, "f": 7}, {"s": 1, "f": 2}, {"s": 1, "f": 0}, {"s": 1, "f": 2}, {"s": 0, "f": 5}]},
    {id:'maj5',scale:'G Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 4, "f": 0}, {"s": 3, "f": 7}, {"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 4}, {"s": 2, "f": 7}, {"s": 2, "f": 5}]},
    {id:'maj6',scale:'G Major Pentatonic',difficulty:'Advanced',notes:[{"s": 5, "f": 7}, {"s": 4, "f": 3}, {"s": 3, "f": 9}, {"s": 4, "f": 3}, {"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 4, "f": 5}]},
    {id:'maj7',scale:'G Major Pentatonic',difficulty:'Beginner',notes:[{"s": 0, "f": 5}, {"s": 0, "f": 7}, {"s": 1, "f": 5}, {"s": 0, "f": 7}, {"s": 0, "f": 10}]},
    {id:'maj8',scale:'G Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 5}, {"s": 1, "f": 2}, {"s": 0, "f": 5}, {"s": 0, "f": 7}]},
    {id:'maj9',scale:'G Major Pentatonic',difficulty:'Advanced',notes:[{"s": 4, "f": 5}, {"s": 5, "f": 10}, {"s": 4, "f": 0}, {"s": 5, "f": 5}, {"s": 5, "f": 7}, {"s": 5, "f": 5}, {"s": 5, "f": 7}, {"s": 5, "f": 10}]},
    {id:'maj10',scale:'G Major Pentatonic',difficulty:'Beginner',notes:[{"s": 2, "f": 2}, {"s": 2, "f": 5}, {"s": 3, "f": 2}, {"s": 3, "f": 0}, {"s": 3, "f": 2}, {"s": 4, "f": 0}]},
    {id:'maj11',scale:'G Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 4, "f": 3}, {"s": 3, "f": 9}, {"s": 4, "f": 8}, {"s": 4, "f": 10}, {"s": 4, "f": 8}, {"s": 3, "f": 9}, {"s": 4, "f": 8}]},
    {id:'maj12',scale:'G Major Pentatonic',difficulty:'Advanced',notes:[{"s": 2, "f": 5}, {"s": 1, "f": 0}, {"s": 1, "f": 2}, {"s": 1, "f": 0}, {"s": 2, "f": 5}, {"s": 1, "f": 0}, {"s": 2, "f": 9}, {"s": 1, "f": 0}]},
    {id:'maj13',scale:'G Major Pentatonic',difficulty:'Beginner',notes:[{"s": 1, "f": 7}, {"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 0, "f": 10}, {"s": 0, "f": 7}]},
    {id:'maj14',scale:'G Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 3, "f": 2}, {"s": 3, "f": 0}, {"s": 3, "f": 2}, {"s": 3, "f": 0}, {"s": 2, "f": 2}, {"s": 2, "f": 0}]},
    {id:'maj15',scale:'G Major Pentatonic',difficulty:'Advanced',notes:[{"s": 4, "f": 3}, {"s": 4, "f": 0}, {"s": 3, "f": 7}, {"s": 3, "f": 9}, {"s": 4, "f": 3}, {"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 9}]},
    {id:'maj16',scale:'G Major Pentatonic',difficulty:'Beginner',notes:[{"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 1, "f": 2}]},
    {id:'maj17',scale:'G Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 3, "f": 0}, {"s": 2, "f": 2}, {"s": 3, "f": 0}, {"s": 2, "f": 7}, {"s": 3, "f": 0}, {"s": 2, "f": 2}, {"s": 3, "f": 0}]},
    {id:'maj18',scale:'G Major Pentatonic',difficulty:'Advanced',notes:[{"s": 2, "f": 7}, {"s": 2, "f": 5}, {"s": 3, "f": 2}, {"s": 2, "f": 5}, {"s": 3, "f": 2}, {"s": 3, "f": 4}, {"s": 4, "f": 3}, {"s": 5, "f": 7}]},
    {id:'maj19',scale:'G Major Pentatonic',difficulty:'Beginner',notes:[{"s": 2, "f": 2}, {"s": 2, "f": 0}, {"s": 2, "f": 2}, {"s": 3, "f": 0}, {"s": 2, "f": 7}]},
    {id:'maj20',scale:'G Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 3, "f": 0}, {"s": 3, "f": 2}, {"s": 2, "f": 9}, {"s": 2, "f": 7}, {"s": 3, "f": 4}, {"s": 3, "f": 2}]},
    {id:'maj21',scale:'G Major Pentatonic',difficulty:'Advanced',notes:[{"s": 5, "f": 10}, {"s": 5, "f": 7}, {"s": 4, "f": 3}, {"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 4}, {"s": 3, "f": 2}]},
    {id:'maj22',scale:'G Major Pentatonic',difficulty:'Beginner',notes:[{"s": 3, "f": 0}, {"s": 2, "f": 7}, {"s": 2, "f": 9}, {"s": 3, "f": 7}, {"s": 3, "f": 4}]},
    {id:'maj23',scale:'G Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 2, "f": 9}, {"s": 2, "f": 7}, {"s": 2, "f": 5}, {"s": 1, "f": 0}, {"s": 1, "f": 2}, {"s": 0, "f": 5}, {"s": 0, "f": 3}]},
    {id:'maj24',scale:'G Major Pentatonic',difficulty:'Advanced',notes:[{"s": 3, "f": 2}, {"s": 4, "f": 0}, {"s": 5, "f": 5}, {"s": 4, "f": 0}, {"s": 3, "f": 2}, {"s": 3, "f": 0}, {"s": 2, "f": 7}]},
    {id:'maj25',scale:'G Major Pentatonic',difficulty:'Beginner',notes:[{"s": 4, "f": 10}, {"s": 4, "f": 8}, {"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 4}, {"s": 3, "f": 2}]},
    {id:'maj26',scale:'C Major Pentatonic',difficulty:'Beginner',notes:[{"s": 1, "f": 7}, {"s": 0, "f": 10}, {"s": 1, "f": 3}, {"s": 1, "f": 0}, {"s": 0, "f": 8}]},
    {id:'maj27',scale:'C Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 5, "f": 8}, {"s": 5, "f": 5}, {"s": 4, "f": 1}, {"s": 5, "f": 5}, {"s": 4, "f": 1}, {"s": 3, "f": 7}, {"s": 4, "f": 5}]},
    {id:'maj28',scale:'C Major Pentatonic',difficulty:'Advanced',notes:[{"s": 4, "f": 3}, {"s": 3, "f": 5}, {"s": 3, "f": 2}, {"s": 3, "f": 0}, {"s": 3, "f": 2}, {"s": 2, "f": 5}, {"s": 3, "f": 2}, {"s": 4, "f": 1}]},
    {id:'maj29',scale:'C Major Pentatonic',difficulty:'Beginner',notes:[{"s": 5, "f": 10}, {"s": 5, "f": 8}, {"s": 5, "f": 5}, {"s": 4, "f": 1}, {"s": 3, "f": 2}, {"s": 4, "f": 1}]},
    {id:'maj30',scale:'C Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 2, "f": 10}, {"s": 1, "f": 0}, {"s": 2, "f": 5}, {"s": 1, "f": 0}, {"s": 1, "f": 3}, {"s": 1, "f": 5}, {"s": 2, "f": 10}]},
    {id:'maj31',scale:'C Major Pentatonic',difficulty:'Advanced',notes:[{"s": 4, "f": 3}, {"s": 3, "f": 5}, {"s": 4, "f": 3}, {"s": 3, "f": 9}, {"s": 4, "f": 8}, {"s": 4, "f": 10}, {"s": 4, "f": 8}]},
    {id:'maj32',scale:'C Major Pentatonic',difficulty:'Beginner',notes:[{"s": 5, "f": 0}, {"s": 5, "f": 3}, {"s": 5, "f": 5}, {"s": 5, "f": 8}, {"s": 4, "f": 3}]},
    {id:'maj33',scale:'C Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 0, "f": 10}, {"s": 1, "f": 3}, {"s": 0, "f": 5}, {"s": 1, "f": 3}, {"s": 0, "f": 5}, {"s": 0, "f": 8}, {"s": 1, "f": 0}]},
    {id:'maj34',scale:'C Major Pentatonic',difficulty:'Advanced',notes:[{"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 0, "f": 10}, {"s": 1, "f": 3}, {"s": 2, "f": 7}, {"s": 1, "f": 3}, {"s": 1, "f": 5}]},
    {id:'maj35',scale:'C Major Pentatonic',difficulty:'Beginner',notes:[{"s": 1, "f": 3}, {"s": 0, "f": 5}, {"s": 0, "f": 3}, {"s": 0, "f": 5}, {"s": 0, "f": 3}, {"s": 0, "f": 0}]},
    {id:'maj36',scale:'C Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 3, "f": 7}, {"s": 3, "f": 9}, {"s": 3, "f": 7}, {"s": 3, "f": 9}, {"s": 4, "f": 3}, {"s": 4, "f": 1}, {"s": 3, "f": 2}]},
    {id:'maj37',scale:'C Major Pentatonic',difficulty:'Advanced',notes:[{"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 2, "f": 5}, {"s": 3, "f": 2}, {"s": 3, "f": 5}, {"s": 4, "f": 3}]},
    {id:'maj38',scale:'C Major Pentatonic',difficulty:'Beginner',notes:[{"s": 1, "f": 7}, {"s": 0, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 10}]},
    {id:'maj39',scale:'C Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 3, "f": 0}, {"s": 2, "f": 7}, {"s": 2, "f": 10}, {"s": 3, "f": 7}, {"s": 3, "f": 9}, {"s": 4, "f": 3}, {"s": 3, "f": 5}]},
    {id:'maj40',scale:'C Major Pentatonic',difficulty:'Advanced',notes:[{"s": 5, "f": 8}, {"s": 5, "f": 5}, {"s": 5, "f": 3}, {"s": 5, "f": 5}, {"s": 5, "f": 8}, {"s": 4, "f": 3}, {"s": 3, "f": 5}, {"s": 3, "f": 2}]},
    {id:'maj41',scale:'C Major Pentatonic',difficulty:'Beginner',notes:[{"s": 5, "f": 10}, {"s": 5, "f": 8}, {"s": 5, "f": 10}, {"s": 4, "f": 5}, {"s": 4, "f": 8}]},
    {id:'maj42',scale:'C Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 4, "f": 8}, {"s": 4, "f": 10}, {"s": 4, "f": 8}, {"s": 3, "f": 9}, {"s": 4, "f": 8}, {"s": 4, "f": 5}]},
    {id:'maj43',scale:'C Major Pentatonic',difficulty:'Advanced',notes:[{"s": 4, "f": 1}, {"s": 3, "f": 7}, {"s": 3, "f": 9}, {"s": 4, "f": 8}, {"s": 3, "f": 9}, {"s": 4, "f": 3}, {"s": 3, "f": 9}, {"s": 4, "f": 8}]},
    {id:'maj44',scale:'C Major Pentatonic',difficulty:'Beginner',notes:[{"s": 3, "f": 9}, {"s": 4, "f": 8}, {"s": 4, "f": 5}, {"s": 4, "f": 8}, {"s": 4, "f": 10}]},
    {id:'maj45',scale:'C Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 5, "f": 0}, {"s": 5, "f": 3}, {"s": 5, "f": 5}, {"s": 5, "f": 8}, {"s": 5, "f": 10}, {"s": 5, "f": 8}, {"s": 4, "f": 3}]},
    {id:'maj46',scale:'C Major Pentatonic',difficulty:'Advanced',notes:[{"s": 0, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 10}]},
    {id:'maj47',scale:'C Major Pentatonic',difficulty:'Beginner',notes:[{"s": 3, "f": 5}, {"s": 3, "f": 2}, {"s": 2, "f": 10}, {"s": 1, "f": 0}, {"s": 0, "f": 8}]},
    {id:'maj48',scale:'C Major Pentatonic',difficulty:'Intermediate',notes:[{"s": 5, "f": 8}, {"s": 5, "f": 10}, {"s": 5, "f": 8}, {"s": 5, "f": 5}, {"s": 5, "f": 8}, {"s": 4, "f": 3}]},
    {id:'maj49',scale:'C Major Pentatonic',difficulty:'Advanced',notes:[{"s": 0, "f": 3}, {"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 0, "f": 5}, {"s": 1, "f": 3}, {"s": 2, "f": 7}, {"s": 2, "f": 10}, {"s": 3, "f": 7}]},
    {id:'maj50',scale:'C Major Pentatonic',difficulty:'Beginner',notes:[{"s": 3, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 5}, {"s": 3, "f": 2}, {"s": 4, "f": 1}]},
  ],
  'Blues': [
    {id:'blu1',scale:'A Blues',difficulty:'Beginner',notes:[{"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 1, "f": 0}]},
    {id:'blu2',scale:'A Blues',difficulty:'Intermediate',notes:[{"s": 1, "f": 5}, {"s": 1, "f": 6}, {"s": 1, "f": 5}, {"s": 0, "f": 8}, {"s": 0, "f": 11}, {"s": 0, "f": 10}]},
    {id:'blu3',scale:'A Blues',difficulty:'Advanced',notes:[{"s": 2, "f": 10}, {"s": 1, "f": 0}, {"s": 0, "f": 8}, {"s": 0, "f": 11}, {"s": 1, "f": 7}, {"s": 0, "f": 11}, {"s": 1, "f": 3}, {"s": 1, "f": 0}]},
    {id:'blu4',scale:'A Blues',difficulty:'Beginner',notes:[{"s": 1, "f": 5}, {"s": 0, "f": 8}, {"s": 1, "f": 5}, {"s": 0, "f": 11}, {"s": 1, "f": 5}]},
    {id:'blu5',scale:'A Blues',difficulty:'Intermediate',notes:[{"s": 3, "f": 5}, {"s": 3, "f": 2}, {"s": 3, "f": 5}, {"s": 4, "f": 4}, {"s": 5, "f": 8}, {"s": 5, "f": 5}]},
    {id:'blu6',scale:'A Blues',difficulty:'Advanced',notes:[{"s": 4, "f": 3}, {"s": 3, "f": 5}, {"s": 2, "f": 7}, {"s": 3, "f": 0}, {"s": 3, "f": 2}, {"s": 3, "f": 0}, {"s": 2, "f": 2}]},
    {id:'blu7',scale:'A Blues',difficulty:'Beginner',notes:[{"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 2, "f": 5}]},
    {id:'blu8',scale:'A Blues',difficulty:'Intermediate',notes:[{"s": 3, "f": 7}, {"s": 3, "f": 5}, {"s": 3, "f": 8}, {"s": 3, "f": 7}, {"s": 2, "f": 10}, {"s": 1, "f": 6}, {"s": 1, "f": 3}]},
    {id:'blu9',scale:'A Blues',difficulty:'Advanced',notes:[{"s": 2, "f": 1}, {"s": 2, "f": 2}, {"s": 3, "f": 0}, {"s": 2, "f": 2}, {"s": 3, "f": 0}, {"s": 2, "f": 2}, {"s": 2, "f": 0}]},
    {id:'blu10',scale:'A Blues',difficulty:'Beginner',notes:[{"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 0, "f": 11}, {"s": 0, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 5}]},
    {id:'blu11',scale:'A Blues',difficulty:'Intermediate',notes:[{"s": 3, "f": 8}, {"s": 4, "f": 3}, {"s": 3, "f": 5}, {"s": 2, "f": 7}, {"s": 2, "f": 10}, {"s": 3, "f": 2}]},
    {id:'blu12',scale:'A Blues',difficulty:'Advanced',notes:[{"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 1, "f": 3}, {"s": 0, "f": 5}, {"s": 1, "f": 3}]},
    {id:'blu13',scale:'A Blues',difficulty:'Beginner',notes:[{"s": 0, "f": 5}, {"s": 0, "f": 3}, {"s": 0, "f": 5}, {"s": 1, "f": 3}, {"s": 0, "f": 5}]},
    {id:'blu14',scale:'A Blues',difficulty:'Intermediate',notes:[{"s": 4, "f": 4}, {"s": 4, "f": 1}, {"s": 4, "f": 3}, {"s": 3, "f": 5}, {"s": 4, "f": 4}, {"s": 3, "f": 7}, {"s": 4, "f": 5}]},
    {id:'blu15',scale:'A Blues',difficulty:'Advanced',notes:[{"s": 3, "f": 7}, {"s": 3, "f": 9}, {"s": 3, "f": 7}, {"s": 4, "f": 1}, {"s": 4, "f": 3}, {"s": 4, "f": 5}, {"s": 4, "f": 3}, {"s": 4, "f": 1}]},
    {id:'blu16',scale:'A Blues',difficulty:'Beginner',notes:[{"s": 1, "f": 3}, {"s": 0, "f": 5}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 2, "f": 5}]},
    {id:'blu17',scale:'A Blues',difficulty:'Intermediate',notes:[{"s": 3, "f": 0}, {"s": 3, "f": 2}, {"s": 4, "f": 1}, {"s": 5, "f": 5}, {"s": 5, "f": 3}, {"s": 5, "f": 5}]},
    {id:'blu18',scale:'A Blues',difficulty:'Advanced',notes:[{"s": 3, "f": 8}, {"s": 3, "f": 7}, {"s": 4, "f": 5}, {"s": 5, "f": 11}, {"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 8}, {"s": 4, "f": 1}]},
    {id:'blu19',scale:'A Blues',difficulty:'Beginner',notes:[{"s": 5, "f": 8}, {"s": 5, "f": 11}, {"s": 5, "f": 10}, {"s": 5, "f": 11}, {"s": 5, "f": 8}, {"s": 4, "f": 4}]},
    {id:'blu20',scale:'A Blues',difficulty:'Intermediate',notes:[{"s": 4, "f": 5}, {"s": 5, "f": 11}, {"s": 4, "f": 5}, {"s": 5, "f": 10}, {"s": 5, "f": 11}, {"s": 5, "f": 8}]},
    {id:'blu21',scale:'A Blues',difficulty:'Advanced',notes:[{"s": 1, "f": 5}, {"s": 1, "f": 6}, {"s": 0, "f": 10}, {"s": 1, "f": 6}, {"s": 1, "f": 3}, {"s": 2, "f": 7}, {"s": 1, "f": 3}]},
    {id:'blu22',scale:'A Blues',difficulty:'Beginner',notes:[{"s": 0, "f": 10}, {"s": 1, "f": 6}, {"s": 0, "f": 8}, {"s": 1, "f": 6}, {"s": 1, "f": 3}, {"s": 1, "f": 0}]},
    {id:'blu23',scale:'A Blues',difficulty:'Intermediate',notes:[{"s": 0, "f": 5}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 0, "f": 3}, {"s": 0, "f": 0}, {"s": 0, "f": 3}]},
    {id:'blu24',scale:'A Blues',difficulty:'Advanced',notes:[{"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 4, "f": 1}, {"s": 5, "f": 11}, {"s": 5, "f": 10}, {"s": 4, "f": 5}, {"s": 4, "f": 8}, {"s": 3, "f": 9}]},
    {id:'blu25',scale:'A Blues',difficulty:'Beginner',notes:[{"s": 5, "f": 5}, {"s": 4, "f": 1}, {"s": 5, "f": 10}, {"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 5}]},
    {id:'blu26',scale:'E Blues',difficulty:'Beginner',notes:[{"s": 4, "f": 3}, {"s": 4, "f": 0}, {"s": 3, "f": 3}, {"s": 2, "f": 9}, {"s": 1, "f": 0}]},
    {id:'blu27',scale:'E Blues',difficulty:'Intermediate',notes:[{"s": 4, "f": 0}, {"s": 3, "f": 2}, {"s": 3, "f": 3}, {"s": 2, "f": 7}, {"s": 1, "f": 2}, {"s": 0, "f": 6}]},
    {id:'blu28',scale:'E Blues',difficulty:'Advanced',notes:[{"s": 1, "f": 7}, {"s": 0, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 5}, {"s": 1, "f": 2}]},
    {id:'blu29',scale:'E Blues',difficulty:'Beginner',notes:[{"s": 0, "f": 10}, {"s": 0, "f": 7}, {"s": 1, "f": 0}, {"s": 0, "f": 6}, {"s": 0, "f": 5}]},
    {id:'blu30',scale:'E Blues',difficulty:'Intermediate',notes:[{"s": 4, "f": 3}, {"s": 4, "f": 0}, {"s": 5, "f": 6}, {"s": 5, "f": 5}, {"s": 5, "f": 6}, {"s": 5, "f": 7}, {"s": 5, "f": 5}]},
    {id:'blu31',scale:'E Blues',difficulty:'Advanced',notes:[{"s": 0, "f": 7}, {"s": 1, "f": 1}, {"s": 1, "f": 2}, {"s": 2, "f": 7}, {"s": 1, "f": 2}, {"s": 2, "f": 7}, {"s": 3, "f": 0}, {"s": 2, "f": 2}]},
    {id:'blu32',scale:'E Blues',difficulty:'Beginner',notes:[{"s": 0, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 5}, {"s": 0, "f": 7}, {"s": 1, "f": 5}]},
    {id:'blu33',scale:'E Blues',difficulty:'Intermediate',notes:[{"s": 1, "f": 0}, {"s": 2, "f": 5}, {"s": 2, "f": 2}, {"s": 2, "f": 5}, {"s": 3, "f": 2}, {"s": 3, "f": 4}, {"s": 3, "f": 3}]},
    {id:'blu34',scale:'E Blues',difficulty:'Advanced',notes:[{"s": 3, "f": 9}, {"s": 3, "f": 7}, {"s": 2, "f": 9}, {"s": 2, "f": 7}, {"s": 2, "f": 5}, {"s": 1, "f": 0}, {"s": 1, "f": 1}]},
    {id:'blu35',scale:'E Blues',difficulty:'Beginner',notes:[{"s": 2, "f": 8}, {"s": 1, "f": 0}, {"s": 0, "f": 6}, {"s": 0, "f": 3}, {"s": 0, "f": 5}]},
    {id:'blu36',scale:'E Blues',difficulty:'Intermediate',notes:[{"s": 2, "f": 0}, {"s": 2, "f": 2}, {"s": 3, "f": 0}, {"s": 3, "f": 3}, {"s": 3, "f": 4}, {"s": 3, "f": 3}, {"s": 2, "f": 5}]},
    {id:'blu37',scale:'E Blues',difficulty:'Advanced',notes:[{"s": 4, "f": 5}, {"s": 4, "f": 3}, {"s": 3, "f": 4}, {"s": 3, "f": 7}, {"s": 4, "f": 5}, {"s": 5, "f": 10}, {"s": 4, "f": 0}, {"s": 5, "f": 6}]},
    {id:'blu38',scale:'E Blues',difficulty:'Beginner',notes:[{"s": 3, "f": 9}, {"s": 4, "f": 3}, {"s": 4, "f": 0}, {"s": 3, "f": 7}, {"s": 4, "f": 0}]},
    {id:'blu39',scale:'E Blues',difficulty:'Intermediate',notes:[{"s": 1, "f": 0}, {"s": 2, "f": 9}, {"s": 3, "f": 2}, {"s": 4, "f": 0}, {"s": 3, "f": 7}, {"s": 2, "f": 9}, {"s": 1, "f": 0}]},
    {id:'blu40',scale:'E Blues',difficulty:'Advanced',notes:[{"s": 1, "f": 1}, {"s": 1, "f": 2}, {"s": 1, "f": 1}, {"s": 0, "f": 7}, {"s": 1, "f": 1}, {"s": 0, "f": 3}, {"s": 1, "f": 1}]},
    {id:'blu41',scale:'E Blues',difficulty:'Beginner',notes:[{"s": 0, "f": 6}, {"s": 1, "f": 0}, {"s": 1, "f": 1}, {"s": 0, "f": 3}, {"s": 1, "f": 1}, {"s": 2, "f": 7}]},
    {id:'blu42',scale:'E Blues',difficulty:'Intermediate',notes:[{"s": 1, "f": 5}, {"s": 0, "f": 7}, {"s": 1, "f": 1}, {"s": 1, "f": 0}, {"s": 1, "f": 2}, {"s": 0, "f": 10}]},
    {id:'blu43',scale:'E Blues',difficulty:'Advanced',notes:[{"s": 1, "f": 0}, {"s": 1, "f": 1}, {"s": 2, "f": 7}, {"s": 3, "f": 4}, {"s": 2, "f": 8}, {"s": 3, "f": 2}, {"s": 2, "f": 9}]},
    {id:'blu44',scale:'E Blues',difficulty:'Beginner',notes:[{"s": 5, "f": 5}, {"s": 5, "f": 7}, {"s": 4, "f": 3}, {"s": 5, "f": 7}, {"s": 5, "f": 6}]},
    {id:'blu45',scale:'E Blues',difficulty:'Intermediate',notes:[{"s": 0, "f": 3}, {"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 0, "f": 6}, {"s": 0, "f": 5}, {"s": 0, "f": 3}, {"s": 1, "f": 0}]},
    {id:'blu46',scale:'E Blues',difficulty:'Advanced',notes:[{"s": 2, "f": 2}, {"s": 2, "f": 0}, {"s": 2, "f": 2}, {"s": 2, "f": 0}, {"s": 2, "f": 2}, {"s": 3, "f": 0}, {"s": 3, "f": 3}, {"s": 4, "f": 0}]},
    {id:'blu47',scale:'E Blues',difficulty:'Beginner',notes:[{"s": 5, "f": 6}, {"s": 4, "f": 0}, {"s": 3, "f": 7}, {"s": 2, "f": 9}, {"s": 3, "f": 3}, {"s": 2, "f": 5}]},
    {id:'blu48',scale:'E Blues',difficulty:'Intermediate',notes:[{"s": 3, "f": 7}, {"s": 4, "f": 0}, {"s": 3, "f": 7}, {"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 4, "f": 5}, {"s": 5, "f": 10}]},
    {id:'blu49',scale:'E Blues',difficulty:'Advanced',notes:[{"s": 3, "f": 0}, {"s": 2, "f": 7}, {"s": 1, "f": 1}, {"s": 0, "f": 7}, {"s": 1, "f": 5}, {"s": 1, "f": 7}, {"s": 0, "f": 10}, {"s": 1, "f": 2}]},
    {id:'blu50',scale:'E Blues',difficulty:'Beginner',notes:[{"s": 3, "f": 0}, {"s": 2, "f": 8}, {"s": 3, "f": 0}, {"s": 2, "f": 7}, {"s": 3, "f": 3}, {"s": 2, "f": 7}]},
  ],
  'Natural Minor': [
    {id:'nat1',scale:'A Natural Minor',difficulty:'Beginner',notes:[{"s": 2, "f": 9}, {"s": 3, "f": 5}, {"s": 2, "f": 7}, {"s": 2, "f": 5}, {"s": 1, "f": 0}]},
    {id:'nat2',scale:'A Natural Minor',difficulty:'Intermediate',notes:[{"s": 0, "f": 8}, {"s": 1, "f": 0}, {"s": 2, "f": 10}, {"s": 1, "f": 5}, {"s": 2, "f": 9}, {"s": 2, "f": 7}]},
    {id:'nat3',scale:'A Natural Minor',difficulty:'Advanced',notes:[{"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 0, "f": 1}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 2, "f": 10}, {"s": 3, "f": 7}, {"s": 4, "f": 0}]},
    {id:'nat4',scale:'A Natural Minor',difficulty:'Beginner',notes:[{"s": 3, "f": 7}, {"s": 4, "f": 1}, {"s": 5, "f": 10}, {"s": 4, "f": 6}, {"s": 4, "f": 8}, {"s": 3, "f": 9}]},
    {id:'nat5',scale:'A Natural Minor',difficulty:'Intermediate',notes:[{"s": 3, "f": 4}, {"s": 4, "f": 1}, {"s": 3, "f": 4}, {"s": 2, "f": 7}, {"s": 2, "f": 9}, {"s": 3, "f": 5}]},
    {id:'nat6',scale:'A Natural Minor',difficulty:'Advanced',notes:[{"s": 1, "f": 7}, {"s": 1, "f": 5}, {"s": 2, "f": 10}, {"s": 1, "f": 5}, {"s": 1, "f": 7}, {"s": 1, "f": 8}, {"s": 1, "f": 5}, {"s": 2, "f": 9}]},
    {id:'nat7',scale:'A Natural Minor',difficulty:'Beginner',notes:[{"s": 0, "f": 5}, {"s": 0, "f": 8}, {"s": 1, "f": 0}, {"s": 2, "f": 9}, {"s": 2, "f": 7}]},
    {id:'nat8',scale:'A Natural Minor',difficulty:'Intermediate',notes:[{"s": 3, "f": 10}, {"s": 4, "f": 3}, {"s": 4, "f": 6}, {"s": 4, "f": 5}, {"s": 4, "f": 6}, {"s": 5, "f": 10}, {"s": 4, "f": 1}]},
    {id:'nat9',scale:'A Natural Minor',difficulty:'Advanced',notes:[{"s": 4, "f": 3}, {"s": 4, "f": 6}, {"s": 3, "f": 7}, {"s": 3, "f": 4}, {"s": 4, "f": 1}, {"s": 4, "f": 3}, {"s": 5, "f": 7}]},
    {id:'nat10',scale:'A Natural Minor',difficulty:'Beginner',notes:[{"s": 3, "f": 2}, {"s": 4, "f": 1}, {"s": 3, "f": 4}, {"s": 3, "f": 5}, {"s": 3, "f": 4}, {"s": 3, "f": 7}]},
    {id:'nat11',scale:'A Natural Minor',difficulty:'Intermediate',notes:[{"s": 3, "f": 0}, {"s": 2, "f": 2}, {"s": 2, "f": 5}, {"s": 3, "f": 2}, {"s": 3, "f": 5}, {"s": 4, "f": 0}]},
    {id:'nat12',scale:'A Natural Minor',difficulty:'Advanced',notes:[{"s": 2, "f": 2}, {"s": 3, "f": 0}, {"s": 2, "f": 3}, {"s": 2, "f": 0}, {"s": 2, "f": 2}, {"s": 2, "f": 3}, {"s": 2, "f": 2}]},
    {id:'nat13',scale:'A Natural Minor',difficulty:'Beginner',notes:[{"s": 2, "f": 10}, {"s": 1, "f": 2}, {"s": 2, "f": 7}, {"s": 2, "f": 9}, {"s": 1, "f": 3}]},
    {id:'nat14',scale:'A Natural Minor',difficulty:'Intermediate',notes:[{"s": 0, "f": 10}, {"s": 1, "f": 3}, {"s": 2, "f": 9}, {"s": 3, "f": 7}, {"s": 3, "f": 10}, {"s": 3, "f": 9}]},
    {id:'nat15',scale:'A Natural Minor',difficulty:'Advanced',notes:[{"s": 0, "f": 5}, {"s": 0, "f": 8}, {"s": 0, "f": 10}, {"s": 1, "f": 8}, {"s": 1, "f": 5}, {"s": 1, "f": 3}, {"s": 0, "f": 10}]},
    {id:'nat16',scale:'A Natural Minor',difficulty:'Beginner',notes:[{"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 2, "f": 10}, {"s": 2, "f": 7}, {"s": 2, "f": 10}, {"s": 3, "f": 7}]},
    {id:'nat17',scale:'A Natural Minor',difficulty:'Intermediate',notes:[{"s": 5, "f": 10}, {"s": 4, "f": 0}, {"s": 3, "f": 5}, {"s": 3, "f": 2}, {"s": 2, "f": 5}, {"s": 2, "f": 3}]},
    {id:'nat18',scale:'A Natural Minor',difficulty:'Advanced',notes:[{"s": 2, "f": 2}, {"s": 2, "f": 0}, {"s": 2, "f": 2}, {"s": 2, "f": 5}, {"s": 2, "f": 7}, {"s": 1, "f": 2}, {"s": 0, "f": 8}, {"s": 1, "f": 2}]},
    {id:'nat19',scale:'A Natural Minor',difficulty:'Beginner',notes:[{"s": 4, "f": 6}, {"s": 4, "f": 8}, {"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 4}, {"s": 3, "f": 7}]},
    {id:'nat20',scale:'A Natural Minor',difficulty:'Intermediate',notes:[{"s": 2, "f": 7}, {"s": 3, "f": 0}, {"s": 2, "f": 3}, {"s": 2, "f": 5}, {"s": 2, "f": 2}, {"s": 3, "f": 0}]},
    {id:'nat21',scale:'A Natural Minor',difficulty:'Advanced',notes:[{"s": 3, "f": 10}, {"s": 4, "f": 8}, {"s": 4, "f": 10}, {"s": 4, "f": 8}, {"s": 3, "f": 9}, {"s": 3, "f": 10}, {"s": 4, "f": 3}]},
    {id:'nat22',scale:'A Natural Minor',difficulty:'Beginner',notes:[{"s": 4, "f": 1}, {"s": 3, "f": 4}, {"s": 3, "f": 5}, {"s": 4, "f": 3}, {"s": 3, "f": 9}]},
    {id:'nat23',scale:'A Natural Minor',difficulty:'Intermediate',notes:[{"s": 1, "f": 3}, {"s": 1, "f": 0}, {"s": 2, "f": 9}, {"s": 1, "f": 3}, {"s": 0, "f": 5}, {"s": 0, "f": 8}]},
    {id:'nat24',scale:'A Natural Minor',difficulty:'Advanced',notes:[{"s": 1, "f": 0}, {"s": 0, "f": 7}, {"s": 1, "f": 5}, {"s": 1, "f": 3}, {"s": 0, "f": 10}, {"s": 1, "f": 2}, {"s": 2, "f": 10}, {"s": 2, "f": 7}]},
    {id:'nat25',scale:'A Natural Minor',difficulty:'Beginner',notes:[{"s": 4, "f": 1}, {"s": 3, "f": 2}, {"s": 3, "f": 0}, {"s": 2, "f": 2}, {"s": 2, "f": 5}]},
    {id:'nat26',scale:'E Natural Minor',difficulty:'Beginner',notes:[{"s": 3, "f": 9}, {"s": 3, "f": 11}, {"s": 4, "f": 5}, {"s": 4, "f": 7}, {"s": 4, "f": 10}, {"s": 4, "f": 7}]},
    {id:'nat27',scale:'E Natural Minor',difficulty:'Intermediate',notes:[{"s": 4, "f": 7}, {"s": 3, "f": 9}, {"s": 4, "f": 3}, {"s": 3, "f": 9}, {"s": 4, "f": 8}, {"s": 4, "f": 5}, {"s": 5, "f": 10}]},
    {id:'nat28',scale:'E Natural Minor',difficulty:'Advanced',notes:[{"s": 3, "f": 5}, {"s": 3, "f": 2}, {"s": 3, "f": 5}, {"s": 4, "f": 3}, {"s": 4, "f": 5}, {"s": 5, "f": 10}, {"s": 5, "f": 7}, {"s": 5, "f": 8}]},
    {id:'nat29',scale:'E Natural Minor',difficulty:'Beginner',notes:[{"s": 1, "f": 5}, {"s": 0, "f": 8}, {"s": 0, "f": 10}, {"s": 1, "f": 3}, {"s": 1, "f": 5}]},
    {id:'nat30',scale:'E Natural Minor',difficulty:'Intermediate',notes:[{"s": 1, "f": 7}, {"s": 1, "f": 10}, {"s": 1, "f": 9}, {"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 0, "f": 10}, {"s": 1, "f": 7}]},
    {id:'nat31',scale:'E Natural Minor',difficulty:'Advanced',notes:[{"s": 1, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 5}, {"s": 1, "f": 2}, {"s": 0, "f": 8}, {"s": 0, "f": 7}, {"s": 0, "f": 10}]},
    {id:'nat32',scale:'E Natural Minor',difficulty:'Beginner',notes:[{"s": 2, "f": 5}, {"s": 1, "f": 0}, {"s": 2, "f": 4}, {"s": 2, "f": 7}, {"s": 3, "f": 0}, {"s": 3, "f": 2}]},
    {id:'nat33',scale:'E Natural Minor',difficulty:'Intermediate',notes:[{"s": 1, "f": 3}, {"s": 0, "f": 7}, {"s": 1, "f": 3}, {"s": 2, "f": 7}, {"s": 2, "f": 5}, {"s": 1, "f": 0}, {"s": 2, "f": 10}]},
    {id:'nat34',scale:'E Natural Minor',difficulty:'Advanced',notes:[{"s": 1, "f": 5}, {"s": 0, "f": 7}, {"s": 1, "f": 5}, {"s": 1, "f": 7}, {"s": 0, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 9}]},
    {id:'nat35',scale:'E Natural Minor',difficulty:'Beginner',notes:[{"s": 5, "f": 8}, {"s": 5, "f": 10}, {"s": 4, "f": 5}, {"s": 5, "f": 10}, {"s": 5, "f": 8}, {"s": 4, "f": 0}]},
    {id:'nat36',scale:'E Natural Minor',difficulty:'Intermediate',notes:[{"s": 4, "f": 8}, {"s": 4, "f": 5}, {"s": 4, "f": 7}, {"s": 4, "f": 8}, {"s": 4, "f": 10}, {"s": 4, "f": 8}, {"s": 3, "f": 9}]},
    {id:'nat37',scale:'E Natural Minor',difficulty:'Advanced',notes:[{"s": 3, "f": 4}, {"s": 2, "f": 10}, {"s": 3, "f": 7}, {"s": 3, "f": 4}, {"s": 2, "f": 7}, {"s": 2, "f": 9}, {"s": 3, "f": 2}, {"s": 3, "f": 0}]},
    {id:'nat38',scale:'E Natural Minor',difficulty:'Beginner',notes:[{"s": 1, "f": 2}, {"s": 0, "f": 10}, {"s": 1, "f": 3}, {"s": 1, "f": 0}, {"s": 1, "f": 2}, {"s": 0, "f": 8}]},
    {id:'nat39',scale:'E Natural Minor',difficulty:'Intermediate',notes:[{"s": 2, "f": 2}, {"s": 2, "f": 0}, {"s": 2, "f": 2}, {"s": 3, "f": 0}, {"s": 2, "f": 2}, {"s": 2, "f": 0}, {"s": 2, "f": 2}]},
    {id:'nat40',scale:'E Natural Minor',difficulty:'Advanced',notes:[{"s": 3, "f": 4}, {"s": 4, "f": 3}, {"s": 5, "f": 7}, {"s": 4, "f": 1}, {"s": 3, "f": 2}, {"s": 3, "f": 4}, {"s": 3, "f": 5}, {"s": 2, "f": 7}]},
    {id:'nat41',scale:'E Natural Minor',difficulty:'Beginner',notes:[{"s": 1, "f": 3}, {"s": 1, "f": 5}, {"s": 2, "f": 10}, {"s": 2, "f": 7}, {"s": 1, "f": 2}]},
    {id:'nat42',scale:'E Natural Minor',difficulty:'Intermediate',notes:[{"s": 3, "f": 5}, {"s": 4, "f": 0}, {"s": 3, "f": 5}, {"s": 2, "f": 9}, {"s": 1, "f": 5}, {"s": 2, "f": 10}]},
    {id:'nat43',scale:'E Natural Minor',difficulty:'Advanced',notes:[{"s": 2, "f": 10}, {"s": 1, "f": 2}, {"s": 2, "f": 7}, {"s": 2, "f": 9}, {"s": 1, "f": 5}, {"s": 2, "f": 10}, {"s": 3, "f": 4}]},
    {id:'nat44',scale:'E Natural Minor',difficulty:'Beginner',notes:[{"s": 5, "f": 10}, {"s": 5, "f": 8}, {"s": 4, "f": 0}, {"s": 5, "f": 8}, {"s": 4, "f": 3}]},
    {id:'nat45',scale:'E Natural Minor',difficulty:'Intermediate',notes:[{"s": 2, "f": 10}, {"s": 1, "f": 0}, {"s": 0, "f": 7}, {"s": 1, "f": 5}, {"s": 0, "f": 7}, {"s": 0, "f": 10}, {"s": 1, "f": 7}]},
    {id:'nat46',scale:'E Natural Minor',difficulty:'Advanced',notes:[{"s": 0, "f": 5}, {"s": 0, "f": 7}, {"s": 1, "f": 3}, {"s": 2, "f": 7}, {"s": 2, "f": 5}, {"s": 2, "f": 7}, {"s": 2, "f": 9}]},
    {id:'nat47',scale:'E Natural Minor',difficulty:'Beginner',notes:[{"s": 0, "f": 7}, {"s": 1, "f": 3}, {"s": 2, "f": 7}, {"s": 2, "f": 4}, {"s": 2, "f": 5}, {"s": 2, "f": 7}]},
    {id:'nat48',scale:'E Natural Minor',difficulty:'Intermediate',notes:[{"s": 5, "f": 7}, {"s": 4, "f": 3}, {"s": 3, "f": 4}, {"s": 2, "f": 7}, {"s": 2, "f": 10}, {"s": 1, "f": 2}]},
    {id:'nat49',scale:'E Natural Minor',difficulty:'Advanced',notes:[{"s": 0, "f": 2}, {"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 0, "f": 7}, {"s": 0, "f": 5}, {"s": 0, "f": 3}]},
    {id:'nat50',scale:'E Natural Minor',difficulty:'Beginner',notes:[{"s": 2, "f": 0}, {"s": 2, "f": 2}, {"s": 2, "f": 4}, {"s": 2, "f": 5}, {"s": 2, "f": 7}, {"s": 1, "f": 3}]},
  ],
  'Major': [
    {id:'maj1',scale:'C Major',difficulty:'Beginner',notes:[{"s": 5, "f": 1}, {"s": 5, "f": 0}, {"s": 5, "f": 3}, {"s": 5, "f": 5}, {"s": 4, "f": 1}]},
    {id:'maj2',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 2, "f": 3}, {"s": 2, "f": 5}, {"s": 3, "f": 2}, {"s": 3, "f": 4}, {"s": 3, "f": 2}, {"s": 2, "f": 10}, {"s": 1, "f": 5}]},
    {id:'maj3',scale:'C Major',difficulty:'Advanced',notes:[{"s": 2, "f": 9}, {"s": 1, "f": 5}, {"s": 1, "f": 8}, {"s": 1, "f": 5}, {"s": 1, "f": 3}, {"s": 1, "f": 5}, {"s": 2, "f": 10}]},
    {id:'maj4',scale:'C Major',difficulty:'Beginner',notes:[{"s": 2, "f": 10}, {"s": 3, "f": 7}, {"s": 4, "f": 6}, {"s": 5, "f": 10}, {"s": 5, "f": 8}]},
    {id:'maj5',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 4, "f": 8}, {"s": 3, "f": 9}, {"s": 3, "f": 10}, {"s": 4, "f": 8}, {"s": 4, "f": 6}, {"s": 4, "f": 5}, {"s": 4, "f": 8}]},
    {id:'maj6',scale:'C Major',difficulty:'Advanced',notes:[{"s": 5, "f": 0}, {"s": 5, "f": 3}, {"s": 5, "f": 5}, {"s": 5, "f": 3}, {"s": 5, "f": 5}, {"s": 4, "f": 1}, {"s": 5, "f": 5}, {"s": 4, "f": 1}]},
    {id:'maj7',scale:'C Major',difficulty:'Beginner',notes:[{"s": 2, "f": 2}, {"s": 2, "f": 3}, {"s": 3, "f": 0}, {"s": 2, "f": 7}, {"s": 1, "f": 2}]},
    {id:'maj8',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 1, "f": 2}, {"s": 1, "f": 5}, {"s": 1, "f": 2}, {"s": 0, "f": 5}, {"s": 1, "f": 3}, {"s": 2, "f": 9}, {"s": 1, "f": 3}]},
    {id:'maj9',scale:'C Major',difficulty:'Advanced',notes:[{"s": 5, "f": 10}, {"s": 5, "f": 8}, {"s": 4, "f": 3}, {"s": 3, "f": 10}, {"s": 4, "f": 8}, {"s": 4, "f": 5}, {"s": 5, "f": 10}, {"s": 5, "f": 8}]},
    {id:'maj10',scale:'C Major',difficulty:'Beginner',notes:[{"s": 0, "f": 10}, {"s": 1, "f": 8}, {"s": 0, "f": 10}, {"s": 1, "f": 2}, {"s": 1, "f": 0}]},
    {id:'maj11',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 3, "f": 0}, {"s": 2, "f": 7}, {"s": 3, "f": 5}, {"s": 3, "f": 2}, {"s": 4, "f": 1}, {"s": 5, "f": 7}]},
    {id:'maj12',scale:'C Major',difficulty:'Advanced',notes:[{"s": 5, "f": 5}, {"s": 5, "f": 8}, {"s": 5, "f": 7}, {"s": 4, "f": 3}, {"s": 4, "f": 1}, {"s": 3, "f": 4}, {"s": 3, "f": 5}, {"s": 2, "f": 7}]},
    {id:'maj13',scale:'C Major',difficulty:'Beginner',notes:[{"s": 3, "f": 10}, {"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 4, "f": 1}, {"s": 4, "f": 3}, {"s": 3, "f": 10}]},
    {id:'maj14',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 5, "f": 8}, {"s": 5, "f": 10}, {"s": 5, "f": 7}, {"s": 4, "f": 1}, {"s": 5, "f": 10}, {"s": 4, "f": 6}, {"s": 4, "f": 3}]},
    {id:'maj15',scale:'C Major',difficulty:'Advanced',notes:[{"s": 4, "f": 10}, {"s": 4, "f": 8}, {"s": 4, "f": 10}, {"s": 4, "f": 8}, {"s": 4, "f": 5}, {"s": 5, "f": 10}, {"s": 5, "f": 7}]},
    {id:'maj16',scale:'C Major',difficulty:'Beginner',notes:[{"s": 4, "f": 6}, {"s": 3, "f": 9}, {"s": 4, "f": 3}, {"s": 4, "f": 5}, {"s": 4, "f": 3}]},
    {id:'maj17',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 4, "f": 0}, {"s": 5, "f": 5}, {"s": 5, "f": 7}, {"s": 5, "f": 8}, {"s": 5, "f": 7}, {"s": 5, "f": 5}]},
    {id:'maj18',scale:'C Major',difficulty:'Advanced',notes:[{"s": 1, "f": 0}, {"s": 2, "f": 10}, {"s": 3, "f": 7}, {"s": 3, "f": 9}, {"s": 3, "f": 7}, {"s": 3, "f": 5}, {"s": 3, "f": 7}]},
    {id:'maj19',scale:'C Major',difficulty:'Beginner',notes:[{"s": 3, "f": 4}, {"s": 2, "f": 10}, {"s": 1, "f": 2}, {"s": 0, "f": 8}, {"s": 1, "f": 5}, {"s": 2, "f": 9}]},
    {id:'maj20',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 1, "f": 2}, {"s": 1, "f": 3}, {"s": 2, "f": 7}, {"s": 2, "f": 10}, {"s": 3, "f": 7}, {"s": 3, "f": 10}]},
    {id:'maj21',scale:'C Major',difficulty:'Advanced',notes:[{"s": 5, "f": 5}, {"s": 4, "f": 0}, {"s": 3, "f": 7}, {"s": 4, "f": 1}, {"s": 4, "f": 3}, {"s": 3, "f": 4}, {"s": 3, "f": 5}, {"s": 2, "f": 9}]},
    {id:'maj22',scale:'C Major',difficulty:'Beginner',notes:[{"s": 3, "f": 4}, {"s": 3, "f": 2}, {"s": 3, "f": 0}, {"s": 2, "f": 3}, {"s": 3, "f": 0}]},
    {id:'maj23',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 0, "f": 7}, {"s": 0, "f": 10}, {"s": 1, "f": 7}, {"s": 1, "f": 5}, {"s": 0, "f": 8}, {"s": 1, "f": 5}, {"s": 0, "f": 7}]},
    {id:'maj24',scale:'C Major',difficulty:'Advanced',notes:[{"s": 0, "f": 1}, {"s": 0, "f": 0}, {"s": 0, "f": 3}, {"s": 0, "f": 1}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 0, "f": 7}, {"s": 1, "f": 5}]},
    {id:'maj25',scale:'C Major',difficulty:'Beginner',notes:[{"s": 2, "f": 10}, {"s": 1, "f": 2}, {"s": 0, "f": 5}, {"s": 1, "f": 2}, {"s": 2, "f": 7}, {"s": 2, "f": 9}]},
    {id:'maj26',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 1, "f": 5}, {"s": 0, "f": 8}, {"s": 0, "f": 7}, {"s": 0, "f": 5}, {"s": 1, "f": 3}, {"s": 0, "f": 10}]},
    {id:'maj27',scale:'C Major',difficulty:'Advanced',notes:[{"s": 4, "f": 10}, {"s": 4, "f": 8}, {"s": 3, "f": 10}, {"s": 4, "f": 8}, {"s": 3, "f": 10}, {"s": 4, "f": 8}, {"s": 3, "f": 10}]},
    {id:'maj28',scale:'C Major',difficulty:'Beginner',notes:[{"s": 3, "f": 4}, {"s": 2, "f": 7}, {"s": 3, "f": 5}, {"s": 3, "f": 4}, {"s": 3, "f": 2}, {"s": 3, "f": 0}]},
    {id:'maj29',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 0, "f": 8}, {"s": 1, "f": 0}, {"s": 1, "f": 2}, {"s": 1, "f": 0}, {"s": 1, "f": 2}, {"s": 0, "f": 10}, {"s": 1, "f": 3}]},
    {id:'maj30',scale:'C Major',difficulty:'Advanced',notes:[{"s": 3, "f": 0}, {"s": 2, "f": 2}, {"s": 2, "f": 3}, {"s": 2, "f": 5}, {"s": 1, "f": 0}, {"s": 2, "f": 5}, {"s": 3, "f": 2}, {"s": 2, "f": 9}]},
    {id:'maj31',scale:'C Major',difficulty:'Beginner',notes:[{"s": 0, "f": 1}, {"s": 0, "f": 3}, {"s": 1, "f": 0}, {"s": 1, "f": 2}, {"s": 1, "f": 0}]},
    {id:'maj32',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 1, "f": 7}, {"s": 0, "f": 10}, {"s": 0, "f": 7}, {"s": 1, "f": 5}, {"s": 1, "f": 7}, {"s": 1, "f": 8}, {"s": 0, "f": 10}]},
    {id:'maj33',scale:'C Major',difficulty:'Advanced',notes:[{"s": 5, "f": 8}, {"s": 5, "f": 7}, {"s": 4, "f": 3}, {"s": 3, "f": 5}, {"s": 3, "f": 7}, {"s": 2, "f": 9}, {"s": 3, "f": 2}]},
    {id:'maj34',scale:'C Major',difficulty:'Beginner',notes:[{"s": 4, "f": 5}, {"s": 4, "f": 6}, {"s": 5, "f": 10}, {"s": 4, "f": 1}, {"s": 5, "f": 7}, {"s": 5, "f": 8}]},
    {id:'maj35',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 5, "f": 7}, {"s": 4, "f": 3}, {"s": 4, "f": 5}, {"s": 4, "f": 6}, {"s": 3, "f": 9}, {"s": 3, "f": 10}]},
    {id:'maj36',scale:'C Major',difficulty:'Advanced',notes:[{"s": 5, "f": 10}, {"s": 4, "f": 0}, {"s": 4, "f": 1}, {"s": 5, "f": 10}, {"s": 4, "f": 6}, {"s": 5, "f": 10}, {"s": 4, "f": 0}, {"s": 3, "f": 5}]},
    {id:'maj37',scale:'C Major',difficulty:'Beginner',notes:[{"s": 0, "f": 7}, {"s": 0, "f": 5}, {"s": 0, "f": 7}, {"s": 1, "f": 5}, {"s": 1, "f": 8}]},
    {id:'maj38',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 3, "f": 10}, {"s": 3, "f": 7}, {"s": 2, "f": 9}, {"s": 3, "f": 2}, {"s": 2, "f": 5}, {"s": 2, "f": 3}]},
    {id:'maj39',scale:'C Major',difficulty:'Advanced',notes:[{"s": 1, "f": 7}, {"s": 1, "f": 5}, {"s": 1, "f": 7}, {"s": 1, "f": 10}, {"s": 1, "f": 8}, {"s": 0, "f": 10}, {"s": 1, "f": 3}]},
    {id:'maj40',scale:'C Major',difficulty:'Beginner',notes:[{"s": 4, "f": 5}, {"s": 3, "f": 7}, {"s": 3, "f": 5}, {"s": 3, "f": 7}, {"s": 4, "f": 5}]},
    {id:'maj41',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 2, "f": 0}, {"s": 2, "f": 3}, {"s": 3, "f": 0}, {"s": 2, "f": 2}, {"s": 2, "f": 5}, {"s": 2, "f": 2}, {"s": 2, "f": 3}]},
    {id:'maj42',scale:'C Major',difficulty:'Advanced',notes:[{"s": 0, "f": 10}, {"s": 0, "f": 8}, {"s": 0, "f": 5}, {"s": 0, "f": 7}, {"s": 0, "f": 5}, {"s": 0, "f": 3}, {"s": 0, "f": 5}, {"s": 1, "f": 3}]},
    {id:'maj43',scale:'C Major',difficulty:'Beginner',notes:[{"s": 1, "f": 2}, {"s": 0, "f": 8}, {"s": 0, "f": 5}, {"s": 1, "f": 3}, {"s": 0, "f": 5}]},
    {id:'maj44',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 0, "f": 5}, {"s": 1, "f": 2}, {"s": 0, "f": 8}, {"s": 0, "f": 5}, {"s": 0, "f": 8}, {"s": 0, "f": 7}]},
    {id:'maj45',scale:'C Major',difficulty:'Advanced',notes:[{"s": 5, "f": 8}, {"s": 4, "f": 3}, {"s": 3, "f": 9}, {"s": 3, "f": 7}, {"s": 3, "f": 5}, {"s": 2, "f": 7}, {"s": 1, "f": 2}, {"s": 0, "f": 5}]},
    {id:'maj46',scale:'C Major',difficulty:'Beginner',notes:[{"s": 1, "f": 3}, {"s": 1, "f": 0}, {"s": 2, "f": 10}, {"s": 3, "f": 2}, {"s": 3, "f": 0}]},
    {id:'maj47',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 5, "f": 10}, {"s": 4, "f": 6}, {"s": 3, "f": 7}, {"s": 3, "f": 9}, {"s": 3, "f": 7}, {"s": 3, "f": 10}]},
    {id:'maj48',scale:'C Major',difficulty:'Advanced',notes:[{"s": 4, "f": 6}, {"s": 3, "f": 7}, {"s": 4, "f": 6}, {"s": 5, "f": 10}, {"s": 4, "f": 1}, {"s": 5, "f": 7}, {"s": 5, "f": 5}]},
    {id:'maj49',scale:'C Major',difficulty:'Beginner',notes:[{"s": 1, "f": 10}, {"s": 1, "f": 8}, {"s": 1, "f": 5}, {"s": 0, "f": 7}, {"s": 0, "f": 5}]},
    {id:'maj50',scale:'C Major',difficulty:'Intermediate',notes:[{"s": 4, "f": 6}, {"s": 5, "f": 10}, {"s": 4, "f": 1}, {"s": 5, "f": 10}, {"s": 4, "f": 5}, {"s": 4, "f": 6}, {"s": 5, "f": 10}]},
  ],};

const DS_DATA = {
  'Minor Pentatonic': [
    {id:'ds_min1',scale:'A Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 2}], [{"s": 1, "f": 0}, {"s": 2, "f": 2}], [{"s": 1, "f": 7}, {"s": 2, "f": 0}]]},
    {id:'ds_min2',scale:'A Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 5}, {"s": 2, "f": 7}], [{"s": 1, "f": 7}, {"s": 2, "f": 2}], [{"s": 0, "f": 10}, {"s": 1, "f": 5}], [{"s": 0, "f": 3}, {"s": 1, "f": 7}], [{"s": 0, "f": 0}, {"s": 1, "f": 3}], [{"s": 0, "f": 0}, {"s": 1, "f": 3}]]},
    {id:'ds_min3',scale:'A Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 5}], [{"s": 2, "f": 0}, {"s": 3, "f": 7}], [{"s": 3, "f": 9}, {"s": 4, "f": 5}], [{"s": 2, "f": 7}, {"s": 3, "f": 9}], [{"s": 1, "f": 3}, {"s": 2, "f": 7}]]},
    {id:'ds_min4',scale:'A Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 0, "f": 8}, {"s": 1, "f": 10}], [{"s": 0, "f": 3}, {"s": 1, "f": 3}], [{"s": 1, "f": 0}, {"s": 2, "f": 7}]]},
    {id:'ds_min5',scale:'A Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 0, "f": 10}, {"s": 1, "f": 0}], [{"s": 1, "f": 0}, {"s": 2, "f": 2}], [{"s": 0, "f": 5}, {"s": 1, "f": 0}], [{"s": 1, "f": 7}, {"s": 2, "f": 10}], [{"s": 2, "f": 7}, {"s": 3, "f": 7}], [{"s": 2, "f": 5}, {"s": 3, "f": 7}]]},
    {id:'ds_min6',scale:'A Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 3, "f": 2}, {"s": 4, "f": 3}], [{"s": 2, "f": 7}, {"s": 3, "f": 9}], [{"s": 3, "f": 0}, {"s": 4, "f": 8}], [{"s": 4, "f": 3}, {"s": 5, "f": 5}], [{"s": 3, "f": 0}, {"s": 4, "f": 10}], [{"s": 2, "f": 5}, {"s": 3, "f": 0}]]},
    {id:'ds_min7',scale:'A Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 2, "f": 2}, {"s": 3, "f": 0}], [{"s": 2, "f": 7}, {"s": 3, "f": 0}], [{"s": 1, "f": 3}, {"s": 2, "f": 5}], [{"s": 0, "f": 10}, {"s": 1, "f": 5}]]},
    {id:'ds_min8',scale:'A Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 7}, {"s": 3, "f": 0}], [{"s": 2, "f": 10}, {"s": 3, "f": 9}], [{"s": 3, "f": 0}, {"s": 4, "f": 8}], [{"s": 4, "f": 10}, {"s": 5, "f": 0}]]},
    {id:'ds_min9',scale:'A Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 1, "f": 10}, {"s": 2, "f": 5}], [{"s": 0, "f": 3}, {"s": 1, "f": 0}], [{"s": 1, "f": 3}, {"s": 2, "f": 5}], [{"s": 0, "f": 0}, {"s": 1, "f": 0}], [{"s": 0, "f": 0}, {"s": 1, "f": 0}]]},
    {id:'ds_min10',scale:'A Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 7}], [{"s": 2, "f": 7}, {"s": 3, "f": 0}], [{"s": 3, "f": 0}, {"s": 4, "f": 3}]]},
    {id:'ds_min11',scale:'A Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 3, "f": 9}, {"s": 4, "f": 8}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}], [{"s": 3, "f": 0}, {"s": 4, "f": 3}], [{"s": 2, "f": 7}, {"s": 3, "f": 5}], [{"s": 2, "f": 0}, {"s": 3, "f": 2}], [{"s": 3, "f": 5}, {"s": 4, "f": 5}]]},
    {id:'ds_min12',scale:'A Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 1, "f": 10}, {"s": 2, "f": 0}], [{"s": 2, "f": 10}, {"s": 3, "f": 9}], [{"s": 1, "f": 3}, {"s": 2, "f": 7}], [{"s": 2, "f": 0}, {"s": 3, "f": 7}], [{"s": 2, "f": 0}, {"s": 3, "f": 0}], [{"s": 3, "f": 0}, {"s": 4, "f": 8}], [{"s": 3, "f": 9}, {"s": 4, "f": 5}]]},
    {id:'ds_min13',scale:'A Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 4, "f": 8}, {"s": 5, "f": 10}], [{"s": 4, "f": 3}, {"s": 5, "f": 0}], [{"s": 4, "f": 5}, {"s": 5, "f": 3}]]},
    {id:'ds_min14',scale:'A Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 0}], [{"s": 1, "f": 7}, {"s": 2, "f": 2}], [{"s": 0, "f": 3}, {"s": 1, "f": 5}], [{"s": 1, "f": 7}, {"s": 2, "f": 10}], [{"s": 1, "f": 5}, {"s": 2, "f": 2}], [{"s": 0, "f": 3}, {"s": 1, "f": 5}]]},
    {id:'ds_min15',scale:'A Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 0, "f": 0}, {"s": 1, "f": 0}], [{"s": 1, "f": 5}, {"s": 2, "f": 5}], [{"s": 2, "f": 5}, {"s": 3, "f": 9}], [{"s": 2, "f": 5}, {"s": 3, "f": 7}], [{"s": 1, "f": 0}, {"s": 2, "f": 7}], [{"s": 1, "f": 10}, {"s": 2, "f": 5}], [{"s": 1, "f": 5}, {"s": 2, "f": 2}], [{"s": 2, "f": 5}, {"s": 3, "f": 2}]]},
    {id:'ds_min16',scale:'A Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 7}], [{"s": 3, "f": 9}, {"s": 4, "f": 5}], [{"s": 3, "f": 5}, {"s": 4, "f": 3}], [{"s": 4, "f": 5}, {"s": 5, "f": 3}]]},
    {id:'ds_min17',scale:'A Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 10}, {"s": 2, "f": 7}], [{"s": 2, "f": 5}, {"s": 3, "f": 2}], [{"s": 1, "f": 5}, {"s": 2, "f": 2}], [{"s": 2, "f": 10}, {"s": 3, "f": 0}], [{"s": 3, "f": 0}, {"s": 4, "f": 10}], [{"s": 3, "f": 2}, {"s": 4, "f": 5}]]},
    {id:'ds_min18',scale:'E Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 4, "f": 0}, {"s": 5, "f": 5}], [{"s": 3, "f": 7}, {"s": 4, "f": 10}], [{"s": 4, "f": 8}, {"s": 5, "f": 3}]]},
    {id:'ds_min19',scale:'E Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 7}, {"s": 2, "f": 0}], [{"s": 1, "f": 7}, {"s": 2, "f": 7}], [{"s": 1, "f": 5}, {"s": 2, "f": 0}], [{"s": 2, "f": 9}, {"s": 3, "f": 9}]]},
    {id:'ds_min20',scale:'E Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 0, "f": 5}, {"s": 1, "f": 0}], [{"s": 0, "f": 7}, {"s": 1, "f": 2}], [{"s": 1, "f": 7}, {"s": 2, "f": 7}], [{"s": 0, "f": 7}, {"s": 1, "f": 10}], [{"s": 1, "f": 10}, {"s": 2, "f": 0}], [{"s": 0, "f": 5}, {"s": 1, "f": 7}], [{"s": 0, "f": 10}, {"s": 1, "f": 5}]]},
    {id:'ds_min21',scale:'E Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 4, "f": 10}, {"s": 5, "f": 7}], [{"s": 3, "f": 2}, {"s": 4, "f": 0}], [{"s": 4, "f": 0}, {"s": 5, "f": 0}], [{"s": 3, "f": 7}, {"s": 4, "f": 10}]]},
    {id:'ds_min22',scale:'E Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 3, "f": 2}, {"s": 4, "f": 3}], [{"s": 4, "f": 10}, {"s": 5, "f": 5}], [{"s": 4, "f": 10}, {"s": 5, "f": 10}], [{"s": 4, "f": 5}, {"s": 5, "f": 0}]]},
    {id:'ds_min23',scale:'E Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 0, "f": 5}, {"s": 1, "f": 10}], [{"s": 0, "f": 7}, {"s": 1, "f": 0}], [{"s": 1, "f": 2}, {"s": 2, "f": 2}], [{"s": 1, "f": 10}, {"s": 2, "f": 5}], [{"s": 0, "f": 5}, {"s": 1, "f": 5}]]},
    {id:'ds_min24',scale:'E Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 1, "f": 2}, {"s": 2, "f": 2}], [{"s": 2, "f": 0}, {"s": 3, "f": 4}], [{"s": 1, "f": 7}, {"s": 2, "f": 0}], [{"s": 0, "f": 3}, {"s": 1, "f": 5}]]},
    {id:'ds_min25',scale:'E Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 5}, {"s": 2, "f": 0}], [{"s": 0, "f": 5}, {"s": 1, "f": 5}], [{"s": 0, "f": 3}, {"s": 1, "f": 0}], [{"s": 1, "f": 0}, {"s": 2, "f": 7}]]},
    {id:'ds_min26',scale:'E Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 3, "f": 0}, {"s": 4, "f": 5}], [{"s": 4, "f": 8}, {"s": 5, "f": 0}], [{"s": 4, "f": 10}, {"s": 5, "f": 7}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}], [{"s": 3, "f": 9}, {"s": 4, "f": 10}]]},
    {id:'ds_min27',scale:'E Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 4, "f": 8}, {"s": 5, "f": 3}], [{"s": 3, "f": 7}, {"s": 4, "f": 10}], [{"s": 4, "f": 5}, {"s": 5, "f": 3}], [{"s": 3, "f": 0}, {"s": 4, "f": 10}]]},
    {id:'ds_min28',scale:'E Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 3, "f": 9}, {"s": 4, "f": 0}], [{"s": 4, "f": 5}, {"s": 5, "f": 10}], [{"s": 4, "f": 8}, {"s": 5, "f": 10}], [{"s": 3, "f": 0}, {"s": 4, "f": 0}]]},
    {id:'ds_min29',scale:'E Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 3, "f": 0}, {"s": 4, "f": 5}], [{"s": 4, "f": 0}, {"s": 5, "f": 0}], [{"s": 3, "f": 0}, {"s": 4, "f": 5}], [{"s": 4, "f": 5}, {"s": 5, "f": 7}], [{"s": 3, "f": 0}, {"s": 4, "f": 0}], [{"s": 2, "f": 2}, {"s": 3, "f": 0}]]},
    {id:'ds_min30',scale:'E Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 4, "f": 10}, {"s": 5, "f": 7}], [{"s": 3, "f": 7}, {"s": 4, "f": 3}], [{"s": 4, "f": 0}, {"s": 5, "f": 7}]]},
    {id:'ds_min31',scale:'E Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 3, "f": 4}, {"s": 4, "f": 8}], [{"s": 3, "f": 7}, {"s": 4, "f": 3}], [{"s": 2, "f": 5}, {"s": 3, "f": 7}], [{"s": 2, "f": 0}, {"s": 3, "f": 2}]]},
    {id:'ds_min32',scale:'E Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 1, "f": 5}, {"s": 2, "f": 2}], [{"s": 1, "f": 0}, {"s": 2, "f": 5}], [{"s": 2, "f": 9}, {"s": 3, "f": 7}], [{"s": 3, "f": 7}, {"s": 4, "f": 0}], [{"s": 2, "f": 0}, {"s": 3, "f": 7}], [{"s": 2, "f": 7}, {"s": 3, "f": 4}], [{"s": 1, "f": 5}, {"s": 2, "f": 7}]]},
    {id:'ds_min33',scale:'E Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 4, "f": 3}, {"s": 5, "f": 7}], [{"s": 3, "f": 4}, {"s": 4, "f": 8}], [{"s": 4, "f": 3}, {"s": 5, "f": 5}]]},
    {id:'ds_min34',scale:'E Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 4, "f": 10}, {"s": 5, "f": 0}], [{"s": 3, "f": 0}, {"s": 4, "f": 5}], [{"s": 4, "f": 3}, {"s": 5, "f": 7}], [{"s": 3, "f": 2}, {"s": 4, "f": 3}], [{"s": 4, "f": 0}, {"s": 5, "f": 0}], [{"s": 4, "f": 5}, {"s": 5, "f": 3}]]},
    {id:'ds_min35',scale:'D Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 5}], [{"s": 3, "f": 0}, {"s": 4, "f": 10}], [{"s": 4, "f": 1}, {"s": 5, "f": 1}], [{"s": 3, "f": 5}, {"s": 4, "f": 8}]]},
    {id:'ds_min36',scale:'D Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 4, "f": 3}, {"s": 5, "f": 5}], [{"s": 4, "f": 8}, {"s": 5, "f": 5}], [{"s": 3, "f": 5}, {"s": 4, "f": 8}], [{"s": 3, "f": 7}, {"s": 4, "f": 10}], [{"s": 4, "f": 8}, {"s": 5, "f": 8}], [{"s": 4, "f": 1}, {"s": 5, "f": 3}]]},
    {id:'ds_min37',scale:'D Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 4, "f": 8}, {"s": 5, "f": 5}], [{"s": 4, "f": 6}, {"s": 5, "f": 3}], [{"s": 4, "f": 6}, {"s": 5, "f": 8}], [{"s": 3, "f": 5}, {"s": 4, "f": 1}], [{"s": 2, "f": 0}, {"s": 3, "f": 2}]]},
    {id:'ds_min38',scale:'D Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 0, "f": 3}, {"s": 1, "f": 5}], [{"s": 1, "f": 8}, {"s": 2, "f": 3}], [{"s": 2, "f": 10}, {"s": 3, "f": 0}]]},
    {id:'ds_min39',scale:'D Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 10}, {"s": 3, "f": 5}], [{"s": 2, "f": 7}, {"s": 3, "f": 7}], [{"s": 1, "f": 8}, {"s": 2, "f": 3}], [{"s": 1, "f": 5}, {"s": 2, "f": 7}]]},
    {id:'ds_min40',scale:'D Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 1, "f": 3}, {"s": 2, "f": 0}], [{"s": 1, "f": 0}, {"s": 2, "f": 5}], [{"s": 2, "f": 10}, {"s": 3, "f": 10}], [{"s": 1, "f": 5}, {"s": 2, "f": 0}], [{"s": 1, "f": 3}, {"s": 2, "f": 3}], [{"s": 2, "f": 0}, {"s": 3, "f": 2}], [{"s": 2, "f": 5}, {"s": 3, "f": 2}], [{"s": 1, "f": 0}, {"s": 2, "f": 7}]]},
    {id:'ds_min41',scale:'D Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 2, "f": 3}, {"s": 3, "f": 5}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}], [{"s": 3, "f": 2}, {"s": 4, "f": 1}], [{"s": 2, "f": 5}, {"s": 3, "f": 10}]]},
    {id:'ds_min42',scale:'D Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 0, "f": 3}, {"s": 1, "f": 0}], [{"s": 1, "f": 0}, {"s": 2, "f": 3}], [{"s": 1, "f": 8}, {"s": 2, "f": 0}], [{"s": 2, "f": 0}, {"s": 3, "f": 7}]]},
    {id:'ds_min43',scale:'D Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 3, "f": 5}, {"s": 4, "f": 10}], [{"s": 2, "f": 10}, {"s": 3, "f": 5}], [{"s": 2, "f": 3}, {"s": 3, "f": 7}], [{"s": 2, "f": 5}, {"s": 3, "f": 10}], [{"s": 2, "f": 7}, {"s": 3, "f": 5}], [{"s": 2, "f": 7}, {"s": 3, "f": 0}], [{"s": 1, "f": 10}, {"s": 2, "f": 7}], [{"s": 1, "f": 0}, {"s": 2, "f": 10}]]},
    {id:'ds_min44',scale:'D Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 4, "f": 6}, {"s": 5, "f": 10}], [{"s": 4, "f": 3}, {"s": 5, "f": 3}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}]]},
    {id:'ds_min45',scale:'D Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 3}], [{"s": 1, "f": 5}, {"s": 2, "f": 5}], [{"s": 1, "f": 3}, {"s": 2, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 3}]]},
    {id:'ds_min46',scale:'D Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 1, "f": 8}, {"s": 2, "f": 10}], [{"s": 0, "f": 3}, {"s": 1, "f": 0}], [{"s": 0, "f": 3}, {"s": 1, "f": 0}], [{"s": 0, "f": 1}, {"s": 1, "f": 3}], [{"s": 1, "f": 10}, {"s": 2, "f": 10}], [{"s": 2, "f": 5}, {"s": 3, "f": 7}]]},
    {id:'ds_min47',scale:'D Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 5}], [{"s": 2, "f": 7}, {"s": 3, "f": 2}], [{"s": 1, "f": 5}, {"s": 2, "f": 5}]]},
    {id:'ds_min48',scale:'D Minor Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 8}, {"s": 2, "f": 10}], [{"s": 2, "f": 0}, {"s": 3, "f": 7}], [{"s": 1, "f": 0}, {"s": 2, "f": 3}], [{"s": 0, "f": 10}, {"s": 1, "f": 0}]]},
    {id:'ds_min49',scale:'D Minor Pentatonic',difficulty:'Advanced',pairs:[[{"s": 4, "f": 1}, {"s": 5, "f": 3}], [{"s": 4, "f": 3}, {"s": 5, "f": 8}], [{"s": 3, "f": 0}, {"s": 4, "f": 1}], [{"s": 4, "f": 6}, {"s": 5, "f": 5}], [{"s": 3, "f": 5}, {"s": 4, "f": 3}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}]]},
    {id:'ds_min50',scale:'D Minor Pentatonic',difficulty:'Beginner',pairs:[[{"s": 0, "f": 10}, {"s": 1, "f": 5}], [{"s": 1, "f": 8}, {"s": 2, "f": 5}], [{"s": 1, "f": 8}, {"s": 2, "f": 0}], [{"s": 2, "f": 7}, {"s": 3, "f": 10}]]},
  ],
  'Major Pentatonic': [
    {id:'ds_maj1',scale:'G Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 9}], [{"s": 1, "f": 5}, {"s": 2, "f": 7}], [{"s": 0, "f": 7}, {"s": 1, "f": 5}], [{"s": 0, "f": 5}, {"s": 1, "f": 5}]]},
    {id:'ds_maj2',scale:'G Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 7}], [{"s": 2, "f": 5}, {"s": 3, "f": 0}], [{"s": 2, "f": 5}, {"s": 3, "f": 7}], [{"s": 1, "f": 2}, {"s": 2, "f": 2}], [{"s": 2, "f": 7}, {"s": 3, "f": 2}]]},
    {id:'ds_maj3',scale:'G Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 4, "f": 10}, {"s": 5, "f": 0}], [{"s": 3, "f": 0}, {"s": 4, "f": 8}], [{"s": 2, "f": 5}, {"s": 3, "f": 9}], [{"s": 3, "f": 0}, {"s": 4, "f": 3}], [{"s": 2, "f": 5}, {"s": 3, "f": 2}], [{"s": 3, "f": 4}, {"s": 4, "f": 0}], [{"s": 2, "f": 7}, {"s": 3, "f": 7}]]},
    {id:'ds_maj4',scale:'G Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 3, "f": 0}, {"s": 4, "f": 8}], [{"s": 4, "f": 5}, {"s": 5, "f": 3}], [{"s": 4, "f": 0}, {"s": 5, "f": 0}]]},
    {id:'ds_maj5',scale:'G Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 0, "f": 0}, {"s": 1, "f": 10}], [{"s": 0, "f": 7}, {"s": 1, "f": 7}], [{"s": 1, "f": 10}, {"s": 2, "f": 9}], [{"s": 0, "f": 7}, {"s": 1, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 2}]]},
    {id:'ds_maj6',scale:'G Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 0, "f": 7}, {"s": 1, "f": 0}], [{"s": 1, "f": 5}, {"s": 2, "f": 2}], [{"s": 0, "f": 0}, {"s": 1, "f": 5}], [{"s": 1, "f": 10}, {"s": 2, "f": 5}], [{"s": 0, "f": 3}, {"s": 1, "f": 5}], [{"s": 1, "f": 5}, {"s": 2, "f": 5}], [{"s": 0, "f": 7}, {"s": 1, "f": 2}], [{"s": 0, "f": 0}, {"s": 1, "f": 5}]]},
    {id:'ds_maj7',scale:'G Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 0, "f": 5}, {"s": 1, "f": 10}], [{"s": 1, "f": 5}, {"s": 2, "f": 5}], [{"s": 0, "f": 5}, {"s": 1, "f": 5}]]},
    {id:'ds_maj8',scale:'G Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 7}, {"s": 3, "f": 0}], [{"s": 2, "f": 9}, {"s": 3, "f": 4}], [{"s": 1, "f": 0}, {"s": 2, "f": 0}], [{"s": 1, "f": 10}, {"s": 2, "f": 0}]]},
    {id:'ds_maj9',scale:'G Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 3, "f": 0}, {"s": 4, "f": 10}], [{"s": 4, "f": 8}, {"s": 5, "f": 7}], [{"s": 4, "f": 0}, {"s": 5, "f": 10}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}], [{"s": 2, "f": 2}, {"s": 3, "f": 7}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}]]},
    {id:'ds_maj10',scale:'G Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 0, "f": 0}, {"s": 1, "f": 10}], [{"s": 1, "f": 5}, {"s": 2, "f": 5}], [{"s": 0, "f": 7}, {"s": 1, "f": 10}], [{"s": 0, "f": 0}, {"s": 1, "f": 0}]]},
    {id:'ds_maj11',scale:'G Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 3, "f": 4}, {"s": 4, "f": 3}], [{"s": 4, "f": 0}, {"s": 5, "f": 7}], [{"s": 4, "f": 8}, {"s": 5, "f": 5}], [{"s": 4, "f": 10}, {"s": 5, "f": 5}]]},
    {id:'ds_maj12',scale:'G Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 3, "f": 4}, {"s": 4, "f": 8}], [{"s": 2, "f": 7}, {"s": 3, "f": 0}], [{"s": 3, "f": 0}, {"s": 4, "f": 0}], [{"s": 4, "f": 5}, {"s": 5, "f": 10}], [{"s": 3, "f": 2}, {"s": 4, "f": 5}], [{"s": 2, "f": 0}, {"s": 3, "f": 9}], [{"s": 3, "f": 9}, {"s": 4, "f": 0}], [{"s": 4, "f": 8}, {"s": 5, "f": 7}]]},
    {id:'ds_maj13',scale:'G Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 2, "f": 2}, {"s": 3, "f": 2}], [{"s": 1, "f": 0}, {"s": 2, "f": 0}], [{"s": 0, "f": 5}, {"s": 1, "f": 0}]]},
    {id:'ds_maj14',scale:'G Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 0, "f": 0}, {"s": 1, "f": 0}], [{"s": 1, "f": 7}, {"s": 2, "f": 0}], [{"s": 0, "f": 7}, {"s": 1, "f": 5}], [{"s": 0, "f": 7}, {"s": 1, "f": 0}], [{"s": 1, "f": 2}, {"s": 2, "f": 5}], [{"s": 2, "f": 7}, {"s": 3, "f": 0}]]},
    {id:'ds_maj15',scale:'G Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 1, "f": 7}, {"s": 2, "f": 2}], [{"s": 1, "f": 10}, {"s": 2, "f": 5}], [{"s": 0, "f": 0}, {"s": 1, "f": 2}], [{"s": 1, "f": 5}, {"s": 2, "f": 0}], [{"s": 2, "f": 9}, {"s": 3, "f": 0}], [{"s": 1, "f": 5}, {"s": 2, "f": 9}], [{"s": 0, "f": 5}, {"s": 1, "f": 10}], [{"s": 1, "f": 7}, {"s": 2, "f": 7}]]},
    {id:'ds_maj16',scale:'G Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 1, "f": 2}, {"s": 2, "f": 0}], [{"s": 1, "f": 2}, {"s": 2, "f": 7}], [{"s": 1, "f": 10}, {"s": 2, "f": 7}]]},
    {id:'ds_maj17',scale:'G Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 5}, {"s": 2, "f": 9}], [{"s": 0, "f": 5}, {"s": 1, "f": 10}], [{"s": 1, "f": 2}, {"s": 2, "f": 0}], [{"s": 1, "f": 7}, {"s": 2, "f": 0}], [{"s": 0, "f": 10}, {"s": 1, "f": 10}], [{"s": 0, "f": 7}, {"s": 1, "f": 2}]]},
    {id:'ds_maj18',scale:'G Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 3, "f": 0}, {"s": 4, "f": 3}], [{"s": 2, "f": 5}, {"s": 3, "f": 4}], [{"s": 2, "f": 7}, {"s": 3, "f": 4}], [{"s": 1, "f": 10}, {"s": 2, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 5}], [{"s": 1, "f": 10}, {"s": 2, "f": 5}]]},
    {id:'ds_maj19',scale:'G Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 1, "f": 10}, {"s": 2, "f": 9}], [{"s": 2, "f": 7}, {"s": 3, "f": 2}], [{"s": 3, "f": 4}, {"s": 4, "f": 0}]]},
    {id:'ds_maj20',scale:'G Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 3, "f": 7}, {"s": 4, "f": 5}], [{"s": 4, "f": 5}, {"s": 5, "f": 3}], [{"s": 4, "f": 8}, {"s": 5, "f": 5}], [{"s": 4, "f": 3}, {"s": 5, "f": 7}], [{"s": 3, "f": 0}, {"s": 4, "f": 0}], [{"s": 4, "f": 0}, {"s": 5, "f": 3}]]},
    {id:'ds_maj21',scale:'G Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 2, "f": 7}, {"s": 3, "f": 9}], [{"s": 1, "f": 0}, {"s": 2, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 2}], [{"s": 0, "f": 0}, {"s": 1, "f": 10}]]},
    {id:'ds_maj22',scale:'G Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 2, "f": 0}, {"s": 3, "f": 4}], [{"s": 3, "f": 4}, {"s": 4, "f": 5}], [{"s": 3, "f": 7}, {"s": 4, "f": 10}]]},
    {id:'ds_maj23',scale:'G Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 4, "f": 5}, {"s": 5, "f": 3}], [{"s": 3, "f": 7}, {"s": 4, "f": 0}], [{"s": 2, "f": 7}, {"s": 3, "f": 2}], [{"s": 3, "f": 4}, {"s": 4, "f": 0}]]},
    {id:'ds_maj24',scale:'G Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 2, "f": 9}, {"s": 3, "f": 9}], [{"s": 1, "f": 0}, {"s": 2, "f": 9}], [{"s": 2, "f": 7}, {"s": 3, "f": 9}], [{"s": 1, "f": 0}, {"s": 2, "f": 7}], [{"s": 0, "f": 5}, {"s": 1, "f": 2}], [{"s": 0, "f": 10}, {"s": 1, "f": 10}], [{"s": 1, "f": 10}, {"s": 2, "f": 5}], [{"s": 0, "f": 3}, {"s": 1, "f": 2}]]},
    {id:'ds_maj25',scale:'G Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 0, "f": 5}, {"s": 1, "f": 0}], [{"s": 0, "f": 3}, {"s": 1, "f": 5}], [{"s": 1, "f": 5}, {"s": 2, "f": 5}], [{"s": 1, "f": 10}, {"s": 2, "f": 5}]]},
    {id:'ds_maj26',scale:'C Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 4, "f": 8}, {"s": 5, "f": 10}], [{"s": 3, "f": 7}, {"s": 4, "f": 10}], [{"s": 3, "f": 5}, {"s": 4, "f": 1}], [{"s": 3, "f": 0}, {"s": 4, "f": 1}]]},
    {id:'ds_maj27',scale:'C Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 0}, {"s": 3, "f": 5}], [{"s": 2, "f": 10}, {"s": 3, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 7}], [{"s": 1, "f": 7}, {"s": 2, "f": 5}], [{"s": 1, "f": 5}, {"s": 2, "f": 2}], [{"s": 2, "f": 7}, {"s": 3, "f": 9}]]},
    {id:'ds_maj28',scale:'C Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 2, "f": 2}, {"s": 3, "f": 7}], [{"s": 1, "f": 7}, {"s": 2, "f": 7}], [{"s": 2, "f": 5}, {"s": 3, "f": 9}], [{"s": 2, "f": 0}, {"s": 3, "f": 7}], [{"s": 1, "f": 10}, {"s": 2, "f": 10}], [{"s": 1, "f": 5}, {"s": 2, "f": 2}], [{"s": 1, "f": 0}, {"s": 2, "f": 10}]]},
    {id:'ds_maj29',scale:'C Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 4, "f": 8}, {"s": 5, "f": 3}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}], [{"s": 3, "f": 9}, {"s": 4, "f": 5}]]},
    {id:'ds_maj30',scale:'C Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 4, "f": 3}, {"s": 5, "f": 0}], [{"s": 3, "f": 5}, {"s": 4, "f": 1}], [{"s": 4, "f": 1}, {"s": 5, "f": 5}], [{"s": 3, "f": 7}, {"s": 4, "f": 3}], [{"s": 3, "f": 7}, {"s": 4, "f": 10}], [{"s": 3, "f": 0}, {"s": 4, "f": 10}]]},
    {id:'ds_maj31',scale:'C Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 3, "f": 2}, {"s": 4, "f": 3}], [{"s": 3, "f": 5}, {"s": 4, "f": 10}], [{"s": 2, "f": 7}, {"s": 3, "f": 2}], [{"s": 2, "f": 5}, {"s": 3, "f": 5}], [{"s": 1, "f": 7}, {"s": 2, "f": 2}], [{"s": 2, "f": 0}, {"s": 3, "f": 0}], [{"s": 2, "f": 10}, {"s": 3, "f": 0}], [{"s": 3, "f": 2}, {"s": 4, "f": 5}]]},
    {id:'ds_maj32',scale:'C Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 4, "f": 8}, {"s": 5, "f": 0}], [{"s": 3, "f": 2}, {"s": 4, "f": 5}], [{"s": 4, "f": 3}, {"s": 5, "f": 8}], [{"s": 4, "f": 5}, {"s": 5, "f": 3}]]},
    {id:'ds_maj33',scale:'C Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 7}, {"s": 2, "f": 7}], [{"s": 2, "f": 2}, {"s": 3, "f": 7}], [{"s": 3, "f": 5}, {"s": 4, "f": 5}], [{"s": 3, "f": 7}, {"s": 4, "f": 5}], [{"s": 2, "f": 7}, {"s": 3, "f": 5}]]},
    {id:'ds_maj34',scale:'C Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 3, "f": 5}, {"s": 4, "f": 8}], [{"s": 3, "f": 9}, {"s": 4, "f": 8}], [{"s": 3, "f": 5}, {"s": 4, "f": 5}], [{"s": 2, "f": 10}, {"s": 3, "f": 5}], [{"s": 1, "f": 3}, {"s": 2, "f": 0}]]},
    {id:'ds_maj35',scale:'C Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 0, "f": 0}, {"s": 1, "f": 10}], [{"s": 1, "f": 7}, {"s": 2, "f": 10}], [{"s": 2, "f": 7}, {"s": 3, "f": 0}]]},
    {id:'ds_maj36',scale:'C Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 5}, {"s": 2, "f": 0}], [{"s": 1, "f": 5}, {"s": 2, "f": 10}], [{"s": 1, "f": 5}, {"s": 2, "f": 10}], [{"s": 0, "f": 0}, {"s": 1, "f": 7}]]},
    {id:'ds_maj37',scale:'C Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 0, "f": 10}, {"s": 1, "f": 5}], [{"s": 0, "f": 5}, {"s": 1, "f": 7}], [{"s": 0, "f": 8}, {"s": 1, "f": 0}], [{"s": 1, "f": 10}, {"s": 2, "f": 7}], [{"s": 2, "f": 5}, {"s": 3, "f": 2}], [{"s": 2, "f": 5}, {"s": 3, "f": 0}], [{"s": 2, "f": 5}, {"s": 3, "f": 0}]]},
    {id:'ds_maj38',scale:'C Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 3, "f": 9}, {"s": 4, "f": 5}], [{"s": 3, "f": 2}, {"s": 4, "f": 5}], [{"s": 4, "f": 10}, {"s": 5, "f": 8}], [{"s": 4, "f": 8}, {"s": 5, "f": 3}]]},
    {id:'ds_maj39',scale:'C Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 5}], [{"s": 1, "f": 3}, {"s": 2, "f": 2}], [{"s": 2, "f": 7}, {"s": 3, "f": 0}], [{"s": 1, "f": 7}, {"s": 2, "f": 10}], [{"s": 0, "f": 10}, {"s": 1, "f": 10}], [{"s": 1, "f": 5}, {"s": 2, "f": 10}]]},
    {id:'ds_maj40',scale:'C Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 1, "f": 5}, {"s": 2, "f": 2}], [{"s": 2, "f": 5}, {"s": 3, "f": 2}], [{"s": 2, "f": 2}, {"s": 3, "f": 5}], [{"s": 2, "f": 2}, {"s": 3, "f": 2}], [{"s": 2, "f": 0}, {"s": 3, "f": 7}], [{"s": 2, "f": 0}, {"s": 3, "f": 9}], [{"s": 1, "f": 5}, {"s": 2, "f": 7}]]},
    {id:'ds_maj41',scale:'C Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 2, "f": 0}, {"s": 3, "f": 2}], [{"s": 1, "f": 10}, {"s": 2, "f": 5}], [{"s": 0, "f": 10}, {"s": 1, "f": 7}]]},
    {id:'ds_maj42',scale:'C Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 4, "f": 10}, {"s": 5, "f": 10}], [{"s": 3, "f": 5}, {"s": 4, "f": 5}], [{"s": 4, "f": 5}, {"s": 5, "f": 3}], [{"s": 4, "f": 1}, {"s": 5, "f": 5}], [{"s": 4, "f": 3}, {"s": 5, "f": 5}], [{"s": 3, "f": 5}, {"s": 4, "f": 10}]]},
    {id:'ds_maj43',scale:'C Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 4, "f": 3}, {"s": 5, "f": 0}], [{"s": 4, "f": 5}, {"s": 5, "f": 5}], [{"s": 4, "f": 1}, {"s": 5, "f": 0}], [{"s": 4, "f": 8}, {"s": 5, "f": 3}], [{"s": 3, "f": 5}, {"s": 4, "f": 5}]]},
    {id:'ds_maj44',scale:'C Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 4, "f": 10}, {"s": 5, "f": 0}], [{"s": 4, "f": 5}, {"s": 5, "f": 0}], [{"s": 4, "f": 3}, {"s": 5, "f": 8}]]},
    {id:'ds_maj45',scale:'C Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 0, "f": 0}, {"s": 1, "f": 10}], [{"s": 1, "f": 7}, {"s": 2, "f": 0}], [{"s": 0, "f": 5}, {"s": 1, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 2}]]},
    {id:'ds_maj46',scale:'C Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 3, "f": 0}, {"s": 4, "f": 5}], [{"s": 2, "f": 10}, {"s": 3, "f": 7}], [{"s": 2, "f": 0}, {"s": 3, "f": 9}], [{"s": 3, "f": 5}, {"s": 4, "f": 5}], [{"s": 3, "f": 9}, {"s": 4, "f": 8}], [{"s": 4, "f": 10}, {"s": 5, "f": 5}]]},
    {id:'ds_maj47',scale:'C Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 2}], [{"s": 1, "f": 5}, {"s": 2, "f": 2}], [{"s": 2, "f": 5}, {"s": 3, "f": 7}], [{"s": 1, "f": 5}, {"s": 2, "f": 10}]]},
    {id:'ds_maj48',scale:'C Major Pentatonic',difficulty:'Intermediate',pairs:[[{"s": 0, "f": 8}, {"s": 1, "f": 3}], [{"s": 0, "f": 5}, {"s": 1, "f": 3}], [{"s": 1, "f": 10}, {"s": 2, "f": 7}], [{"s": 0, "f": 5}, {"s": 1, "f": 10}]]},
    {id:'ds_maj49',scale:'C Major Pentatonic',difficulty:'Advanced',pairs:[[{"s": 3, "f": 9}, {"s": 4, "f": 8}], [{"s": 4, "f": 8}, {"s": 5, "f": 5}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}], [{"s": 3, "f": 0}, {"s": 4, "f": 10}], [{"s": 3, "f": 0}, {"s": 4, "f": 1}], [{"s": 3, "f": 7}, {"s": 4, "f": 10}], [{"s": 3, "f": 5}, {"s": 4, "f": 3}]]},
    {id:'ds_maj50',scale:'C Major Pentatonic',difficulty:'Beginner',pairs:[[{"s": 4, "f": 5}, {"s": 5, "f": 5}], [{"s": 4, "f": 5}, {"s": 5, "f": 5}], [{"s": 3, "f": 2}, {"s": 4, "f": 3}], [{"s": 2, "f": 2}, {"s": 3, "f": 7}]]},
  ],
  'Blues': [
    {id:'ds_blu1',scale:'A Blues',difficulty:'Beginner',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 0}], [{"s": 2, "f": 2}, {"s": 3, "f": 5}], [{"s": 1, "f": 6}, {"s": 2, "f": 0}], [{"s": 0, "f": 8}, {"s": 1, "f": 3}]]},
    {id:'ds_blu2',scale:'A Blues',difficulty:'Intermediate',pairs:[[{"s": 3, "f": 2}, {"s": 4, "f": 5}], [{"s": 4, "f": 1}, {"s": 5, "f": 0}], [{"s": 3, "f": 5}, {"s": 4, "f": 10}], [{"s": 2, "f": 7}, {"s": 3, "f": 9}], [{"s": 2, "f": 0}, {"s": 3, "f": 7}], [{"s": 2, "f": 0}, {"s": 3, "f": 0}]]},
    {id:'ds_blu3',scale:'A Blues',difficulty:'Advanced',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 1}], [{"s": 1, "f": 7}, {"s": 2, "f": 10}], [{"s": 0, "f": 3}, {"s": 1, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 7}], [{"s": 1, "f": 0}, {"s": 2, "f": 5}], [{"s": 2, "f": 2}, {"s": 3, "f": 5}]]},
    {id:'ds_blu4',scale:'A Blues',difficulty:'Beginner',pairs:[[{"s": 0, "f": 8}, {"s": 1, "f": 10}], [{"s": 0, "f": 8}, {"s": 1, "f": 6}], [{"s": 1, "f": 5}, {"s": 2, "f": 0}], [{"s": 2, "f": 0}, {"s": 3, "f": 7}]]},
    {id:'ds_blu5',scale:'A Blues',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 7}, {"s": 3, "f": 8}], [{"s": 1, "f": 3}, {"s": 2, "f": 7}], [{"s": 1, "f": 3}, {"s": 2, "f": 5}], [{"s": 0, "f": 11}, {"s": 1, "f": 7}]]},
    {id:'ds_blu6',scale:'A Blues',difficulty:'Advanced',pairs:[[{"s": 3, "f": 8}, {"s": 4, "f": 10}], [{"s": 2, "f": 1}, {"s": 3, "f": 5}], [{"s": 1, "f": 6}, {"s": 2, "f": 1}], [{"s": 1, "f": 6}, {"s": 2, "f": 0}], [{"s": 1, "f": 0}, {"s": 2, "f": 0}], [{"s": 1, "f": 5}, {"s": 2, "f": 5}], [{"s": 2, "f": 7}, {"s": 3, "f": 2}]]},
    {id:'ds_blu7',scale:'A Blues',difficulty:'Beginner',pairs:[[{"s": 0, "f": 10}, {"s": 1, "f": 0}], [{"s": 1, "f": 7}, {"s": 2, "f": 2}], [{"s": 2, "f": 1}, {"s": 3, "f": 0}]]},
    {id:'ds_blu8',scale:'A Blues',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 2}], [{"s": 2, "f": 5}, {"s": 3, "f": 7}], [{"s": 1, "f": 7}, {"s": 2, "f": 2}], [{"s": 2, "f": 2}, {"s": 3, "f": 5}], [{"s": 2, "f": 1}, {"s": 3, "f": 5}], [{"s": 3, "f": 0}, {"s": 4, "f": 3}]]},
    {id:'ds_blu9',scale:'A Blues',difficulty:'Advanced',pairs:[[{"s": 4, "f": 3}, {"s": 5, "f": 3}], [{"s": 4, "f": 10}, {"s": 5, "f": 10}], [{"s": 4, "f": 8}, {"s": 5, "f": 3}], [{"s": 4, "f": 10}, {"s": 5, "f": 8}], [{"s": 3, "f": 2}, {"s": 4, "f": 5}], [{"s": 3, "f": 9}, {"s": 4, "f": 5}]]},
    {id:'ds_blu10',scale:'A Blues',difficulty:'Beginner',pairs:[[{"s": 2, "f": 10}, {"s": 3, "f": 0}], [{"s": 2, "f": 7}, {"s": 3, "f": 9}], [{"s": 1, "f": 7}, {"s": 2, "f": 2}]]},
    {id:'ds_blu11',scale:'A Blues',difficulty:'Intermediate',pairs:[[{"s": 0, "f": 8}, {"s": 1, "f": 3}], [{"s": 1, "f": 3}, {"s": 2, "f": 7}], [{"s": 0, "f": 5}, {"s": 1, "f": 0}], [{"s": 0, "f": 0}, {"s": 1, "f": 3}], [{"s": 1, "f": 6}, {"s": 2, "f": 10}], [{"s": 1, "f": 3}, {"s": 2, "f": 0}]]},
    {id:'ds_blu12',scale:'A Blues',difficulty:'Advanced',pairs:[[{"s": 1, "f": 6}, {"s": 2, "f": 5}], [{"s": 0, "f": 10}, {"s": 1, "f": 5}], [{"s": 1, "f": 5}, {"s": 2, "f": 1}], [{"s": 0, "f": 5}, {"s": 1, "f": 5}], [{"s": 1, "f": 5}, {"s": 2, "f": 10}], [{"s": 1, "f": 5}, {"s": 2, "f": 5}]]},
    {id:'ds_blu13',scale:'A Blues',difficulty:'Beginner',pairs:[[{"s": 3, "f": 8}, {"s": 4, "f": 4}], [{"s": 3, "f": 2}, {"s": 4, "f": 5}], [{"s": 2, "f": 0}, {"s": 3, "f": 7}], [{"s": 1, "f": 0}, {"s": 2, "f": 2}]]},
    {id:'ds_blu14',scale:'A Blues',difficulty:'Intermediate',pairs:[[{"s": 3, "f": 7}, {"s": 4, "f": 3}], [{"s": 2, "f": 5}, {"s": 3, "f": 8}], [{"s": 3, "f": 8}, {"s": 4, "f": 4}], [{"s": 4, "f": 8}, {"s": 5, "f": 10}], [{"s": 3, "f": 2}, {"s": 4, "f": 1}], [{"s": 2, "f": 10}, {"s": 3, "f": 7}]]},
    {id:'ds_blu15',scale:'A Blues',difficulty:'Advanced',pairs:[[{"s": 2, "f": 0}, {"s": 3, "f": 0}], [{"s": 1, "f": 10}, {"s": 2, "f": 5}], [{"s": 0, "f": 10}, {"s": 1, "f": 10}], [{"s": 0, "f": 3}, {"s": 1, "f": 3}], [{"s": 0, "f": 10}, {"s": 1, "f": 7}], [{"s": 1, "f": 3}, {"s": 2, "f": 7}], [{"s": 1, "f": 0}, {"s": 2, "f": 10}]]},
    {id:'ds_blu16',scale:'A Blues',difficulty:'Beginner',pairs:[[{"s": 3, "f": 0}, {"s": 4, "f": 10}], [{"s": 2, "f": 7}, {"s": 3, "f": 5}], [{"s": 1, "f": 3}, {"s": 2, "f": 0}]]},
    {id:'ds_blu17',scale:'A Blues',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 0}], [{"s": 2, "f": 5}, {"s": 3, "f": 7}], [{"s": 3, "f": 0}, {"s": 4, "f": 8}], [{"s": 3, "f": 5}, {"s": 4, "f": 8}]]},
    {id:'ds_blu18',scale:'A Blues',difficulty:'Advanced',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 7}], [{"s": 2, "f": 10}, {"s": 3, "f": 5}], [{"s": 1, "f": 7}, {"s": 2, "f": 7}], [{"s": 1, "f": 6}, {"s": 2, "f": 5}], [{"s": 2, "f": 7}, {"s": 3, "f": 0}], [{"s": 1, "f": 0}, {"s": 2, "f": 1}]]},
    {id:'ds_blu19',scale:'A Blues',difficulty:'Beginner',pairs:[[{"s": 2, "f": 7}, {"s": 3, "f": 0}], [{"s": 1, "f": 10}, {"s": 2, "f": 7}], [{"s": 2, "f": 5}, {"s": 3, "f": 8}], [{"s": 1, "f": 7}, {"s": 2, "f": 5}]]},
    {id:'ds_blu20',scale:'A Blues',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 7}], [{"s": 2, "f": 1}, {"s": 3, "f": 5}], [{"s": 2, "f": 5}, {"s": 3, "f": 8}], [{"s": 3, "f": 7}, {"s": 4, "f": 5}]]},
    {id:'ds_blu21',scale:'A Blues',difficulty:'Advanced',pairs:[[{"s": 1, "f": 10}, {"s": 2, "f": 7}], [{"s": 2, "f": 1}, {"s": 3, "f": 2}], [{"s": 3, "f": 5}, {"s": 4, "f": 10}], [{"s": 2, "f": 10}, {"s": 3, "f": 8}], [{"s": 1, "f": 0}, {"s": 2, "f": 7}], [{"s": 2, "f": 1}, {"s": 3, "f": 5}], [{"s": 2, "f": 1}, {"s": 3, "f": 0}]]},
    {id:'ds_blu22',scale:'A Blues',difficulty:'Beginner',pairs:[[{"s": 4, "f": 8}, {"s": 5, "f": 0}], [{"s": 3, "f": 7}, {"s": 4, "f": 5}], [{"s": 3, "f": 0}, {"s": 4, "f": 1}], [{"s": 4, "f": 4}, {"s": 5, "f": 5}]]},
    {id:'ds_blu23',scale:'A Blues',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 1}, {"s": 3, "f": 2}], [{"s": 3, "f": 5}, {"s": 4, "f": 5}], [{"s": 2, "f": 10}, {"s": 3, "f": 8}], [{"s": 1, "f": 3}, {"s": 2, "f": 0}], [{"s": 2, "f": 10}, {"s": 3, "f": 9}]]},
    {id:'ds_blu24',scale:'A Blues',difficulty:'Advanced',pairs:[[{"s": 1, "f": 7}, {"s": 2, "f": 7}], [{"s": 1, "f": 6}, {"s": 2, "f": 0}], [{"s": 0, "f": 8}, {"s": 1, "f": 0}], [{"s": 1, "f": 6}, {"s": 2, "f": 5}], [{"s": 2, "f": 7}, {"s": 3, "f": 7}], [{"s": 1, "f": 0}, {"s": 2, "f": 2}]]},
    {id:'ds_blu25',scale:'A Blues',difficulty:'Beginner',pairs:[[{"s": 3, "f": 5}, {"s": 4, "f": 10}], [{"s": 3, "f": 5}, {"s": 4, "f": 5}], [{"s": 4, "f": 1}, {"s": 5, "f": 3}]]},
    {id:'ds_blu26',scale:'E Blues',difficulty:'Beginner',pairs:[[{"s": 3, "f": 7}, {"s": 4, "f": 5}], [{"s": 2, "f": 8}, {"s": 3, "f": 9}], [{"s": 2, "f": 5}, {"s": 3, "f": 9}]]},
    {id:'ds_blu27',scale:'E Blues',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 10}, {"s": 2, "f": 8}], [{"s": 1, "f": 1}, {"s": 2, "f": 2}], [{"s": 1, "f": 0}, {"s": 2, "f": 9}], [{"s": 0, "f": 3}, {"s": 1, "f": 0}]]},
    {id:'ds_blu28',scale:'E Blues',difficulty:'Advanced',pairs:[[{"s": 2, "f": 2}, {"s": 3, "f": 7}], [{"s": 1, "f": 2}, {"s": 2, "f": 0}], [{"s": 1, "f": 2}, {"s": 2, "f": 0}], [{"s": 0, "f": 0}, {"s": 1, "f": 1}], [{"s": 1, "f": 10}, {"s": 2, "f": 0}]]},
    {id:'ds_blu29',scale:'E Blues',difficulty:'Beginner',pairs:[[{"s": 1, "f": 2}, {"s": 2, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 5}], [{"s": 2, "f": 7}, {"s": 3, "f": 7}], [{"s": 1, "f": 7}, {"s": 2, "f": 2}]]},
    {id:'ds_blu30',scale:'E Blues',difficulty:'Intermediate',pairs:[[{"s": 0, "f": 0}, {"s": 1, "f": 10}], [{"s": 1, "f": 7}, {"s": 2, "f": 8}], [{"s": 2, "f": 7}, {"s": 3, "f": 3}], [{"s": 2, "f": 5}, {"s": 3, "f": 9}], [{"s": 2, "f": 2}, {"s": 3, "f": 4}]]},
    {id:'ds_blu31',scale:'E Blues',difficulty:'Advanced',pairs:[[{"s": 2, "f": 9}, {"s": 3, "f": 0}], [{"s": 2, "f": 8}, {"s": 3, "f": 3}], [{"s": 3, "f": 2}, {"s": 4, "f": 5}], [{"s": 2, "f": 9}, {"s": 3, "f": 7}], [{"s": 2, "f": 8}, {"s": 3, "f": 0}], [{"s": 3, "f": 0}, {"s": 4, "f": 11}]]},
    {id:'ds_blu32',scale:'E Blues',difficulty:'Beginner',pairs:[[{"s": 2, "f": 2}, {"s": 3, "f": 3}], [{"s": 3, "f": 3}, {"s": 4, "f": 5}], [{"s": 4, "f": 5}, {"s": 5, "f": 5}], [{"s": 4, "f": 8}, {"s": 5, "f": 3}]]},
    {id:'ds_blu33',scale:'E Blues',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 5}, {"s": 2, "f": 9}], [{"s": 2, "f": 8}, {"s": 3, "f": 0}], [{"s": 3, "f": 0}, {"s": 4, "f": 0}], [{"s": 3, "f": 0}, {"s": 4, "f": 0}], [{"s": 2, "f": 5}, {"s": 3, "f": 0}], [{"s": 2, "f": 7}, {"s": 3, "f": 4}]]},
    {id:'ds_blu34',scale:'E Blues',difficulty:'Advanced',pairs:[[{"s": 4, "f": 11}, {"s": 5, "f": 10}], [{"s": 4, "f": 10}, {"s": 5, "f": 0}], [{"s": 4, "f": 3}, {"s": 5, "f": 3}], [{"s": 4, "f": 3}, {"s": 5, "f": 0}], [{"s": 4, "f": 0}, {"s": 5, "f": 3}]]},
    {id:'ds_blu35',scale:'E Blues',difficulty:'Beginner',pairs:[[{"s": 0, "f": 6}, {"s": 1, "f": 0}], [{"s": 1, "f": 0}, {"s": 2, "f": 8}], [{"s": 2, "f": 7}, {"s": 3, "f": 7}]]},
    {id:'ds_blu36',scale:'E Blues',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 8}], [{"s": 1, "f": 1}, {"s": 2, "f": 5}], [{"s": 0, "f": 5}, {"s": 1, "f": 0}], [{"s": 0, "f": 3}, {"s": 1, "f": 2}], [{"s": 1, "f": 7}, {"s": 2, "f": 9}], [{"s": 2, "f": 2}, {"s": 3, "f": 4}]]},
    {id:'ds_blu37',scale:'E Blues',difficulty:'Advanced',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 7}], [{"s": 0, "f": 0}, {"s": 1, "f": 0}], [{"s": 0, "f": 7}, {"s": 1, "f": 2}], [{"s": 1, "f": 2}, {"s": 2, "f": 2}], [{"s": 2, "f": 0}, {"s": 3, "f": 9}], [{"s": 1, "f": 10}, {"s": 2, "f": 0}], [{"s": 1, "f": 10}, {"s": 2, "f": 0}]]},
    {id:'ds_blu38',scale:'E Blues',difficulty:'Beginner',pairs:[[{"s": 3, "f": 0}, {"s": 4, "f": 5}], [{"s": 4, "f": 8}, {"s": 5, "f": 3}], [{"s": 3, "f": 2}, {"s": 4, "f": 5}], [{"s": 3, "f": 3}, {"s": 4, "f": 0}]]},
    {id:'ds_blu39',scale:'E Blues',difficulty:'Intermediate',pairs:[[{"s": 0, "f": 10}, {"s": 1, "f": 10}], [{"s": 0, "f": 7}, {"s": 1, "f": 10}], [{"s": 1, "f": 5}, {"s": 2, "f": 9}], [{"s": 0, "f": 7}, {"s": 1, "f": 5}], [{"s": 1, "f": 5}, {"s": 2, "f": 7}]]},
    {id:'ds_blu40',scale:'E Blues',difficulty:'Advanced',pairs:[[{"s": 4, "f": 8}, {"s": 5, "f": 3}], [{"s": 3, "f": 2}, {"s": 4, "f": 3}], [{"s": 3, "f": 9}, {"s": 4, "f": 8}], [{"s": 3, "f": 4}, {"s": 4, "f": 3}], [{"s": 4, "f": 11}, {"s": 5, "f": 6}]]},
    {id:'ds_blu41',scale:'E Blues',difficulty:'Beginner',pairs:[[{"s": 1, "f": 5}, {"s": 2, "f": 5}], [{"s": 2, "f": 5}, {"s": 3, "f": 0}], [{"s": 1, "f": 7}, {"s": 2, "f": 7}], [{"s": 2, "f": 2}, {"s": 3, "f": 7}]]},
    {id:'ds_blu42',scale:'E Blues',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 2}, {"s": 3, "f": 2}], [{"s": 1, "f": 5}, {"s": 2, "f": 7}], [{"s": 0, "f": 6}, {"s": 1, "f": 1}], [{"s": 1, "f": 2}, {"s": 2, "f": 5}], [{"s": 1, "f": 1}, {"s": 2, "f": 0}]]},
    {id:'ds_blu43',scale:'E Blues',difficulty:'Advanced',pairs:[[{"s": 4, "f": 3}, {"s": 5, "f": 5}], [{"s": 3, "f": 2}, {"s": 4, "f": 0}], [{"s": 3, "f": 7}, {"s": 4, "f": 10}], [{"s": 3, "f": 7}, {"s": 4, "f": 11}], [{"s": 4, "f": 8}, {"s": 5, "f": 5}]]},
    {id:'ds_blu44',scale:'E Blues',difficulty:'Beginner',pairs:[[{"s": 0, "f": 6}, {"s": 1, "f": 2}], [{"s": 0, "f": 5}, {"s": 1, "f": 5}], [{"s": 0, "f": 10}, {"s": 1, "f": 10}]]},
    {id:'ds_blu45',scale:'E Blues',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 7}, {"s": 2, "f": 5}], [{"s": 0, "f": 6}, {"s": 1, "f": 5}], [{"s": 0, "f": 3}, {"s": 1, "f": 0}], [{"s": 1, "f": 10}, {"s": 2, "f": 8}], [{"s": 0, "f": 3}, {"s": 1, "f": 1}], [{"s": 1, "f": 5}, {"s": 2, "f": 9}]]},
    {id:'ds_blu46',scale:'E Blues',difficulty:'Advanced',pairs:[[{"s": 2, "f": 8}, {"s": 3, "f": 7}], [{"s": 3, "f": 2}, {"s": 4, "f": 0}], [{"s": 2, "f": 8}, {"s": 3, "f": 0}], [{"s": 2, "f": 2}, {"s": 3, "f": 7}], [{"s": 2, "f": 5}, {"s": 3, "f": 4}], [{"s": 1, "f": 2}, {"s": 2, "f": 0}]]},
    {id:'ds_blu47',scale:'E Blues',difficulty:'Beginner',pairs:[[{"s": 0, "f": 5}, {"s": 1, "f": 10}], [{"s": 0, "f": 10}, {"s": 1, "f": 0}], [{"s": 1, "f": 0}, {"s": 2, "f": 5}], [{"s": 0, "f": 6}, {"s": 1, "f": 10}]]},
    {id:'ds_blu48',scale:'E Blues',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 7}, {"s": 3, "f": 2}], [{"s": 1, "f": 7}, {"s": 2, "f": 9}], [{"s": 0, "f": 3}, {"s": 1, "f": 7}], [{"s": 1, "f": 5}, {"s": 2, "f": 7}]]},
    {id:'ds_blu49',scale:'E Blues',difficulty:'Advanced',pairs:[[{"s": 3, "f": 0}, {"s": 4, "f": 8}], [{"s": 3, "f": 3}, {"s": 4, "f": 3}], [{"s": 4, "f": 8}, {"s": 5, "f": 3}], [{"s": 4, "f": 11}, {"s": 5, "f": 0}], [{"s": 4, "f": 10}, {"s": 5, "f": 10}], [{"s": 3, "f": 9}, {"s": 4, "f": 8}]]},
    {id:'ds_blu50',scale:'E Blues',difficulty:'Beginner',pairs:[[{"s": 2, "f": 0}, {"s": 3, "f": 2}], [{"s": 3, "f": 0}, {"s": 4, "f": 5}], [{"s": 2, "f": 9}, {"s": 3, "f": 0}]]},
  ],
  'Natural Minor': [
    {id:'ds_nat1',scale:'A Natural Minor',difficulty:'Beginner',pairs:[[{"s": 4, "f": 0}, {"s": 5, "f": 0}], [{"s": 4, "f": 1}, {"s": 5, "f": 0}], [{"s": 3, "f": 10}, {"s": 4, "f": 0}], [{"s": 4, "f": 5}, {"s": 5, "f": 5}]]},
    {id:'ds_nat2',scale:'A Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 0, "f": 0}, {"s": 1, "f": 3}], [{"s": 0, "f": 7}, {"s": 1, "f": 5}], [{"s": 0, "f": 5}, {"s": 1, "f": 0}], [{"s": 1, "f": 7}, {"s": 2, "f": 10}], [{"s": 0, "f": 7}, {"s": 1, "f": 10}], [{"s": 1, "f": 10}, {"s": 2, "f": 7}]]},
    {id:'ds_nat3',scale:'A Natural Minor',difficulty:'Advanced',pairs:[[{"s": 3, "f": 5}, {"s": 4, "f": 8}], [{"s": 3, "f": 10}, {"s": 4, "f": 6}], [{"s": 2, "f": 5}, {"s": 3, "f": 9}], [{"s": 3, "f": 7}, {"s": 4, "f": 5}], [{"s": 3, "f": 10}, {"s": 4, "f": 8}], [{"s": 2, "f": 3}, {"s": 3, "f": 7}]]},
    {id:'ds_nat4',scale:'A Natural Minor',difficulty:'Beginner',pairs:[[{"s": 4, "f": 0}, {"s": 5, "f": 7}], [{"s": 3, "f": 0}, {"s": 4, "f": 0}], [{"s": 4, "f": 5}, {"s": 5, "f": 8}], [{"s": 4, "f": 5}, {"s": 5, "f": 1}]]},
    {id:'ds_nat5',scale:'A Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 0, "f": 0}, {"s": 1, "f": 2}], [{"s": 1, "f": 0}, {"s": 2, "f": 10}], [{"s": 0, "f": 3}, {"s": 1, "f": 5}], [{"s": 1, "f": 3}, {"s": 2, "f": 5}], [{"s": 1, "f": 5}, {"s": 2, "f": 0}]]},
    {id:'ds_nat6',scale:'A Natural Minor',difficulty:'Advanced',pairs:[[{"s": 4, "f": 6}, {"s": 5, "f": 3}], [{"s": 4, "f": 5}, {"s": 5, "f": 1}], [{"s": 4, "f": 6}, {"s": 5, "f": 5}], [{"s": 3, "f": 10}, {"s": 4, "f": 6}], [{"s": 3, "f": 7}, {"s": 4, "f": 3}], [{"s": 3, "f": 9}, {"s": 4, "f": 6}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}], [{"s": 3, "f": 9}, {"s": 4, "f": 6}]]},
    {id:'ds_nat7',scale:'A Natural Minor',difficulty:'Beginner',pairs:[[{"s": 0, "f": 5}, {"s": 1, "f": 5}], [{"s": 0, "f": 10}, {"s": 1, "f": 0}], [{"s": 0, "f": 10}, {"s": 1, "f": 8}]]},
    {id:'ds_nat8',scale:'A Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 4, "f": 3}, {"s": 5, "f": 8}], [{"s": 3, "f": 7}, {"s": 4, "f": 0}], [{"s": 3, "f": 4}, {"s": 4, "f": 1}], [{"s": 2, "f": 9}, {"s": 3, "f": 9}]]},
    {id:'ds_nat9',scale:'A Natural Minor',difficulty:'Advanced',pairs:[[{"s": 2, "f": 2}, {"s": 3, "f": 7}], [{"s": 1, "f": 3}, {"s": 2, "f": 5}], [{"s": 0, "f": 10}, {"s": 1, "f": 5}], [{"s": 0, "f": 8}, {"s": 1, "f": 3}], [{"s": 0, "f": 3}, {"s": 1, "f": 3}], [{"s": 0, "f": 3}, {"s": 1, "f": 3}], [{"s": 1, "f": 3}, {"s": 2, "f": 5}]]},
    {id:'ds_nat10',scale:'A Natural Minor',difficulty:'Beginner',pairs:[[{"s": 4, "f": 0}, {"s": 5, "f": 1}], [{"s": 3, "f": 10}, {"s": 4, "f": 0}], [{"s": 4, "f": 1}, {"s": 5, "f": 1}]]},
    {id:'ds_nat11',scale:'A Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 3, "f": 4}, {"s": 4, "f": 0}], [{"s": 4, "f": 1}, {"s": 5, "f": 1}], [{"s": 3, "f": 0}, {"s": 4, "f": 1}], [{"s": 3, "f": 0}, {"s": 4, "f": 3}], [{"s": 3, "f": 0}, {"s": 4, "f": 0}], [{"s": 4, "f": 3}, {"s": 5, "f": 8}]]},
    {id:'ds_nat12',scale:'A Natural Minor',difficulty:'Advanced',pairs:[[{"s": 3, "f": 7}, {"s": 4, "f": 5}], [{"s": 4, "f": 0}, {"s": 5, "f": 5}], [{"s": 3, "f": 4}, {"s": 4, "f": 6}], [{"s": 2, "f": 0}, {"s": 3, "f": 2}], [{"s": 2, "f": 10}, {"s": 3, "f": 10}], [{"s": 2, "f": 9}, {"s": 3, "f": 9}], [{"s": 2, "f": 7}, {"s": 3, "f": 4}], [{"s": 2, "f": 10}, {"s": 3, "f": 10}]]},
    {id:'ds_nat13',scale:'A Natural Minor',difficulty:'Beginner',pairs:[[{"s": 0, "f": 10}, {"s": 1, "f": 0}], [{"s": 0, "f": 7}, {"s": 1, "f": 8}], [{"s": 1, "f": 5}, {"s": 2, "f": 10}], [{"s": 1, "f": 2}, {"s": 2, "f": 5}]]},
    {id:'ds_nat14',scale:'A Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 9}], [{"s": 1, "f": 8}, {"s": 2, "f": 3}], [{"s": 2, "f": 10}, {"s": 3, "f": 7}], [{"s": 2, "f": 10}, {"s": 3, "f": 7}]]},
    {id:'ds_nat15',scale:'A Natural Minor',difficulty:'Advanced',pairs:[[{"s": 3, "f": 4}, {"s": 4, "f": 5}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}], [{"s": 3, "f": 10}, {"s": 4, "f": 10}], [{"s": 4, "f": 5}, {"s": 5, "f": 5}], [{"s": 3, "f": 0}, {"s": 4, "f": 10}], [{"s": 4, "f": 0}, {"s": 5, "f": 5}]]},
    {id:'ds_nat16',scale:'A Natural Minor',difficulty:'Beginner',pairs:[[{"s": 1, "f": 3}, {"s": 2, "f": 0}], [{"s": 2, "f": 2}, {"s": 3, "f": 0}], [{"s": 1, "f": 8}, {"s": 2, "f": 3}], [{"s": 0, "f": 3}, {"s": 1, "f": 5}]]},
    {id:'ds_nat17',scale:'A Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 9}, {"s": 3, "f": 7}], [{"s": 1, "f": 3}, {"s": 2, "f": 0}], [{"s": 2, "f": 9}, {"s": 3, "f": 10}], [{"s": 2, "f": 0}, {"s": 3, "f": 2}], [{"s": 2, "f": 2}, {"s": 3, "f": 2}]]},
    {id:'ds_nat18',scale:'A Natural Minor',difficulty:'Advanced',pairs:[[{"s": 2, "f": 0}, {"s": 3, "f": 7}], [{"s": 3, "f": 2}, {"s": 4, "f": 0}], [{"s": 2, "f": 2}, {"s": 3, "f": 7}], [{"s": 3, "f": 0}, {"s": 4, "f": 10}], [{"s": 2, "f": 7}, {"s": 3, "f": 2}], [{"s": 1, "f": 7}, {"s": 2, "f": 10}], [{"s": 2, "f": 7}, {"s": 3, "f": 5}], [{"s": 1, "f": 5}, {"s": 2, "f": 0}]]},
    {id:'ds_nat19',scale:'A Natural Minor',difficulty:'Beginner',pairs:[[{"s": 0, "f": 5}, {"s": 1, "f": 3}], [{"s": 0, "f": 3}, {"s": 1, "f": 3}], [{"s": 0, "f": 0}, {"s": 1, "f": 3}], [{"s": 0, "f": 0}, {"s": 1, "f": 3}]]},
    {id:'ds_nat20',scale:'A Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 0}, {"s": 3, "f": 4}], [{"s": 1, "f": 7}, {"s": 2, "f": 9}], [{"s": 0, "f": 10}, {"s": 1, "f": 7}], [{"s": 1, "f": 7}, {"s": 2, "f": 7}]]},
    {id:'ds_nat21',scale:'A Natural Minor',difficulty:'Advanced',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 7}], [{"s": 1, "f": 8}, {"s": 2, "f": 0}], [{"s": 2, "f": 0}, {"s": 3, "f": 7}], [{"s": 2, "f": 10}, {"s": 3, "f": 10}], [{"s": 2, "f": 0}, {"s": 3, "f": 5}], [{"s": 1, "f": 5}, {"s": 2, "f": 2}], [{"s": 1, "f": 7}, {"s": 2, "f": 10}], [{"s": 1, "f": 10}, {"s": 2, "f": 0}]]},
    {id:'ds_nat22',scale:'A Natural Minor',difficulty:'Beginner',pairs:[[{"s": 1, "f": 2}, {"s": 2, "f": 0}], [{"s": 1, "f": 7}, {"s": 2, "f": 9}], [{"s": 1, "f": 8}, {"s": 2, "f": 3}], [{"s": 1, "f": 7}, {"s": 2, "f": 10}]]},
    {id:'ds_nat23',scale:'A Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 9}, {"s": 3, "f": 7}], [{"s": 1, "f": 10}, {"s": 2, "f": 10}], [{"s": 1, "f": 0}, {"s": 2, "f": 5}], [{"s": 0, "f": 5}, {"s": 1, "f": 8}], [{"s": 1, "f": 3}, {"s": 2, "f": 0}], [{"s": 2, "f": 2}, {"s": 3, "f": 7}]]},
    {id:'ds_nat24',scale:'A Natural Minor',difficulty:'Advanced',pairs:[[{"s": 0, "f": 1}, {"s": 1, "f": 3}], [{"s": 1, "f": 2}, {"s": 2, "f": 7}], [{"s": 1, "f": 10}, {"s": 2, "f": 7}], [{"s": 0, "f": 5}, {"s": 1, "f": 2}], [{"s": 0, "f": 5}, {"s": 1, "f": 10}]]},
    {id:'ds_nat25',scale:'A Natural Minor',difficulty:'Beginner',pairs:[[{"s": 1, "f": 5}, {"s": 2, "f": 9}], [{"s": 1, "f": 0}, {"s": 2, "f": 2}], [{"s": 2, "f": 0}, {"s": 3, "f": 0}]]},
    {id:'ds_nat26',scale:'E Natural Minor',difficulty:'Beginner',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 10}], [{"s": 2, "f": 4}, {"s": 3, "f": 4}], [{"s": 3, "f": 2}, {"s": 4, "f": 5}]]},
    {id:'ds_nat27',scale:'E Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 7}, {"s": 2, "f": 0}], [{"s": 0, "f": 3}, {"s": 1, "f": 7}], [{"s": 1, "f": 5}, {"s": 2, "f": 7}], [{"s": 1, "f": 2}, {"s": 2, "f": 7}], [{"s": 0, "f": 7}, {"s": 1, "f": 0}]]},
    {id:'ds_nat28',scale:'E Natural Minor',difficulty:'Advanced',pairs:[[{"s": 1, "f": 2}, {"s": 2, "f": 0}], [{"s": 0, "f": 3}, {"s": 1, "f": 2}], [{"s": 0, "f": 2}, {"s": 1, "f": 3}], [{"s": 0, "f": 7}, {"s": 1, "f": 10}], [{"s": 0, "f": 3}, {"s": 1, "f": 7}]]},
    {id:'ds_nat29',scale:'E Natural Minor',difficulty:'Beginner',pairs:[[{"s": 4, "f": 5}, {"s": 5, "f": 3}], [{"s": 4, "f": 8}, {"s": 5, "f": 7}], [{"s": 3, "f": 9}, {"s": 4, "f": 0}], [{"s": 2, "f": 0}, {"s": 3, "f": 9}]]},
    {id:'ds_nat30',scale:'E Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 2}, {"s": 2, "f": 4}], [{"s": 2, "f": 10}, {"s": 3, "f": 5}], [{"s": 3, "f": 0}, {"s": 4, "f": 3}], [{"s": 3, "f": 7}, {"s": 4, "f": 3}], [{"s": 2, "f": 7}, {"s": 3, "f": 4}]]},
    {id:'ds_nat31',scale:'E Natural Minor',difficulty:'Advanced',pairs:[[{"s": 4, "f": 10}, {"s": 5, "f": 10}], [{"s": 3, "f": 4}, {"s": 4, "f": 1}], [{"s": 3, "f": 2}, {"s": 4, "f": 7}], [{"s": 3, "f": 4}, {"s": 4, "f": 1}], [{"s": 3, "f": 7}, {"s": 4, "f": 3}]]},
    {id:'ds_nat32',scale:'E Natural Minor',difficulty:'Beginner',pairs:[[{"s": 1, "f": 2}, {"s": 2, "f": 0}], [{"s": 2, "f": 10}, {"s": 3, "f": 5}], [{"s": 2, "f": 10}, {"s": 3, "f": 0}]]},
    {id:'ds_nat33',scale:'E Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 3}, {"s": 2, "f": 5}], [{"s": 1, "f": 2}, {"s": 2, "f": 2}], [{"s": 1, "f": 10}, {"s": 2, "f": 5}], [{"s": 2, "f": 10}, {"s": 3, "f": 9}]]},
    {id:'ds_nat34',scale:'E Natural Minor',difficulty:'Advanced',pairs:[[{"s": 1, "f": 5}, {"s": 2, "f": 2}], [{"s": 0, "f": 0}, {"s": 1, "f": 7}], [{"s": 0, "f": 10}, {"s": 1, "f": 5}], [{"s": 1, "f": 5}, {"s": 2, "f": 10}], [{"s": 2, "f": 5}, {"s": 3, "f": 4}], [{"s": 1, "f": 9}, {"s": 2, "f": 10}], [{"s": 2, "f": 7}, {"s": 3, "f": 11}]]},
    {id:'ds_nat35',scale:'E Natural Minor',difficulty:'Beginner',pairs:[[{"s": 0, "f": 0}, {"s": 1, "f": 0}], [{"s": 1, "f": 2}, {"s": 2, "f": 5}], [{"s": 0, "f": 8}, {"s": 1, "f": 0}], [{"s": 0, "f": 10}, {"s": 1, "f": 0}]]},
    {id:'ds_nat36',scale:'E Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 10}, {"s": 3, "f": 9}], [{"s": 1, "f": 3}, {"s": 2, "f": 7}], [{"s": 0, "f": 7}, {"s": 1, "f": 10}], [{"s": 0, "f": 8}, {"s": 1, "f": 10}]]},
    {id:'ds_nat37',scale:'E Natural Minor',difficulty:'Advanced',pairs:[[{"s": 4, "f": 3}, {"s": 5, "f": 3}], [{"s": 4, "f": 0}, {"s": 5, "f": 2}], [{"s": 4, "f": 1}, {"s": 5, "f": 3}], [{"s": 4, "f": 3}, {"s": 5, "f": 2}], [{"s": 3, "f": 0}, {"s": 4, "f": 1}]]},
    {id:'ds_nat38',scale:'E Natural Minor',difficulty:'Beginner',pairs:[[{"s": 1, "f": 5}, {"s": 2, "f": 2}], [{"s": 0, "f": 5}, {"s": 1, "f": 5}], [{"s": 0, "f": 5}, {"s": 1, "f": 9}], [{"s": 0, "f": 7}, {"s": 1, "f": 3}]]},
    {id:'ds_nat39',scale:'E Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 4, "f": 10}, {"s": 5, "f": 10}], [{"s": 3, "f": 5}, {"s": 4, "f": 0}], [{"s": 3, "f": 4}, {"s": 4, "f": 1}], [{"s": 3, "f": 0}, {"s": 4, "f": 1}], [{"s": 4, "f": 3}, {"s": 5, "f": 2}]]},
    {id:'ds_nat40',scale:'E Natural Minor',difficulty:'Advanced',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 9}], [{"s": 1, "f": 0}, {"s": 2, "f": 10}], [{"s": 1, "f": 10}, {"s": 2, "f": 10}], [{"s": 0, "f": 3}, {"s": 1, "f": 2}], [{"s": 1, "f": 7}, {"s": 2, "f": 10}], [{"s": 1, "f": 7}, {"s": 2, "f": 7}], [{"s": 1, "f": 7}, {"s": 2, "f": 2}], [{"s": 1, "f": 7}, {"s": 2, "f": 5}]]},
    {id:'ds_nat41',scale:'E Natural Minor',difficulty:'Beginner',pairs:[[{"s": 2, "f": 9}, {"s": 3, "f": 5}], [{"s": 2, "f": 4}, {"s": 3, "f": 2}], [{"s": 3, "f": 4}, {"s": 4, "f": 0}], [{"s": 2, "f": 5}, {"s": 3, "f": 7}]]},
    {id:'ds_nat42',scale:'E Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 4, "f": 8}, {"s": 5, "f": 10}], [{"s": 4, "f": 0}, {"s": 5, "f": 10}], [{"s": 4, "f": 3}, {"s": 5, "f": 7}], [{"s": 3, "f": 7}, {"s": 4, "f": 0}], [{"s": 3, "f": 2}, {"s": 4, "f": 5}], [{"s": 3, "f": 11}, {"s": 4, "f": 7}]]},
    {id:'ds_nat43',scale:'E Natural Minor',difficulty:'Advanced',pairs:[[{"s": 0, "f": 3}, {"s": 1, "f": 3}], [{"s": 0, "f": 0}, {"s": 1, "f": 10}], [{"s": 1, "f": 10}, {"s": 2, "f": 10}], [{"s": 0, "f": 7}, {"s": 1, "f": 10}], [{"s": 0, "f": 2}, {"s": 1, "f": 3}], [{"s": 1, "f": 3}, {"s": 2, "f": 2}]]},
    {id:'ds_nat44',scale:'E Natural Minor',difficulty:'Beginner',pairs:[[{"s": 2, "f": 7}, {"s": 3, "f": 2}], [{"s": 1, "f": 2}, {"s": 2, "f": 4}], [{"s": 2, "f": 0}, {"s": 3, "f": 4}]]},
    {id:'ds_nat45',scale:'E Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 9}, {"s": 3, "f": 4}], [{"s": 2, "f": 9}, {"s": 3, "f": 0}], [{"s": 1, "f": 9}, {"s": 2, "f": 4}], [{"s": 0, "f": 2}, {"s": 1, "f": 2}], [{"s": 1, "f": 7}, {"s": 2, "f": 2}]]},
    {id:'ds_nat46',scale:'E Natural Minor',difficulty:'Advanced',pairs:[[{"s": 0, "f": 5}, {"s": 1, "f": 3}], [{"s": 0, "f": 10}, {"s": 1, "f": 7}], [{"s": 0, "f": 8}, {"s": 1, "f": 7}], [{"s": 0, "f": 0}, {"s": 1, "f": 0}], [{"s": 0, "f": 3}, {"s": 1, "f": 3}]]},
    {id:'ds_nat47',scale:'E Natural Minor',difficulty:'Beginner',pairs:[[{"s": 3, "f": 4}, {"s": 4, "f": 7}], [{"s": 4, "f": 8}, {"s": 5, "f": 10}], [{"s": 3, "f": 11}, {"s": 4, "f": 10}]]},
    {id:'ds_nat48',scale:'E Natural Minor',difficulty:'Intermediate',pairs:[[{"s": 0, "f": 8}, {"s": 1, "f": 3}], [{"s": 1, "f": 5}, {"s": 2, "f": 2}], [{"s": 2, "f": 9}, {"s": 3, "f": 9}], [{"s": 2, "f": 10}, {"s": 3, "f": 9}], [{"s": 1, "f": 7}, {"s": 2, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 4}]]},
    {id:'ds_nat49',scale:'E Natural Minor',difficulty:'Advanced',pairs:[[{"s": 2, "f": 0}, {"s": 3, "f": 9}], [{"s": 3, "f": 5}, {"s": 4, "f": 5}], [{"s": 4, "f": 5}, {"s": 5, "f": 10}], [{"s": 3, "f": 0}, {"s": 4, "f": 7}], [{"s": 2, "f": 4}, {"s": 3, "f": 7}], [{"s": 3, "f": 0}, {"s": 4, "f": 7}], [{"s": 3, "f": 7}, {"s": 4, "f": 10}], [{"s": 2, "f": 7}, {"s": 3, "f": 9}]]},
    {id:'ds_nat50',scale:'E Natural Minor',difficulty:'Beginner',pairs:[[{"s": 2, "f": 4}, {"s": 3, "f": 2}], [{"s": 3, "f": 4}, {"s": 4, "f": 1}], [{"s": 2, "f": 9}, {"s": 3, "f": 4}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}]]},
  ],
  'Major': [
    {id:'ds_maj1',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 1, "f": 7}, {"s": 2, "f": 9}], [{"s": 1, "f": 5}, {"s": 2, "f": 0}], [{"s": 0, "f": 10}, {"s": 1, "f": 8}], [{"s": 0, "f": 0}, {"s": 1, "f": 3}]]},
    {id:'ds_maj2',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 3, "f": 0}, {"s": 4, "f": 10}], [{"s": 3, "f": 0}, {"s": 4, "f": 3}], [{"s": 4, "f": 10}, {"s": 5, "f": 0}], [{"s": 4, "f": 5}, {"s": 5, "f": 0}]]},
    {id:'ds_maj3',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 7}], [{"s": 0, "f": 0}, {"s": 1, "f": 3}], [{"s": 0, "f": 8}, {"s": 1, "f": 10}], [{"s": 0, "f": 3}, {"s": 1, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 10}], [{"s": 2, "f": 5}, {"s": 3, "f": 2}]]},
    {id:'ds_maj4',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 2, "f": 0}, {"s": 3, "f": 0}], [{"s": 2, "f": 10}, {"s": 3, "f": 0}], [{"s": 2, "f": 9}, {"s": 3, "f": 7}]]},
    {id:'ds_maj5',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 3}, {"s": 3, "f": 7}], [{"s": 1, "f": 3}, {"s": 2, "f": 7}], [{"s": 0, "f": 1}, {"s": 1, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 3}]]},
    {id:'ds_maj6',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 3, "f": 2}, {"s": 4, "f": 3}], [{"s": 2, "f": 2}, {"s": 3, "f": 4}], [{"s": 1, "f": 8}, {"s": 2, "f": 0}], [{"s": 2, "f": 0}, {"s": 3, "f": 0}], [{"s": 2, "f": 7}, {"s": 3, "f": 5}], [{"s": 1, "f": 3}, {"s": 2, "f": 7}]]},
    {id:'ds_maj7',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 4, "f": 3}, {"s": 5, "f": 5}], [{"s": 4, "f": 5}, {"s": 5, "f": 8}], [{"s": 3, "f": 5}, {"s": 4, "f": 8}], [{"s": 3, "f": 4}, {"s": 4, "f": 6}]]},
    {id:'ds_maj8',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 10}], [{"s": 0, "f": 5}, {"s": 1, "f": 7}], [{"s": 0, "f": 3}, {"s": 1, "f": 7}], [{"s": 0, "f": 0}, {"s": 1, "f": 2}], [{"s": 1, "f": 0}, {"s": 2, "f": 0}], [{"s": 0, "f": 10}, {"s": 1, "f": 0}]]},
    {id:'ds_maj9',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 0, "f": 0}, {"s": 1, "f": 0}], [{"s": 0, "f": 1}, {"s": 1, "f": 2}], [{"s": 1, "f": 7}, {"s": 2, "f": 9}], [{"s": 1, "f": 0}, {"s": 2, "f": 9}], [{"s": 1, "f": 3}, {"s": 2, "f": 7}], [{"s": 0, "f": 10}, {"s": 1, "f": 8}]]},
    {id:'ds_maj10',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 0, "f": 10}, {"s": 1, "f": 5}], [{"s": 0, "f": 8}, {"s": 1, "f": 8}], [{"s": 0, "f": 5}, {"s": 1, "f": 3}], [{"s": 0, "f": 3}, {"s": 1, "f": 2}]]},
    {id:'ds_maj11',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 4, "f": 6}, {"s": 5, "f": 7}], [{"s": 4, "f": 0}, {"s": 5, "f": 0}], [{"s": 4, "f": 6}, {"s": 5, "f": 1}], [{"s": 3, "f": 4}, {"s": 4, "f": 6}]]},
    {id:'ds_maj12',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 3, "f": 4}, {"s": 4, "f": 3}], [{"s": 3, "f": 7}, {"s": 4, "f": 6}], [{"s": 2, "f": 9}, {"s": 3, "f": 5}], [{"s": 3, "f": 2}, {"s": 4, "f": 0}], [{"s": 2, "f": 5}, {"s": 3, "f": 7}]]},
    {id:'ds_maj13',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 2, "f": 9}, {"s": 3, "f": 10}], [{"s": 3, "f": 7}, {"s": 4, "f": 6}], [{"s": 2, "f": 2}, {"s": 3, "f": 7}], [{"s": 3, "f": 2}, {"s": 4, "f": 0}]]},
    {id:'ds_maj14',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 7}, {"s": 2, "f": 10}], [{"s": 1, "f": 7}, {"s": 2, "f": 5}], [{"s": 2, "f": 5}, {"s": 3, "f": 7}], [{"s": 2, "f": 2}, {"s": 3, "f": 0}]]},
    {id:'ds_maj15',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 1, "f": 2}, {"s": 2, "f": 3}], [{"s": 2, "f": 2}, {"s": 3, "f": 4}], [{"s": 3, "f": 4}, {"s": 4, "f": 6}], [{"s": 3, "f": 4}, {"s": 4, "f": 5}], [{"s": 3, "f": 4}, {"s": 4, "f": 3}], [{"s": 2, "f": 10}, {"s": 3, "f": 5}]]},
    {id:'ds_maj16',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 1, "f": 7}, {"s": 2, "f": 5}], [{"s": 0, "f": 3}, {"s": 1, "f": 3}], [{"s": 0, "f": 3}, {"s": 1, "f": 8}]]},
    {id:'ds_maj17',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 0, "f": 3}, {"s": 1, "f": 3}], [{"s": 1, "f": 2}, {"s": 2, "f": 5}], [{"s": 1, "f": 8}, {"s": 2, "f": 10}], [{"s": 2, "f": 3}, {"s": 3, "f": 2}], [{"s": 2, "f": 7}, {"s": 3, "f": 5}]]},
    {id:'ds_maj18',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 0, "f": 8}, {"s": 1, "f": 5}], [{"s": 1, "f": 8}, {"s": 2, "f": 7}], [{"s": 0, "f": 7}, {"s": 1, "f": 7}], [{"s": 1, "f": 7}, {"s": 2, "f": 10}], [{"s": 0, "f": 3}, {"s": 1, "f": 0}]]},
    {id:'ds_maj19',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 4, "f": 8}, {"s": 5, "f": 3}], [{"s": 4, "f": 6}, {"s": 5, "f": 8}], [{"s": 4, "f": 5}, {"s": 5, "f": 3}]]},
    {id:'ds_maj20',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 3, "f": 10}, {"s": 4, "f": 5}], [{"s": 2, "f": 0}, {"s": 3, "f": 7}], [{"s": 3, "f": 2}, {"s": 4, "f": 0}], [{"s": 3, "f": 5}, {"s": 4, "f": 5}], [{"s": 2, "f": 5}, {"s": 3, "f": 5}], [{"s": 3, "f": 4}, {"s": 4, "f": 6}]]},
    {id:'ds_maj21',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 2}], [{"s": 1, "f": 7}, {"s": 2, "f": 9}], [{"s": 1, "f": 7}, {"s": 2, "f": 10}], [{"s": 2, "f": 7}, {"s": 3, "f": 10}], [{"s": 2, "f": 5}, {"s": 3, "f": 0}], [{"s": 1, "f": 8}, {"s": 2, "f": 7}], [{"s": 1, "f": 10}, {"s": 2, "f": 5}], [{"s": 0, "f": 5}, {"s": 1, "f": 2}]]},
    {id:'ds_maj22',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 3, "f": 5}, {"s": 4, "f": 5}], [{"s": 3, "f": 9}, {"s": 4, "f": 8}], [{"s": 4, "f": 6}, {"s": 5, "f": 1}]]},
    {id:'ds_maj23',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 8}, {"s": 2, "f": 7}], [{"s": 0, "f": 1}, {"s": 1, "f": 0}], [{"s": 0, "f": 7}, {"s": 1, "f": 3}], [{"s": 0, "f": 8}, {"s": 1, "f": 8}], [{"s": 1, "f": 8}, {"s": 2, "f": 10}], [{"s": 1, "f": 5}, {"s": 2, "f": 0}]]},
    {id:'ds_maj24',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 1, "f": 7}, {"s": 2, "f": 3}], [{"s": 0, "f": 1}, {"s": 1, "f": 2}], [{"s": 1, "f": 0}, {"s": 2, "f": 9}], [{"s": 2, "f": 7}, {"s": 3, "f": 9}], [{"s": 2, "f": 0}, {"s": 3, "f": 2}], [{"s": 1, "f": 2}, {"s": 2, "f": 5}]]},
    {id:'ds_maj25',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 3, "f": 7}, {"s": 4, "f": 5}], [{"s": 2, "f": 0}, {"s": 3, "f": 9}], [{"s": 2, "f": 0}, {"s": 3, "f": 0}]]},
    {id:'ds_maj26',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 9}, {"s": 3, "f": 10}], [{"s": 2, "f": 5}, {"s": 3, "f": 5}], [{"s": 3, "f": 10}, {"s": 4, "f": 0}], [{"s": 3, "f": 0}, {"s": 4, "f": 3}], [{"s": 3, "f": 5}, {"s": 4, "f": 8}]]},
    {id:'ds_maj27',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 0, "f": 5}, {"s": 1, "f": 10}], [{"s": 1, "f": 5}, {"s": 2, "f": 7}], [{"s": 1, "f": 0}, {"s": 2, "f": 2}], [{"s": 0, "f": 7}, {"s": 1, "f": 10}], [{"s": 1, "f": 2}, {"s": 2, "f": 2}], [{"s": 1, "f": 3}, {"s": 2, "f": 3}]]},
    {id:'ds_maj28',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 0, "f": 3}, {"s": 1, "f": 0}], [{"s": 0, "f": 8}, {"s": 1, "f": 3}], [{"s": 1, "f": 0}, {"s": 2, "f": 0}], [{"s": 2, "f": 10}, {"s": 3, "f": 0}]]},
    {id:'ds_maj29',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 10}, {"s": 2, "f": 9}], [{"s": 1, "f": 5}, {"s": 2, "f": 10}], [{"s": 0, "f": 1}, {"s": 1, "f": 5}], [{"s": 1, "f": 0}, {"s": 2, "f": 2}]]},
    {id:'ds_maj30',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 0, "f": 10}, {"s": 1, "f": 0}], [{"s": 1, "f": 7}, {"s": 2, "f": 0}], [{"s": 1, "f": 5}, {"s": 2, "f": 0}], [{"s": 2, "f": 7}, {"s": 3, "f": 4}], [{"s": 2, "f": 7}, {"s": 3, "f": 0}]]},
    {id:'ds_maj31',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 4, "f": 8}, {"s": 5, "f": 8}], [{"s": 4, "f": 5}, {"s": 5, "f": 3}], [{"s": 4, "f": 6}, {"s": 5, "f": 8}], [{"s": 4, "f": 5}, {"s": 5, "f": 8}]]},
    {id:'ds_maj32',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 2}, {"s": 3, "f": 4}], [{"s": 2, "f": 9}, {"s": 3, "f": 9}], [{"s": 3, "f": 0}, {"s": 4, "f": 8}], [{"s": 3, "f": 9}, {"s": 4, "f": 5}]]},
    {id:'ds_maj33',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 3}], [{"s": 1, "f": 5}, {"s": 2, "f": 7}], [{"s": 0, "f": 5}, {"s": 1, "f": 5}], [{"s": 0, "f": 3}, {"s": 1, "f": 5}], [{"s": 0, "f": 10}, {"s": 1, "f": 8}], [{"s": 0, "f": 8}, {"s": 1, "f": 8}]]},
    {id:'ds_maj34',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 4, "f": 5}, {"s": 5, "f": 8}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}], [{"s": 4, "f": 3}, {"s": 5, "f": 1}], [{"s": 3, "f": 0}, {"s": 4, "f": 3}]]},
    {id:'ds_maj35',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 10}], [{"s": 0, "f": 7}, {"s": 1, "f": 5}], [{"s": 1, "f": 2}, {"s": 2, "f": 3}], [{"s": 2, "f": 0}, {"s": 3, "f": 7}], [{"s": 2, "f": 0}, {"s": 3, "f": 0}]]},
    {id:'ds_maj36',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 3, "f": 0}, {"s": 4, "f": 8}], [{"s": 4, "f": 3}, {"s": 5, "f": 1}], [{"s": 3, "f": 7}, {"s": 4, "f": 3}], [{"s": 2, "f": 7}, {"s": 3, "f": 5}], [{"s": 3, "f": 0}, {"s": 4, "f": 8}], [{"s": 2, "f": 3}, {"s": 3, "f": 4}], [{"s": 3, "f": 5}, {"s": 4, "f": 3}], [{"s": 2, "f": 9}, {"s": 3, "f": 9}]]},
    {id:'ds_maj37',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 2, "f": 10}, {"s": 3, "f": 5}], [{"s": 2, "f": 7}, {"s": 3, "f": 10}], [{"s": 2, "f": 2}, {"s": 3, "f": 4}]]},
    {id:'ds_maj38',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 3, "f": 0}, {"s": 4, "f": 1}], [{"s": 3, "f": 7}, {"s": 4, "f": 0}], [{"s": 3, "f": 4}, {"s": 4, "f": 6}], [{"s": 4, "f": 6}, {"s": 5, "f": 10}], [{"s": 4, "f": 1}, {"s": 5, "f": 0}]]},
    {id:'ds_maj39',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 1, "f": 0}, {"s": 2, "f": 0}], [{"s": 1, "f": 10}, {"s": 2, "f": 9}], [{"s": 1, "f": 10}, {"s": 2, "f": 9}], [{"s": 1, "f": 0}, {"s": 2, "f": 0}], [{"s": 1, "f": 2}, {"s": 2, "f": 7}], [{"s": 0, "f": 3}, {"s": 1, "f": 7}], [{"s": 1, "f": 3}, {"s": 2, "f": 2}], [{"s": 1, "f": 3}, {"s": 2, "f": 5}]]},
    {id:'ds_maj40',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 3, "f": 7}, {"s": 4, "f": 6}], [{"s": 4, "f": 3}, {"s": 5, "f": 1}], [{"s": 3, "f": 10}, {"s": 4, "f": 10}], [{"s": 3, "f": 10}, {"s": 4, "f": 0}]]},
    {id:'ds_maj41',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 7}, {"s": 3, "f": 9}], [{"s": 3, "f": 9}, {"s": 4, "f": 5}], [{"s": 3, "f": 4}, {"s": 4, "f": 3}], [{"s": 4, "f": 1}, {"s": 5, "f": 5}], [{"s": 3, "f": 2}, {"s": 4, "f": 1}]]},
    {id:'ds_maj42',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 2, "f": 10}, {"s": 3, "f": 5}], [{"s": 3, "f": 4}, {"s": 4, "f": 5}], [{"s": 4, "f": 3}, {"s": 5, "f": 3}], [{"s": 4, "f": 3}, {"s": 5, "f": 7}], [{"s": 4, "f": 10}, {"s": 5, "f": 5}], [{"s": 3, "f": 2}, {"s": 4, "f": 3}], [{"s": 3, "f": 9}, {"s": 4, "f": 6}]]},
    {id:'ds_maj43',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 3, "f": 10}, {"s": 4, "f": 8}], [{"s": 4, "f": 8}, {"s": 5, "f": 7}], [{"s": 4, "f": 0}, {"s": 5, "f": 1}]]},
    {id:'ds_maj44',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 4, "f": 3}, {"s": 5, "f": 7}], [{"s": 4, "f": 3}, {"s": 5, "f": 8}], [{"s": 3, "f": 10}, {"s": 4, "f": 8}], [{"s": 3, "f": 5}, {"s": 4, "f": 10}], [{"s": 2, "f": 10}, {"s": 3, "f": 7}]]},
    {id:'ds_maj45',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 3, "f": 10}, {"s": 4, "f": 8}], [{"s": 4, "f": 3}, {"s": 5, "f": 5}], [{"s": 3, "f": 4}, {"s": 4, "f": 8}], [{"s": 3, "f": 2}, {"s": 4, "f": 1}], [{"s": 3, "f": 7}, {"s": 4, "f": 8}], [{"s": 3, "f": 10}, {"s": 4, "f": 5}], [{"s": 4, "f": 5}, {"s": 5, "f": 8}], [{"s": 4, "f": 3}, {"s": 5, "f": 8}]]},
    {id:'ds_maj46',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 1, "f": 2}, {"s": 2, "f": 0}], [{"s": 1, "f": 10}, {"s": 2, "f": 7}], [{"s": 0, "f": 7}, {"s": 1, "f": 7}], [{"s": 1, "f": 7}, {"s": 2, "f": 0}]]},
    {id:'ds_maj47',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 2}, {"s": 3, "f": 2}], [{"s": 1, "f": 10}, {"s": 2, "f": 9}], [{"s": 1, "f": 5}, {"s": 2, "f": 10}], [{"s": 1, "f": 8}, {"s": 2, "f": 3}], [{"s": 2, "f": 3}, {"s": 3, "f": 5}], [{"s": 3, "f": 0}, {"s": 4, "f": 5}]]},
    {id:'ds_maj48',scale:'C Major',difficulty:'Advanced',pairs:[[{"s": 2, "f": 10}, {"s": 3, "f": 5}], [{"s": 2, "f": 7}, {"s": 3, "f": 7}], [{"s": 3, "f": 5}, {"s": 4, "f": 3}], [{"s": 2, "f": 0}, {"s": 3, "f": 10}], [{"s": 2, "f": 3}, {"s": 3, "f": 2}], [{"s": 2, "f": 10}, {"s": 3, "f": 10}], [{"s": 1, "f": 0}, {"s": 2, "f": 10}], [{"s": 1, "f": 0}, {"s": 2, "f": 5}]]},
    {id:'ds_maj49',scale:'C Major',difficulty:'Beginner',pairs:[[{"s": 0, "f": 0}, {"s": 1, "f": 10}], [{"s": 1, "f": 7}, {"s": 2, "f": 7}], [{"s": 0, "f": 10}, {"s": 1, "f": 5}]]},
    {id:'ds_maj50',scale:'C Major',difficulty:'Intermediate',pairs:[[{"s": 2, "f": 5}, {"s": 3, "f": 7}], [{"s": 2, "f": 9}, {"s": 3, "f": 7}], [{"s": 2, "f": 0}, {"s": 3, "f": 10}], [{"s": 2, "f": 2}, {"s": 3, "f": 0}], [{"s": 2, "f": 3}, {"s": 3, "f": 2}]]},
  ],};

const CHORD_DATA = {
  'A Major': [
    {name:"A-F#m-D",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"A-C#m-E",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"A-D-E",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"E-A-D",key:"A Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"A-E-D",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"A-F#m-Bm-E",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"F#m-D",key:"A Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"A-D-E-A",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"A-D-A-E",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"A-E-F#m-D",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"A-F#m",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"A-Bm-E",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"A-E",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"D-E-A",key:"A Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"C#m-F#m-A",key:"A Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"A-E-A",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"A-F#m-D-E",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"A-D",key:"A Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"D-E",key:"A Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"D-F#m-A-E",key:"A Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
  ],
  'A# Major': [
    {name:"A#-D#-F-A#",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"A#-Gm-D#-F",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"A#-F",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"A#-D#-F",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"Dm-Gm-A#",key:"A# Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"D#-F-A#",key:"A# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"D#-F",key:"A# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"A#-D#-Gm-F",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"A#-F-Gm-D#",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"Gm-D#",key:"A# Major",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"F-A#-D#",key:"A# Major",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"D#-A#-Gm-F",key:"A# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"A#-Dm-F",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"A#-F-A#",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"A#-Gm",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"A#-D#",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"A#-D#-A#-F",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"A#-F-D#",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"A#-Gm-Cm-F",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"A#-Cm-F",key:"A# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
  ],
  'B Major': [
    {name:"B-F#-G#m-E",key:"B Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"D#m-G#m-B",key:"B Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"F#-B-E",key:"B Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"G#m-B-E-F#",key:"B Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"B-E-G#m-F#",key:"B Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"B-F#-E",key:"B Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"E-G#m-B-F#",key:"B Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"G#m-E-B-F#",key:"B Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"B-G#m-E",key:"B Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"B-E-F#-B",key:"B Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"B-F#",key:"B Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"G#m-E",key:"B Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"B-E-F#",key:"B Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"B-G#m",key:"B Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"E-F#",key:"B Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"B-F#-B",key:"B Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"G#m-C#m-F#-B",key:"B Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"B-D#m-F#",key:"B Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"B-G#m-E-F#",key:"B Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"B-D#m-G#m",key:"B Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
  ],
  'C Major': [
    {name:"F-C-Am-G",key:"C Major",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"C-G-C",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"C-F",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"C-Am-F-G",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"Em-Am-C",key:"C Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"C-F-Am-G",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"G-C-F",key:"C Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"C-G",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"C-Em-Am",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"C-G-Am-F",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"Am-C-F-G",key:"C Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"C-F-G-C",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"Am-F",key:"C Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"C-Em-G",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"C-Dm-G",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"F-Am-C-G",key:"C Major",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"C-F-C-G",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"C-F-G",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"C-Am",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"C-G-F",key:"C Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
  ],
  'C# Major': [
    {name:"C#-A#m",key:"C# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"A#m-F#",key:"C# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"C#-F#-G#",key:"C# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"F#-A#m-C#-G#",key:"C# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"C#-D#m-G#",key:"C# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"C#-A#m-F#-G#",key:"C# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"C#-A#m-F#",key:"C# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"A#m-D#m-G#-C#",key:"C# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"C#-F#-G#-C#",key:"C# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"C#-G#-A#m-F#",key:"C# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"C#-G#",key:"C# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"C#-F#",key:"C# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"C#-G#-C#",key:"C# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"F#-G#",key:"C# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"C#-Fm-A#m",key:"C# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"A#m-F#-C#-G#",key:"C# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"Fm-A#m-C#",key:"C# Major",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"C#-A#m-D#m-G#",key:"C# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"F#-G#-C#",key:"C# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"C#-G#-F#",key:"C# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
  ],
  'D Major': [
    {name:"D-Bm-G-A",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"Bm-G",key:"D Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"D-G-Bm-A",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"D-G",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"D-A-D",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"D-G-D-A",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"D-F#m-Bm",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"G-A",key:"D Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"D-G-A",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"Bm-D-G-A",key:"D Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"D-A-Bm-G",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"D-G-A-D",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"G-A-D",key:"D Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"D-F#m-A",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"F#m-Bm-D",key:"D Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"D-Em-A",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"D-Bm-Em-A",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"D-Bm",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"G-Bm-D-A",key:"D Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"D-A",key:"D Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
  ],
  'D# Major': [
    {name:"D#-A#-D#",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"D#-G#-Cm-A#",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"Cm-D#-G#-A#",key:"D# Major",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"D#-Cm-Fm-A#",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"D#-Cm-G#",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"Cm-Fm-A#-D#",key:"D# Major",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"D#-A#-Cm-G#",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"D#-G#-A#-D#",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"G#-Cm-D#-A#",key:"D# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"G#-A#-D#",key:"D# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"A#-D#-G#",key:"D# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"D#-G#",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"Cm-G#",key:"D# Major",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"D#-Cm-G#-A#",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"D#-Fm-A#",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"D#-G#-A#",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"D#-G#-D#-A#",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"D#-Gm-Cm",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"D#-Gm-A#",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"D#-A#",key:"D# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
  ],
  'E Major': [
    {name:"E-B-C#m-A",key:"E Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"E-G#m-C#m",key:"E Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"E-C#m-A",key:"E Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"E-B-A",key:"E Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}]},
    {name:"E-A-B",key:"E Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"G#m-C#m-E",key:"E Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"A-C#m-E-B",key:"E Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"A-E-C#m-B",key:"E Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"A-B",key:"E Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"E-G#m-B",key:"E Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"C#m-A-E-B",key:"E Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"C#m-F#m-B-E",key:"E Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"C#m-E-A-B",key:"E Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"E-B-E",key:"E Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"E-A-C#m-B",key:"E Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"E-F#m-B",key:"E Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"E-A-E-B",key:"E Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"E-A-B-E",key:"E Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"E-C#m",key:"E Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"E-C#m-A-B",key:"E Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
  ],
  'F Major': [
    {name:"F-Dm-A#-C",key:"F Major",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"F-Dm-Gm-C",key:"F Major",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"F-Gm-C",key:"F Major",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"F-C-Dm-A#",key:"F Major",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"F-A#-C-F",key:"F Major",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"Am-Dm-F",key:"F Major",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"Dm-Gm-C-F",key:"F Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"A#-F-Dm-C",key:"F Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"F-Dm",key:"F Major",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"F-C",key:"F Major",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"Dm-A#",key:"F Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"A#-C-F",key:"F Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"C-F-A#",key:"F Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"F-Dm-A#",key:"F Major",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}]},
    {name:"Dm-F-A#-C",key:"F Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"A#-Dm-F-C",key:"F Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"Dm-A#-F-C",key:"F Major",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"F-A#-C",key:"F Major",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"F-C-F",key:"F Major",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"A#-C",key:"F Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
  ],
  'F# Major': [
    {name:"F#-D#m-B",key:"F# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"C#-F#-B",key:"F# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"D#m-B-F#-C#",key:"F# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"F#-B-F#-C#",key:"F# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"F#-A#m-D#m",key:"F# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"F#-A#m-C#",key:"F# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"F#-C#-D#m-B",key:"F# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"F#-B-D#m-C#",key:"F# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"B-D#m-F#-C#",key:"F# Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"F#-G#m-C#",key:"F# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"F#-C#",key:"F# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"F#-B-C#-F#",key:"F# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"F#-B",key:"F# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"B-C#",key:"F# Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"B-C#-F#",key:"F# Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"F#-C#-F#",key:"F# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"D#m-F#-B-C#",key:"F# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"F#-B-C#",key:"F# Major",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"A#m-D#m-F#",key:"F# Major",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"D#m-B",key:"F# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
  ],
  'G Major': [
    {name:"G-Am-D",key:"G Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"G-C-D",key:"G Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"G-Em-C-D",key:"G Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"C-D",key:"G Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"G-C-D-G",key:"G Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"G-Em",key:"G Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"G-D-G",key:"G Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"G-C",key:"G Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"G-Em-C",key:"G Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"G-D",key:"G Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"G-C-G-D",key:"G Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"Em-C",key:"G Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"C-G-Em-D",key:"G Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"Bm-Em-G",key:"G Major",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"G-C-Em-D",key:"G Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"G-D-C",key:"G Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}]},
    {name:"Em-C-G-D",key:"G Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"Em-G-C-D",key:"G Major",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"G-Bm-Em",key:"G Major",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"C-Em-G-D",key:"G Major",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
  ],
  'G# Major': [
    {name:"D#-G#-C#",key:"G# Major",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"C#-G#-Fm-D#",key:"G# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"G#-C#-Fm-D#",key:"G# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"Fm-G#-C#-D#",key:"G# Major",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"G#-Fm-C#",key:"G# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"G#-C#-G#-D#",key:"G# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"G#-Cm-D#",key:"G# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"G#-Fm-C#-D#",key:"G# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"G#-D#-Fm-C#",key:"G# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"G#-D#-G#",key:"G# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"G#-C#-D#",key:"G# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"G#-A#m-D#",key:"G# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"C#-D#-G#",key:"G# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"C#-D#",key:"G# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"C#-Fm-G#-D#",key:"G# Major",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"Cm-Fm-G#",key:"G# Major",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"G#-D#",key:"G# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"G#-D#-C#",key:"G# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
    {name:"Fm-C#-G#-D#",key:"G# Major",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"G#-C#-D#-G#",key:"G# Major",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
  ],
  'A Minor': [
    {name:"Am-G-Dm-Em",key:"A Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Am-F-Dm",key:"A Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Am-F",key:"A Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}]},
    {name:"G-Am-Dm",key:"A Minor",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Am-Dm-Em-Am",key:"A Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"F-Am-Dm-Em",key:"A Minor",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Am-Dm-Am-Em",key:"A Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Am-F-Dm-Em",key:"A Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Am-Dm",key:"A Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"F-Am-G-Dm",key:"A Minor",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"F-Em-Am-Dm",key:"A Minor",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Am-Em",key:"A Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Dm-Em-Am",key:"A Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"Dm-F-Am-Em",key:"A Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"F-Dm",key:"A Minor",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Dm-Am-F-Em",key:"A Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Am-Dm-F-Em",key:"A Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Dm-Am-Em",key:"A Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Am-G-Em",key:"A Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Am-Em-Am",key:"A Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
  ],
  'A# Minor': [
    {name:"F#-A#m-D#m-Fm",key:"A# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"A#m-D#m",key:"A# Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"F#-D#m-A#m-Fm",key:"A# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"A#m-D#m-Fm",key:"A# Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"D#m-A#m-Fm",key:"A# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"A#m-G#-D#m-Fm",key:"A# Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"A#m-F#",key:"A# Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"A#m-F#-D#m-Fm",key:"A# Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"A#m-F#-D#m",key:"A# Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"A#m-Fm-A#m",key:"A# Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"G#-A#m-D#m",key:"A# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"D#m-Fm",key:"A# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"A#m-D#m-Fm-A#m",key:"A# Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"A#m-G#-Fm",key:"A# Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"F#-D#m",key:"A# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"A#m-Fm-F#-D#m",key:"A# Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"D#m-F#-A#m-Fm",key:"A# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"D#m-Fm-A#m",key:"A# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"Fm-A#m-D#m",key:"A# Minor",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"A#m-F#-G#-D#m",key:"A# Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
  ],
  'B Minor': [
    {name:"Bm-Em",key:"B Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Bm-G-A-Em",key:"B Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"G-Bm-A-Em",key:"B Minor",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Bm-G",key:"B Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}]},
    {name:"Bm-Em-G-F#m",key:"B Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"Em-Bm-F#m",key:"B Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"A-Em-Bm-F#m",key:"B Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"G-Bm-Em-F#m",key:"B Minor",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"G-Em",key:"B Minor",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Bm-F#m-Em",key:"B Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Bm-G-Em-F#m",key:"B Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"Bm-A-F#m",key:"B Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"Bm-A-Em-F#m",key:"B Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"G-F#m-Bm-Em",key:"B Minor",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Em-G-Bm-F#m",key:"B Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"Bm-Em-F#m-Bm",key:"B Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"G-A-Em-F#m",key:"B Minor",chords:[{"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"Em-Bm-G-F#m",key:"B Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 3, "1": 2, "2": 0, "3": 0, "4": 0, "5": 3}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"Bm-F#m-Bm",key:"B Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"A-Bm-Em",key:"B Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
  ],
  'C Minor': [
    {name:"Fm-Gm",key:"C Minor",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Cm-G#",key:"C Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}]},
    {name:"Cm-Gm-G#-Fm",key:"C Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"G#-Cm-Fm-Gm",key:"C Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Cm-Fm-G#-Gm",key:"C Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Cm-G#-A#-Fm",key:"C Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"G#-Gm-Cm-Fm",key:"C Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"Cm-Gm-Fm",key:"C Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"Cm-Fm-Gm-Cm",key:"C Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"Cm-G#-Fm",key:"C Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"Cm-Fm-Gm",key:"C Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"G#-A#-Fm-Gm",key:"C Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"A#-Cm-Fm",key:"C Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"G#-Fm",key:"C Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"Fm-Gm-Cm",key:"C Minor",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"Cm-A#-Gm",key:"C Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Cm-Fm-Cm-Gm",key:"C Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Cm-Fm",key:"C Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"Cm-Gm",key:"C Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"G#-Cm-A#-Fm",key:"C Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 5, "4": 4, "5": 4}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
  ],
  'C# Minor': [
    {name:"C#m-F#m-B",key:"C# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"A-B-F#m-G#m",key:"C# Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"C#m-G#m-F#m",key:"C# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"A-F#m-C#m-G#m",key:"C# Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"C#m-F#m-A-G#m",key:"C# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"C#m-G#m-C#m",key:"C# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"C#m-F#m",key:"C# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"C#m-F#m-G#m-C#m",key:"C# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"F#m-C#m-A-G#m",key:"C# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"B-C#m-F#m",key:"C# Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"C#m-B-G#m",key:"C# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"A-C#m-B-F#m",key:"C# Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"C#m-A-F#m",key:"C# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"A-F#m",key:"C# Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"C#m-G#m",key:"C# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"F#m-A-C#m-G#m",key:"C# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"B-F#m-C#m-G#m",key:"C# Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"F#m-C#m-G#m",key:"C# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"A-G#m-C#m-F#m",key:"C# Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 2, "5": 0}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"C#m-B-F#m-G#m",key:"C# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
  ],
  'D Minor': [
    {name:"Dm-A#-Gm",key:"D Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Dm-Am-Dm",key:"D Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"A#-Dm-C-Gm",key:"D Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Dm-Gm",key:"D Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Dm-A#-Gm-Am",key:"D Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"Am-Dm-Gm",key:"D Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Gm-A#-Dm-Am",key:"D Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"C-Dm-Gm",key:"D Minor",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Dm-Am-A#-Gm",key:"D Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Dm-Gm-Am",key:"D Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"Dm-Gm-Am-Dm",key:"D Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Gm-Am-Dm",key:"D Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Gm-Dm-Am",key:"D Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"Gm-Dm-A#-Am",key:"D Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"A#-C-Gm-Am",key:"D Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"A#-Am-Dm-Gm",key:"D Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Dm-C-Gm-Am",key:"D Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"A#-Dm-Gm-Am",key:"D Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"Dm-Am-Gm",key:"D Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Dm-A#-C-Gm",key:"D Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
  ],
  'D# Minor': [
    {name:"D#m-G#m-D#m-A#m",key:"D# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"C#-G#m-D#m-A#m",key:"D# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"D#m-G#m",key:"D# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"B-G#m",key:"D# Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"D#m-A#m-G#m",key:"D# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"D#m-B-G#m-A#m",key:"D# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"G#m-D#m-A#m",key:"D# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"B-G#m-D#m-A#m",key:"D# Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"D#m-B-G#m",key:"D# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"D#m-B",key:"D# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}]},
    {name:"G#m-B-D#m-A#m",key:"D# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"B-D#m-C#-G#m",key:"D# Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"D#m-G#m-A#m-D#m",key:"D# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"D#m-C#-G#m-A#m",key:"D# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"A#m-D#m-G#m",key:"D# Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"B-A#m-D#m-G#m",key:"D# Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 4, "5": 2}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"G#m-A#m-D#m",key:"D# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"D#m-C#-A#m",key:"D# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"D#m-G#m-A#m",key:"D# Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"G#m-A#m",key:"D# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
  ],
  'E Minor': [
    {name:"Bm-Em-Am",key:"E Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"Em-C-Am",key:"E Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"Em-C-Am-Bm",key:"E Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"Em-Bm-Em",key:"E Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}]},
    {name:"Em-Bm-Am",key:"E Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"C-Em-D-Am",key:"E Minor",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"Em-Am",key:"E Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"Em-D-Bm",key:"E Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"Am-Em-Bm",key:"E Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"Am-Em-C-Bm",key:"E Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"Em-Am-Em-Bm",key:"E Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"C-Em-Am-Bm",key:"E Minor",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"D-Em-Am",key:"E Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"Em-Am-C-Bm",key:"E Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"C-Am-Em-Bm",key:"E Minor",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"Am-C-Em-Bm",key:"E Minor",chords:[{"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"Em-C-D-Am",key:"E Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"C-D-Am-Bm",key:"E Minor",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"C-Bm-Em-Am",key:"E Minor",chords:[{"0": "x", "1": 3, "2": 2, "3": 0, "4": 1, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}]},
    {name:"Em-Am-Bm",key:"E Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 0, "4": 0, "5": 0}, {"0": "x", "1": 0, "2": 2, "3": 2, "4": 1, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
  ],
  'F Minor': [
    {name:"C#-Cm-Fm-A#m",key:"F Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"A#m-Cm",key:"F Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"Fm-D#-Cm",key:"F Minor",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"C#-A#m-Fm-Cm",key:"F Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"D#-A#m-Fm-Cm",key:"F Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"Fm-A#m-Cm",key:"F Minor",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"Cm-Fm-A#m",key:"F Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"C#-D#-A#m-Cm",key:"F Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"C#-Fm-D#-A#m",key:"F Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"A#m-Fm-C#-Cm",key:"F Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"Fm-Cm-Fm",key:"F Minor",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"Fm-A#m-Cm-Fm",key:"F Minor",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}]},
    {name:"Fm-D#-A#m-Cm",key:"F Minor",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"D#-Fm-A#m",key:"F Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"A#m-C#-Fm-Cm",key:"F Minor",chords:[{"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"Fm-C#-D#-A#m",key:"F Minor",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"Fm-A#m-Fm-Cm",key:"F Minor",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"C#-A#m",key:"F Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}]},
    {name:"Fm-C#-A#m-Cm",key:"F Minor",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}, {"0": "x", "1": 1, "2": 3, "3": 3, "4": 2, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"Fm-C#",key:"F Minor",chords:[{"0": 1, "1": 3, "2": 3, "3": 1, "4": 1, "5": 1}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 6, "5": 4}]},
  ],
  'F# Minor': [
    {name:"F#m-D-Bm",key:"F# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"F#m-C#m-F#m",key:"F# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"F#m-E-C#m",key:"F# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"F#m-C#m-Bm",key:"F# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"D-C#m-F#m-Bm",key:"F# Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"D-E-Bm-C#m",key:"F# Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"F#m-D",key:"F# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}]},
    {name:"E-F#m-Bm",key:"F# Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"F#m-Bm",key:"F# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"Bm-F#m-C#m",key:"F# Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"F#m-Bm-C#m",key:"F# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"Bm-C#m-F#m",key:"F# Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"F#m-D-Bm-C#m",key:"F# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"F#m-C#m",key:"F# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"F#m-D-E-Bm",key:"F# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"Bm-F#m-D-C#m",key:"F# Minor",chords:[{"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"D-F#m-E-Bm",key:"F# Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}]},
    {name:"E-Bm-F#m-C#m",key:"F# Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"F#m-Bm-C#m-F#m",key:"F# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}]},
    {name:"D-Bm-F#m-C#m",key:"F# Minor",chords:[{"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 2}, {"0": "x", "1": 2, "2": 4, "3": 4, "4": 3, "5": 2}, {"0": 2, "1": 4, "2": 4, "3": 2, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
  ],
  'G Minor': [
    {name:"Cm-D#-Gm-Dm",key:"G Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Gm-D#",key:"G Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}]},
    {name:"D#-Cm-Gm-Dm",key:"G Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Gm-Cm-D#-Dm",key:"G Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Gm-Cm-Dm",key:"G Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Gm-Dm-Gm",key:"G Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"Gm-F-Dm",key:"G Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Cm-Dm-Gm",key:"G Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}]},
    {name:"D#-Dm-Gm-Cm",key:"G Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"Gm-Dm",key:"G Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"D#-Gm-F-Cm",key:"G Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"F-Gm-Cm",key:"G Minor",chords:[{"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"Gm-Dm-Cm",key:"G Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"D#-Cm",key:"G Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
    {name:"D#-F-Cm-Dm",key:"G Minor",chords:[{"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Cm-Gm-D#-Dm",key:"G Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Gm-F-Cm-Dm",key:"G Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Gm-D#-Cm-Dm",key:"G Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Cm-Gm-Dm",key:"G Minor",chords:[{"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}, {"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": "x", "2": 0, "3": 2, "4": 3, "5": 1}]},
    {name:"Gm-D#-F-Cm",key:"G Minor",chords:[{"0": 3, "1": 5, "2": 5, "3": 3, "4": 3, "5": 3}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 8, "5": 6}, {"0": 1, "1": 1, "2": 2, "3": 3, "4": 3, "5": 1}, {"0": "x", "1": 3, "2": 5, "3": 5, "4": 4, "5": 3}]},
  ],
  'G# Minor': [
    {name:"G#m-C#m-D#m-G#m",key:"G# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"G#m-E",key:"G# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}]},
    {name:"G#m-C#m-D#m",key:"G# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"C#m-G#m-D#m",key:"G# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"G#m-F#-D#m",key:"G# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"E-G#m-C#m-D#m",key:"G# Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"G#m-E-C#m-D#m",key:"G# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"E-D#m-G#m-C#m",key:"G# Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"G#m-D#m-C#m",key:"G# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"G#m-C#m-F#",key:"G# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}]},
    {name:"C#m-D#m",key:"G# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"G#m-F#-C#m-D#m",key:"G# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"F#-G#m-C#m",key:"G# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"F#-C#m-G#m-D#m",key:"G# Minor",chords:[{"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"E-F#-C#m-D#m",key:"G# Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": 2, "1": 4, "2": 4, "3": 3, "4": 2, "5": 2}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"G#m-C#m-E-D#m",key:"G# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"C#m-D#m-G#m",key:"G# Minor",chords:[{"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}]},
    {name:"G#m-D#m",key:"G# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
    {name:"G#m-D#m-E-C#m",key:"G# Minor",chords:[{"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}, {"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}]},
    {name:"E-C#m-G#m-D#m",key:"G# Minor",chords:[{"0": 0, "1": 2, "2": 2, "3": 1, "4": 0, "5": 0}, {"0": "x", "1": 4, "2": 6, "3": 6, "4": 5, "5": 4}, {"0": 4, "1": 6, "2": 6, "3": 4, "4": 4, "5": 4}, {"0": "x", "1": 6, "2": 8, "3": 8, "4": 7, "5": 6}]},
  ],};

const BOX_LICK_DATA = {
  'Minor Pentatonic': {
    1: [
      {id:'box1_A_0',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}]},
      {id:'box1_A_1',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}]},
      {id:'box1_A_2',root:'A',difficulty:'Advanced',notes:[{"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box1_A_3',root:'A',difficulty:'Beginner',notes:[{"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 8, "degree": "b7"}]},
      {id:'box1_A_4',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 8, "degree": "b7"}]},
      {id:'box1_A_5',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box1_A_6',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 7, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 8, "degree": "b7"}]},
      {id:'box1_A_7',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}]},
      {id:'box1_A_8',root:'A',difficulty:'Advanced',notes:[{"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}]},
      {id:'box1_A_9',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 0, "f": 8, "degree": "b3"}]},
      {id:'box1_A_10',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}]},
      {id:'box1_A_11',root:'A',difficulty:'Advanced',notes:[{"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 7, "degree": "5"}]},
      {id:'box1_A_12',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 7, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 8, "degree": "b7"}]},
      {id:'box1_A_13',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box1_A_14',root:'A',difficulty:'Advanced',notes:[{"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}]},
      {id:'box1_A_15',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box1_A_16',root:'A',difficulty:'Intermediate',notes:[{"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 7, "degree": "5"}]},
      {id:'box1_E_17',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 3, "degree": "b7"}]},
      {id:'box1_E_18',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 0, "degree": "1"}]},
      {id:'box1_E_19',root:'E',difficulty:'Advanced',notes:[{"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 2, "degree": "5"}]},
      {id:'box1_E_20',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box1_E_21',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}]},
      {id:'box1_E_22',root:'E',difficulty:'Advanced',notes:[{"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}]},
      {id:'box1_E_23',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box1_E_24',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 0, "degree": "b7"}, {"s": 2, "f": 0, "degree": "b7"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}]},
      {id:'box1_E_25',root:'E',difficulty:'Advanced',notes:[{"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 4, "f": 0, "degree": "5"}]},
      {id:'box1_E_26',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 0, "degree": "b7"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 3, "degree": "b7"}]},
      {id:'box1_E_27',root:'E',difficulty:'Intermediate',notes:[{"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}]},
      {id:'box1_E_28',root:'E',difficulty:'Advanced',notes:[{"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box1_E_29',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 0, "degree": "1"}]},
      {id:'box1_E_30',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 3, "degree": "b7"}]},
      {id:'box1_E_31',root:'E',difficulty:'Advanced',notes:[{"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 4, "f": 0, "degree": "5"}]},
      {id:'box1_E_32',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 2, "degree": "1"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 3, "degree": "b7"}]},
      {id:'box1_E_33',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box1_D_34',root:'D',difficulty:'Beginner',notes:[{"s": 1, "f": 12, "degree": "5"}, {"s": 1, "f": 12, "degree": "5"}, {"s": 1, "f": 10, "degree": "4"}, {"s": 1, "f": 10, "degree": "4"}, {"s": 0, "f": 13, "degree": "b3"}, {"s": 0, "f": 13, "degree": "b3"}]},
      {id:'box1_D_35',root:'D',difficulty:'Intermediate',notes:[{"s": 4, "f": 13, "degree": "b7"}, {"s": 4, "f": 10, "degree": "5"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 2, "f": 12, "degree": "1"}, {"s": 2, "f": 10, "degree": "b7"}]},
      {id:'box1_D_36',root:'D',difficulty:'Advanced',notes:[{"s": 1, "f": 12, "degree": "5"}, {"s": 1, "f": 12, "degree": "5"}, {"s": 1, "f": 10, "degree": "4"}, {"s": 1, "f": 10, "degree": "4"}, {"s": 0, "f": 13, "degree": "b3"}, {"s": 0, "f": 13, "degree": "b3"}, {"s": 0, "f": 10, "degree": "1"}]},
      {id:'box1_D_37',root:'D',difficulty:'Beginner',notes:[{"s": 2, "f": 10, "degree": "b7"}, {"s": 2, "f": 12, "degree": "1"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 4, "f": 10, "degree": "5"}]},
      {id:'box1_D_38',root:'D',difficulty:'Intermediate',notes:[{"s": 2, "f": 10, "degree": "b7"}, {"s": 2, "f": 12, "degree": "1"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 4, "f": 10, "degree": "5"}, {"s": 4, "f": 13, "degree": "b7"}]},
      {id:'box1_D_39',root:'D',difficulty:'Advanced',notes:[{"s": 1, "f": 12, "degree": "5"}, {"s": 1, "f": 10, "degree": "4"}, {"s": 0, "f": 13, "degree": "b3"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 0, "f": 10, "degree": "1"}]},
      {id:'box1_D_40',root:'D',difficulty:'Beginner',notes:[{"s": 4, "f": 13, "degree": "b7"}, {"s": 4, "f": 13, "degree": "b7"}, {"s": 4, "f": 10, "degree": "5"}, {"s": 4, "f": 10, "degree": "5"}, {"s": 3, "f": 12, "degree": "4"}]},
      {id:'box1_D_41',root:'D',difficulty:'Intermediate',notes:[{"s": 0, "f": 13, "degree": "b3"}, {"s": 0, "f": 13, "degree": "b3"}, {"s": 1, "f": 10, "degree": "4"}, {"s": 1, "f": 10, "degree": "4"}, {"s": 1, "f": 12, "degree": "5"}, {"s": 1, "f": 12, "degree": "5"}]},
      {id:'box1_D_42',root:'D',difficulty:'Advanced',notes:[{"s": 4, "f": 10, "degree": "5"}, {"s": 4, "f": 10, "degree": "5"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 2, "f": 12, "degree": "1"}, {"s": 2, "f": 12, "degree": "1"}]},
      {id:'box1_D_43',root:'D',difficulty:'Beginner',notes:[{"s": 4, "f": 13, "degree": "b7"}, {"s": 4, "f": 10, "degree": "5"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 2, "f": 12, "degree": "1"}]},
      {id:'box1_D_44',root:'D',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "4"}, {"s": 1, "f": 10, "degree": "4"}, {"s": 0, "f": 13, "degree": "b3"}, {"s": 0, "f": 13, "degree": "b3"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 0, "f": 10, "degree": "1"}]},
      {id:'box1_D_45',root:'D',difficulty:'Advanced',notes:[{"s": 4, "f": 13, "degree": "b7"}, {"s": 4, "f": 13, "degree": "b7"}, {"s": 4, "f": 10, "degree": "5"}, {"s": 4, "f": 10, "degree": "5"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 10, "degree": "b3"}]},
      {id:'box1_D_46',root:'D',difficulty:'Beginner',notes:[{"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 2, "f": 12, "degree": "1"}, {"s": 2, "f": 12, "degree": "1"}]},
      {id:'box1_D_47',root:'D',difficulty:'Intermediate',notes:[{"s": 2, "f": 10, "degree": "b7"}, {"s": 2, "f": 12, "degree": "1"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 4, "f": 10, "degree": "5"}, {"s": 4, "f": 13, "degree": "b7"}, {"s": 4, "f": 13, "degree": "b7"}]},
      {id:'box1_D_48',root:'D',difficulty:'Advanced',notes:[{"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 2, "f": 12, "degree": "1"}, {"s": 2, "f": 12, "degree": "1"}, {"s": 2, "f": 10, "degree": "b7"}, {"s": 2, "f": 12, "degree": "1"}]},
      {id:'box1_D_49',root:'D',difficulty:'Beginner',notes:[{"s": 2, "f": 10, "degree": "b7"}, {"s": 2, "f": 10, "degree": "b7"}, {"s": 2, "f": 12, "degree": "1"}, {"s": 2, "f": 12, "degree": "1"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 2, "f": 12, "degree": "1"}]},
    ],
    2: [
      {id:'box2_A_0',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}]},
      {id:'box2_A_1',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}]},
      {id:'box2_A_2',root:'A',difficulty:'Advanced',notes:[{"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}]},
      {id:'box2_A_3',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}]},
      {id:'box2_A_4',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 4, "f": 8, "degree": "b7"}]},
      {id:'box2_A_5',root:'A',difficulty:'Advanced',notes:[{"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box2_A_6',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}]},
      {id:'box2_A_7',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}]},
      {id:'box2_A_8',root:'A',difficulty:'Advanced',notes:[{"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}]},
      {id:'box2_A_9',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box2_A_10',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box2_A_11',root:'A',difficulty:'Advanced',notes:[{"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 10, "degree": "b7"}]},
      {id:'box2_A_12',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}]},
      {id:'box2_A_13',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box2_A_14',root:'A',difficulty:'Advanced',notes:[{"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 10, "degree": "b7"}]},
      {id:'box2_A_15',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box2_A_16',root:'A',difficulty:'Intermediate',notes:[{"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}]},
      {id:'box2_E_17',root:'E',difficulty:'Beginner',notes:[{"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 1, "f": 2, "degree": "5"}]},
      {id:'box2_E_18',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 4, "f": 3, "degree": "b7"}]},
      {id:'box2_E_19',root:'E',difficulty:'Advanced',notes:[{"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}]},
      {id:'box2_E_20',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}]},
      {id:'box2_E_21',root:'E',difficulty:'Intermediate',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}]},
      {id:'box2_E_22',root:'E',difficulty:'Advanced',notes:[{"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}]},
      {id:'box2_E_23',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}]},
      {id:'box2_E_24',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box2_E_25',root:'E',difficulty:'Advanced',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}]},
      {id:'box2_E_26',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}]},
      {id:'box2_E_27',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}]},
      {id:'box2_E_28',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}]},
      {id:'box2_E_29',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}]},
      {id:'box2_E_30',root:'E',difficulty:'Intermediate',notes:[{"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}]},
      {id:'box2_E_31',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}]},
      {id:'box2_E_32',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}]},
      {id:'box2_E_33',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}]},
      {id:'box2_D_34',root:'D',difficulty:'Beginner',notes:[{"s": 2, "f": 12, "degree": "1"}, {"s": 2, "f": 12, "degree": "1"}, {"s": 2, "f": 15, "degree": "b3"}, {"s": 2, "f": 15, "degree": "b3"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 12, "degree": "4"}]},
      {id:'box2_D_35',root:'D',difficulty:'Intermediate',notes:[{"s": 4, "f": 15, "degree": "1"}, {"s": 4, "f": 13, "degree": "b7"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 2, "f": 15, "degree": "b3"}, {"s": 2, "f": 12, "degree": "1"}]},
      {id:'box2_D_36',root:'D',difficulty:'Advanced',notes:[{"s": 4, "f": 13, "degree": "b7"}, {"s": 4, "f": 13, "degree": "b7"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 2, "f": 15, "degree": "b3"}]},
      {id:'box2_D_37',root:'D',difficulty:'Beginner',notes:[{"s": 4, "f": 15, "degree": "1"}, {"s": 4, "f": 15, "degree": "1"}, {"s": 4, "f": 13, "degree": "b7"}, {"s": 4, "f": 13, "degree": "b7"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 14, "degree": "5"}]},
      {id:'box2_D_38',root:'D',difficulty:'Intermediate',notes:[{"s": 4, "f": 15, "degree": "1"}, {"s": 4, "f": 13, "degree": "b7"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 2, "f": 15, "degree": "b3"}, {"s": 2, "f": 12, "degree": "1"}]},
      {id:'box2_D_39',root:'D',difficulty:'Advanced',notes:[{"s": 1, "f": 15, "degree": "b7"}, {"s": 1, "f": 15, "degree": "b7"}, {"s": 1, "f": 12, "degree": "5"}, {"s": 1, "f": 12, "degree": "5"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 13, "degree": "b3"}]},
      {id:'box2_D_40',root:'D',difficulty:'Beginner',notes:[{"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 1, "f": 12, "degree": "5"}, {"s": 1, "f": 12, "degree": "5"}, {"s": 1, "f": 15, "degree": "b7"}]},
      {id:'box2_D_41',root:'D',difficulty:'Intermediate',notes:[{"s": 2, "f": 12, "degree": "1"}, {"s": 2, "f": 12, "degree": "1"}, {"s": 2, "f": 15, "degree": "b3"}, {"s": 2, "f": 15, "degree": "b3"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 14, "degree": "5"}]},
      {id:'box2_D_42',root:'D',difficulty:'Advanced',notes:[{"s": 2, "f": 15, "degree": "b3"}, {"s": 2, "f": 15, "degree": "b3"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 4, "f": 13, "degree": "b7"}]},
      {id:'box2_D_43',root:'D',difficulty:'Beginner',notes:[{"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 2, "f": 15, "degree": "b3"}, {"s": 2, "f": 15, "degree": "b3"}, {"s": 2, "f": 12, "degree": "1"}, {"s": 2, "f": 12, "degree": "1"}]},
      {id:'box2_D_44',root:'D',difficulty:'Intermediate',notes:[{"s": 4, "f": 15, "degree": "1"}, {"s": 4, "f": 15, "degree": "1"}, {"s": 4, "f": 13, "degree": "b7"}, {"s": 4, "f": 13, "degree": "b7"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 12, "degree": "4"}]},
      {id:'box2_D_45',root:'D',difficulty:'Advanced',notes:[{"s": 1, "f": 12, "degree": "5"}, {"s": 1, "f": 12, "degree": "5"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 13, "degree": "b3"}, {"s": 0, "f": 13, "degree": "b3"}, {"s": 0, "f": 13, "degree": "b3"}, {"s": 0, "f": 13, "degree": "b3"}]},
      {id:'box2_D_46',root:'D',difficulty:'Beginner',notes:[{"s": 2, "f": 12, "degree": "1"}, {"s": 2, "f": 15, "degree": "b3"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 4, "f": 13, "degree": "b7"}, {"s": 4, "f": 15, "degree": "1"}]},
      {id:'box2_D_47',root:'D',difficulty:'Intermediate',notes:[{"s": 1, "f": 15, "degree": "b7"}, {"s": 1, "f": 12, "degree": "5"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 13, "degree": "b3"}, {"s": 0, "f": 13, "degree": "b3"}, {"s": 0, "f": 13, "degree": "b3"}, {"s": 0, "f": 13, "degree": "b3"}]},
      {id:'box2_D_48',root:'D',difficulty:'Advanced',notes:[{"s": 2, "f": 15, "degree": "b3"}, {"s": 2, "f": 15, "degree": "b3"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 4, "f": 13, "degree": "b7"}, {"s": 4, "f": 15, "degree": "1"}]},
      {id:'box2_D_49',root:'D',difficulty:'Beginner',notes:[{"s": 2, "f": 15, "degree": "b3"}, {"s": 2, "f": 15, "degree": "b3"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 12, "degree": "4"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 14, "degree": "5"}]},
    ],
    3: [
      {id:'box3_A_0',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 10, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}]},
      {id:'box3_A_1',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box3_A_2',root:'A',difficulty:'Advanced',notes:[{"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}]},
      {id:'box3_A_3',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box3_A_4',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}]},
      {id:'box3_A_5',root:'A',difficulty:'Advanced',notes:[{"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}]},
      {id:'box3_A_6',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 12, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 13, "degree": "b3"}]},
      {id:'box3_A_7',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 10, "degree": "4"}]},
      {id:'box3_A_8',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box3_A_9',root:'A',difficulty:'Beginner',notes:[{"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box3_A_10',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}]},
      {id:'box3_A_11',root:'A',difficulty:'Advanced',notes:[{"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}]},
      {id:'box3_A_12',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}]},
      {id:'box3_A_13',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}]},
      {id:'box3_A_14',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}]},
      {id:'box3_A_15',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}]},
      {id:'box3_A_16',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}]},
      {id:'box3_E_17',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}]},
      {id:'box3_E_18',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}]},
      {id:'box3_E_19',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}]},
      {id:'box3_E_20',root:'E',difficulty:'Beginner',notes:[{"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}]},
      {id:'box3_E_21',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}]},
      {id:'box3_E_22',root:'E',difficulty:'Advanced',notes:[{"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}]},
      {id:'box3_E_23',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box3_E_24',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 5, "degree": "1"}]},
      {id:'box3_E_25',root:'E',difficulty:'Advanced',notes:[{"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 7, "degree": "1"}]},
      {id:'box3_E_26',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}]},
      {id:'box3_E_27',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}]},
      {id:'box3_E_28',root:'E',difficulty:'Advanced',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}]},
      {id:'box3_E_29',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 7, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}]},
      {id:'box3_E_30',root:'E',difficulty:'Intermediate',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}]},
      {id:'box3_E_31',root:'E',difficulty:'Advanced',notes:[{"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}]},
      {id:'box3_E_32',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}]},
      {id:'box3_E_33',root:'E',difficulty:'Intermediate',notes:[{"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 7, "degree": "1"}]},
      {id:'box3_D_34',root:'D',difficulty:'Beginner',notes:[{"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 4, "f": 15, "degree": "1"}, {"s": 4, "f": 15, "degree": "1"}, {"s": 4, "f": 18, "degree": "b3"}, {"s": 4, "f": 15, "degree": "1"}]},
      {id:'box3_D_35',root:'D',difficulty:'Intermediate',notes:[{"s": 2, "f": 15, "degree": "b3"}, {"s": 2, "f": 15, "degree": "b3"}, {"s": 2, "f": 17, "degree": "4"}, {"s": 2, "f": 17, "degree": "4"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 17, "degree": "b7"}]},
      {id:'box3_D_36',root:'D',difficulty:'Advanced',notes:[{"s": 2, "f": 17, "degree": "4"}, {"s": 2, "f": 17, "degree": "4"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 4, "f": 15, "degree": "1"}]},
      {id:'box3_D_37',root:'D',difficulty:'Beginner',notes:[{"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 2, "f": 17, "degree": "4"}]},
      {id:'box3_D_38',root:'D',difficulty:'Intermediate',notes:[{"s": 2, "f": 15, "degree": "b3"}, {"s": 2, "f": 17, "degree": "4"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 4, "f": 15, "degree": "1"}, {"s": 4, "f": 18, "degree": "b3"}, {"s": 4, "f": 15, "degree": "1"}]},
      {id:'box3_D_39',root:'D',difficulty:'Advanced',notes:[{"s": 1, "f": 15, "degree": "b7"}, {"s": 1, "f": 15, "degree": "b7"}, {"s": 0, "f": 17, "degree": "5"}, {"s": 0, "f": 17, "degree": "5"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 15, "degree": "4"}]},
      {id:'box3_D_40',root:'D',difficulty:'Beginner',notes:[{"s": 4, "f": 15, "degree": "1"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 2, "f": 17, "degree": "4"}, {"s": 2, "f": 15, "degree": "b3"}]},
      {id:'box3_D_41',root:'D',difficulty:'Intermediate',notes:[{"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 2, "f": 17, "degree": "4"}, {"s": 2, "f": 17, "degree": "4"}, {"s": 2, "f": 15, "degree": "b3"}]},
      {id:'box3_D_42',root:'D',difficulty:'Advanced',notes:[{"s": 2, "f": 17, "degree": "4"}, {"s": 2, "f": 17, "degree": "4"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 4, "f": 15, "degree": "1"}]},
      {id:'box3_D_43',root:'D',difficulty:'Beginner',notes:[{"s": 0, "f": 17, "degree": "5"}, {"s": 0, "f": 17, "degree": "5"}, {"s": 1, "f": 15, "degree": "b7"}, {"s": 1, "f": 15, "degree": "b7"}, {"s": 1, "f": 17, "degree": "1"}, {"s": 1, "f": 17, "degree": "1"}]},
      {id:'box3_D_44',root:'D',difficulty:'Intermediate',notes:[{"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 17, "degree": "5"}, {"s": 0, "f": 17, "degree": "5"}, {"s": 1, "f": 15, "degree": "b7"}, {"s": 1, "f": 15, "degree": "b7"}, {"s": 1, "f": 17, "degree": "1"}]},
      {id:'box3_D_45',root:'D',difficulty:'Advanced',notes:[{"s": 2, "f": 17, "degree": "4"}, {"s": 2, "f": 17, "degree": "4"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 4, "f": 15, "degree": "1"}, {"s": 4, "f": 15, "degree": "1"}]},
      {id:'box3_D_46',root:'D',difficulty:'Beginner',notes:[{"s": 1, "f": 17, "degree": "1"}, {"s": 1, "f": 15, "degree": "b7"}, {"s": 0, "f": 17, "degree": "5"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 15, "degree": "4"}]},
      {id:'box3_D_47',root:'D',difficulty:'Intermediate',notes:[{"s": 1, "f": 15, "degree": "b7"}, {"s": 1, "f": 15, "degree": "b7"}, {"s": 0, "f": 17, "degree": "5"}, {"s": 0, "f": 17, "degree": "5"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 15, "degree": "4"}]},
      {id:'box3_D_48',root:'D',difficulty:'Advanced',notes:[{"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 14, "degree": "5"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 4, "f": 15, "degree": "1"}, {"s": 4, "f": 15, "degree": "1"}, {"s": 4, "f": 15, "degree": "1"}]},
      {id:'box3_D_49',root:'D',difficulty:'Beginner',notes:[{"s": 1, "f": 17, "degree": "1"}, {"s": 1, "f": 15, "degree": "b7"}, {"s": 0, "f": 17, "degree": "5"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 15, "degree": "4"}, {"s": 0, "f": 15, "degree": "4"}]},
    ],
    4: [
      {id:'box4_A_0',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 1, "f": 12, "degree": "1"}]},
      {id:'box4_A_1',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 14, "degree": "5"}, {"s": 2, "f": 14, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 14, "degree": "1"}]},
      {id:'box4_A_2',root:'A',difficulty:'Advanced',notes:[{"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}]},
      {id:'box4_A_3',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 12, "degree": "5"}]},
      {id:'box4_A_4',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 14, "degree": "5"}, {"s": 2, "f": 14, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}]},
      {id:'box4_A_5',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 15, "degree": "4"}]},
      {id:'box4_A_6',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 15, "degree": "4"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 2, "f": 14, "degree": "5"}]},
      {id:'box4_A_7',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 15, "degree": "4"}]},
      {id:'box4_A_8',root:'A',difficulty:'Advanced',notes:[{"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 14, "degree": "5"}, {"s": 2, "f": 14, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}]},
      {id:'box4_A_9',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}]},
      {id:'box4_A_10',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 15, "degree": "4"}]},
      {id:'box4_A_11',root:'A',difficulty:'Advanced',notes:[{"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}]},
      {id:'box4_A_12',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 15, "degree": "4"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 2, "f": 14, "degree": "5"}]},
      {id:'box4_A_13',root:'A',difficulty:'Intermediate',notes:[{"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 15, "degree": "b3"}]},
      {id:'box4_A_14',root:'A',difficulty:'Advanced',notes:[{"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 14, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 15, "degree": "4"}, {"s": 4, "f": 15, "degree": "4"}]},
      {id:'box4_A_15',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 13, "degree": "b3"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 2, "f": 14, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}]},
      {id:'box4_A_16',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 14, "degree": "5"}, {"s": 2, "f": 14, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}]},
      {id:'box4_E_17',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 9, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box4_E_18',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 9, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box4_E_19',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}]},
      {id:'box4_E_20',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_21',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 9, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}]},
      {id:'box4_E_22',root:'E',difficulty:'Advanced',notes:[{"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 2, "f": 9, "degree": "5"}]},
      {id:'box4_E_23',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 9, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}]},
      {id:'box4_E_24',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}]},
      {id:'box4_E_25',root:'E',difficulty:'Advanced',notes:[{"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}]},
      {id:'box4_E_26',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 2, "f": 9, "degree": "5"}]},
      {id:'box4_E_27',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 9, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box4_E_28',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_29',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_30',root:'E',difficulty:'Intermediate',notes:[{"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 2, "f": 9, "degree": "5"}]},
      {id:'box4_E_31',root:'E',difficulty:'Advanced',notes:[{"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 9, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box4_E_32',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 9, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}]},
      {id:'box4_E_33',root:'E',difficulty:'Intermediate',notes:[{"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box4_D_34',root:'D',difficulty:'Beginner',notes:[{"s": 2, "f": 17, "degree": "4"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 4, "f": 18, "degree": "b3"}, {"s": 4, "f": 20, "degree": "4"}]},
      {id:'box4_D_35',root:'D',difficulty:'Intermediate',notes:[{"s": 3, "f": 19, "degree": "1"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 2, "f": 17, "degree": "4"}]},
      {id:'box4_D_36',root:'D',difficulty:'Advanced',notes:[{"s": 0, "f": 17, "degree": "5"}, {"s": 0, "f": 17, "degree": "5"}, {"s": 0, "f": 20, "degree": "b7"}, {"s": 0, "f": 20, "degree": "b7"}, {"s": 1, "f": 17, "degree": "1"}, {"s": 1, "f": 17, "degree": "1"}, {"s": 1, "f": 17, "degree": "1"}]},
      {id:'box4_D_37',root:'D',difficulty:'Beginner',notes:[{"s": 2, "f": 17, "degree": "4"}, {"s": 2, "f": 17, "degree": "4"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 19, "degree": "1"}]},
      {id:'box4_D_38',root:'D',difficulty:'Intermediate',notes:[{"s": 4, "f": 20, "degree": "4"}, {"s": 4, "f": 20, "degree": "4"}, {"s": 4, "f": 18, "degree": "b3"}, {"s": 4, "f": 18, "degree": "b3"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 3, "f": 17, "degree": "b7"}]},
      {id:'box4_D_39',root:'D',difficulty:'Advanced',notes:[{"s": 3, "f": 19, "degree": "1"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 2, "f": 17, "degree": "4"}, {"s": 2, "f": 17, "degree": "4"}]},
      {id:'box4_D_40',root:'D',difficulty:'Beginner',notes:[{"s": 0, "f": 20, "degree": "b7"}, {"s": 0, "f": 20, "degree": "b7"}, {"s": 1, "f": 17, "degree": "1"}, {"s": 1, "f": 17, "degree": "1"}, {"s": 1, "f": 20, "degree": "b3"}, {"s": 1, "f": 20, "degree": "b3"}]},
      {id:'box4_D_41',root:'D',difficulty:'Intermediate',notes:[{"s": 3, "f": 19, "degree": "1"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 2, "f": 17, "degree": "4"}]},
      {id:'box4_D_42',root:'D',difficulty:'Advanced',notes:[{"s": 2, "f": 19, "degree": "5"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 4, "f": 18, "degree": "b3"}, {"s": 4, "f": 18, "degree": "b3"}]},
      {id:'box4_D_43',root:'D',difficulty:'Beginner',notes:[{"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 2, "f": 17, "degree": "4"}, {"s": 2, "f": 17, "degree": "4"}]},
      {id:'box4_D_44',root:'D',difficulty:'Intermediate',notes:[{"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 4, "f": 18, "degree": "b3"}, {"s": 4, "f": 18, "degree": "b3"}, {"s": 4, "f": 20, "degree": "4"}]},
      {id:'box4_D_45',root:'D',difficulty:'Advanced',notes:[{"s": 2, "f": 19, "degree": "5"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 4, "f": 18, "degree": "b3"}, {"s": 3, "f": 19, "degree": "1"}]},
      {id:'box4_D_46',root:'D',difficulty:'Beginner',notes:[{"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 4, "f": 18, "degree": "b3"}, {"s": 3, "f": 19, "degree": "1"}]},
      {id:'box4_D_47',root:'D',difficulty:'Intermediate',notes:[{"s": 4, "f": 20, "degree": "4"}, {"s": 4, "f": 18, "degree": "b3"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 2, "f": 17, "degree": "4"}]},
      {id:'box4_D_48',root:'D',difficulty:'Advanced',notes:[{"s": 1, "f": 20, "degree": "b3"}, {"s": 1, "f": 20, "degree": "b3"}, {"s": 1, "f": 17, "degree": "1"}, {"s": 1, "f": 17, "degree": "1"}, {"s": 0, "f": 20, "degree": "b7"}, {"s": 0, "f": 20, "degree": "b7"}, {"s": 0, "f": 17, "degree": "5"}]},
      {id:'box4_D_49',root:'D',difficulty:'Beginner',notes:[{"s": 2, "f": 17, "degree": "4"}, {"s": 2, "f": 19, "degree": "5"}, {"s": 3, "f": 17, "degree": "b7"}, {"s": 3, "f": 19, "degree": "1"}, {"s": 4, "f": 18, "degree": "b3"}, {"s": 4, "f": 20, "degree": "4"}]},
    ],
    5: [
      {id:'box5_A_0',root:'A',difficulty:'Beginner',notes:[{"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}]},
      {id:'box5_A_1',root:'A',difficulty:'Intermediate',notes:[{"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}]},
      {id:'box5_A_2',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 2, "degree": "5"}]},
      {id:'box5_A_3',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}]},
      {id:'box5_A_4',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 3, "degree": "b7"}]},
      {id:'box5_A_5',root:'A',difficulty:'Advanced',notes:[{"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}]},
      {id:'box5_A_6',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 2, "degree": "5"}]},
      {id:'box5_A_7',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}]},
      {id:'box5_A_8',root:'A',difficulty:'Advanced',notes:[{"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}]},
      {id:'box5_A_9',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}]},
      {id:'box5_A_10',root:'A',difficulty:'Intermediate',notes:[{"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}]},
      {id:'box5_A_11',root:'A',difficulty:'Advanced',notes:[{"s": 1, "f": 3, "degree": "b3"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 3, "degree": "b7"}, {"s": 0, "f": 3, "degree": "b7"}, {"s": 0, "f": 3, "degree": "b7"}]},
      {id:'box5_A_12',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "b7"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}]},
      {id:'box5_A_13',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}]},
      {id:'box5_A_14',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 2, "degree": "5"}]},
      {id:'box5_A_15',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 2, "degree": "5"}]},
      {id:'box5_A_16',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}]},
      {id:'box5_E_17',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 12, "degree": "5"}]},
      {id:'box5_E_18',root:'E',difficulty:'Intermediate',notes:[{"s": 4, "f": 12, "degree": "5"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 9, "degree": "5"}]},
      {id:'box5_E_19',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 12, "degree": "5"}]},
      {id:'box5_E_20',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 2, "f": 12, "degree": "b7"}]},
      {id:'box5_E_21',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 12, "degree": "5"}, {"s": 4, "f": 12, "degree": "5"}]},
      {id:'box5_E_22',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 12, "degree": "5"}, {"s": 4, "f": 12, "degree": "5"}]},
      {id:'box5_E_23',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 12, "degree": "b7"}]},
      {id:'box5_E_24',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}]},
      {id:'box5_E_25',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}]},
      {id:'box5_E_26',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 12, "degree": "5"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 2, "f": 12, "degree": "b7"}]},
      {id:'box5_E_27',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box5_E_28',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 12, "degree": "5"}]},
      {id:'box5_E_29',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 12, "degree": "5"}]},
      {id:'box5_E_30',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 12, "degree": "4"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 12, "degree": "1"}]},
      {id:'box5_E_31',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 12, "degree": "5"}]},
      {id:'box5_E_32',root:'E',difficulty:'Beginner',notes:[{"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}]},
      {id:'box5_E_33',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}]},
      {id:'box5_D_34',root:'D',difficulty:'Beginner',notes:[{"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 2, "f": 10, "degree": "b7"}]},
      {id:'box5_D_35',root:'D',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "4"}, {"s": 1, "f": 10, "degree": "4"}, {"s": 1, "f": 8, "degree": "b3"}, {"s": 1, "f": 8, "degree": "b3"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 0, "f": 10, "degree": "1"}]},
      {id:'box5_D_36',root:'D',difficulty:'Advanced',notes:[{"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 4, "f": 8, "degree": "4"}, {"s": 4, "f": 8, "degree": "4"}, {"s": 4, "f": 10, "degree": "5"}]},
      {id:'box5_D_37',root:'D',difficulty:'Beginner',notes:[{"s": 2, "f": 7, "degree": "5"}, {"s": 2, "f": 10, "degree": "b7"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 4, "f": 8, "degree": "4"}]},
      {id:'box5_D_38',root:'D',difficulty:'Intermediate',notes:[{"s": 4, "f": 10, "degree": "5"}, {"s": 4, "f": 8, "degree": "4"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 2, "f": 10, "degree": "b7"}, {"s": 2, "f": 7, "degree": "5"}]},
      {id:'box5_D_39',root:'D',difficulty:'Advanced',notes:[{"s": 2, "f": 7, "degree": "5"}, {"s": 2, "f": 7, "degree": "5"}, {"s": 2, "f": 10, "degree": "b7"}, {"s": 2, "f": 10, "degree": "b7"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 10, "degree": "b3"}]},
      {id:'box5_D_40',root:'D',difficulty:'Beginner',notes:[{"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 2, "f": 10, "degree": "b7"}, {"s": 2, "f": 10, "degree": "b7"}]},
      {id:'box5_D_41',root:'D',difficulty:'Intermediate',notes:[{"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 4, "f": 8, "degree": "4"}, {"s": 4, "f": 8, "degree": "4"}, {"s": 4, "f": 10, "degree": "5"}]},
      {id:'box5_D_42',root:'D',difficulty:'Advanced',notes:[{"s": 1, "f": 8, "degree": "b3"}, {"s": 1, "f": 8, "degree": "b3"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 0, "f": 8, "degree": "b7"}, {"s": 0, "f": 8, "degree": "b7"}, {"s": 0, "f": 10, "degree": "1"}]},
      {id:'box5_D_43',root:'D',difficulty:'Beginner',notes:[{"s": 0, "f": 8, "degree": "b7"}, {"s": 0, "f": 8, "degree": "b7"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 1, "f": 8, "degree": "b3"}, {"s": 0, "f": 10, "degree": "1"}]},
      {id:'box5_D_44',root:'D',difficulty:'Intermediate',notes:[{"s": 2, "f": 7, "degree": "5"}, {"s": 2, "f": 10, "degree": "b7"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 4, "f": 8, "degree": "4"}, {"s": 4, "f": 10, "degree": "5"}]},
      {id:'box5_D_45',root:'D',difficulty:'Advanced',notes:[{"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 4, "f": 8, "degree": "4"}, {"s": 4, "f": 8, "degree": "4"}, {"s": 4, "f": 10, "degree": "5"}]},
      {id:'box5_D_46',root:'D',difficulty:'Beginner',notes:[{"s": 1, "f": 10, "degree": "4"}, {"s": 1, "f": 8, "degree": "b3"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 0, "f": 8, "degree": "b7"}, {"s": 0, "f": 8, "degree": "b7"}, {"s": 0, "f": 10, "degree": "1"}]},
      {id:'box5_D_47',root:'D',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "4"}, {"s": 1, "f": 8, "degree": "b3"}, {"s": 0, "f": 10, "degree": "1"}, {"s": 0, "f": 8, "degree": "b7"}, {"s": 0, "f": 8, "degree": "b7"}, {"s": 0, "f": 8, "degree": "b7"}]},
      {id:'box5_D_48',root:'D',difficulty:'Advanced',notes:[{"s": 2, "f": 10, "degree": "b7"}, {"s": 2, "f": 10, "degree": "b7"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 4, "f": 8, "degree": "4"}, {"s": 4, "f": 8, "degree": "4"}]},
      {id:'box5_D_49',root:'D',difficulty:'Beginner',notes:[{"s": 4, "f": 10, "degree": "5"}, {"s": 4, "f": 8, "degree": "4"}, {"s": 3, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "1"}, {"s": 3, "f": 7, "degree": "1"}]},
    ],
  },
  'Major Pentatonic': {
    1: [
      {id:'box1_G_0',root:'G',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}]},
      {id:'box1_G_1',root:'G',difficulty:'Intermediate',notes:[{"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}]},
      {id:'box1_G_2',root:'G',difficulty:'Advanced',notes:[{"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}]},
      {id:'box1_G_3',root:'G',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}]},
      {id:'box1_G_4',root:'G',difficulty:'Intermediate',notes:[{"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}]},
      {id:'box1_G_5',root:'G',difficulty:'Advanced',notes:[{"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}]},
      {id:'box1_G_6',root:'G',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}]},
      {id:'box1_G_7',root:'G',difficulty:'Intermediate',notes:[{"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}]},
      {id:'box1_G_8',root:'G',difficulty:'Advanced',notes:[{"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}]},
      {id:'box1_G_9',root:'G',difficulty:'Beginner',notes:[{"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}]},
      {id:'box1_G_10',root:'G',difficulty:'Intermediate',notes:[{"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}]},
      {id:'box1_G_11',root:'G',difficulty:'Advanced',notes:[{"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 5, "degree": "1"}]},
      {id:'box1_G_12',root:'G',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}]},
      {id:'box1_G_13',root:'G',difficulty:'Intermediate',notes:[{"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 5, "degree": "1"}]},
      {id:'box1_G_14',root:'G',difficulty:'Advanced',notes:[{"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 5, "degree": "1"}]},
      {id:'box1_G_15',root:'G',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}]},
      {id:'box1_G_16',root:'G',difficulty:'Intermediate',notes:[{"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}]},
      {id:'box1_G_17',root:'G',difficulty:'Advanced',notes:[{"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 5, "degree": "1"}]},
      {id:'box1_G_18',root:'G',difficulty:'Beginner',notes:[{"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 5, "degree": "1"}]},
      {id:'box1_G_19',root:'G',difficulty:'Intermediate',notes:[{"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}]},
      {id:'box1_G_20',root:'G',difficulty:'Advanced',notes:[{"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}]},
      {id:'box1_G_21',root:'G',difficulty:'Beginner',notes:[{"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 5, "degree": "1"}]},
      {id:'box1_G_22',root:'G',difficulty:'Intermediate',notes:[{"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}]},
      {id:'box1_G_23',root:'G',difficulty:'Advanced',notes:[{"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 5, "degree": "1"}]},
      {id:'box1_G_24',root:'G',difficulty:'Beginner',notes:[{"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 4, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}]},
      {id:'box1_C_25',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}]},
      {id:'box1_C_26',root:'C',difficulty:'Intermediate',notes:[{"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}]},
      {id:'box1_C_27',root:'C',difficulty:'Advanced',notes:[{"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 10, "degree": "1"}]},
      {id:'box1_C_28',root:'C',difficulty:'Beginner',notes:[{"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 10, "degree": "1"}]},
      {id:'box1_C_29',root:'C',difficulty:'Intermediate',notes:[{"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}]},
      {id:'box1_C_30',root:'C',difficulty:'Advanced',notes:[{"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}]},
      {id:'box1_C_31',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}]},
      {id:'box1_C_32',root:'C',difficulty:'Intermediate',notes:[{"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}]},
      {id:'box1_C_33',root:'C',difficulty:'Advanced',notes:[{"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 10, "degree": "1"}]},
      {id:'box1_C_34',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}]},
      {id:'box1_C_35',root:'C',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 10, "degree": "1"}]},
      {id:'box1_C_36',root:'C',difficulty:'Advanced',notes:[{"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}]},
      {id:'box1_C_37',root:'C',difficulty:'Beginner',notes:[{"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 10, "degree": "1"}]},
      {id:'box1_C_38',root:'C',difficulty:'Intermediate',notes:[{"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}]},
      {id:'box1_C_39',root:'C',difficulty:'Advanced',notes:[{"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 10, "degree": "1"}]},
      {id:'box1_C_40',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}]},
      {id:'box1_C_41',root:'C',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 10, "degree": "1"}]},
      {id:'box1_C_42',root:'C',difficulty:'Advanced',notes:[{"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}]},
      {id:'box1_C_43',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}]},
      {id:'box1_C_44',root:'C',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}]},
      {id:'box1_C_45',root:'C',difficulty:'Advanced',notes:[{"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}]},
      {id:'box1_C_46',root:'C',difficulty:'Beginner',notes:[{"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 10, "degree": "1"}]},
      {id:'box1_C_47',root:'C',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 10, "degree": "1"}]},
      {id:'box1_C_48',root:'C',difficulty:'Advanced',notes:[{"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 10, "degree": "1"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}]},
      {id:'box1_C_49',root:'C',difficulty:'Beginner',notes:[{"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 3, "f": 9, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}]},
    ],
    2: [
      {id:'box2_G_0',root:'G',difficulty:'Beginner',notes:[{"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "5"}]},
      {id:'box2_G_1',root:'G',difficulty:'Intermediate',notes:[{"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}]},
      {id:'box2_G_2',root:'G',difficulty:'Advanced',notes:[{"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 7, "degree": "6"}]},
      {id:'box2_G_3',root:'G',difficulty:'Beginner',notes:[{"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 7, "degree": "6"}]},
      {id:'box2_G_4',root:'G',difficulty:'Intermediate',notes:[{"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 7, "degree": "6"}]},
      {id:'box2_G_5',root:'G',difficulty:'Advanced',notes:[{"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}]},
      {id:'box2_G_6',root:'G',difficulty:'Beginner',notes:[{"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 7, "degree": "6"}]},
      {id:'box2_G_7',root:'G',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}]},
      {id:'box2_G_8',root:'G',difficulty:'Advanced',notes:[{"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}]},
      {id:'box2_G_9',root:'G',difficulty:'Beginner',notes:[{"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "5"}]},
      {id:'box2_G_10',root:'G',difficulty:'Intermediate',notes:[{"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 5, "degree": "2"}]},
      {id:'box2_G_11',root:'G',difficulty:'Advanced',notes:[{"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}]},
      {id:'box2_G_12',root:'G',difficulty:'Beginner',notes:[{"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 5, "degree": "2"}]},
      {id:'box2_G_13',root:'G',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}]},
      {id:'box2_G_14',root:'G',difficulty:'Advanced',notes:[{"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 7, "degree": "6"}]},
      {id:'box2_G_15',root:'G',difficulty:'Beginner',notes:[{"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}]},
      {id:'box2_G_16',root:'G',difficulty:'Intermediate',notes:[{"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}]},
      {id:'box2_G_17',root:'G',difficulty:'Advanced',notes:[{"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 7, "degree": "6"}]},
      {id:'box2_G_18',root:'G',difficulty:'Beginner',notes:[{"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 7, "degree": "6"}]},
      {id:'box2_G_19',root:'G',difficulty:'Intermediate',notes:[{"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}]},
      {id:'box2_G_20',root:'G',difficulty:'Advanced',notes:[{"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}]},
      {id:'box2_G_21',root:'G',difficulty:'Beginner',notes:[{"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}]},
      {id:'box2_G_22',root:'G',difficulty:'Intermediate',notes:[{"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}]},
      {id:'box2_G_23',root:'G',difficulty:'Advanced',notes:[{"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 5, "degree": "2"}, {"s": 0, "f": 5, "degree": "2"}]},
      {id:'box2_G_24',root:'G',difficulty:'Beginner',notes:[{"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 5, "degree": "5"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 7, "degree": "6"}]},
      {id:'box2_C_25',root:'C',difficulty:'Beginner',notes:[{"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}]},
      {id:'box2_C_26',root:'C',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_27',root:'C',difficulty:'Advanced',notes:[{"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_28',root:'C',difficulty:'Beginner',notes:[{"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}]},
      {id:'box2_C_29',root:'C',difficulty:'Intermediate',notes:[{"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_30',root:'C',difficulty:'Advanced',notes:[{"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_31',root:'C',difficulty:'Beginner',notes:[{"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_32',root:'C',difficulty:'Intermediate',notes:[{"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_33',root:'C',difficulty:'Advanced',notes:[{"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 12, "degree": "6"}]},
      {id:'box2_C_34',root:'C',difficulty:'Beginner',notes:[{"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_35',root:'C',difficulty:'Intermediate',notes:[{"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_36',root:'C',difficulty:'Advanced',notes:[{"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_37',root:'C',difficulty:'Beginner',notes:[{"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_38',root:'C',difficulty:'Intermediate',notes:[{"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 12, "degree": "6"}]},
      {id:'box2_C_39',root:'C',difficulty:'Advanced',notes:[{"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_40',root:'C',difficulty:'Beginner',notes:[{"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_41',root:'C',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_42',root:'C',difficulty:'Advanced',notes:[{"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_43',root:'C',difficulty:'Beginner',notes:[{"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}]},
      {id:'box2_C_44',root:'C',difficulty:'Intermediate',notes:[{"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 12, "degree": "6"}]},
      {id:'box2_C_45',root:'C',difficulty:'Advanced',notes:[{"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}]},
      {id:'box2_C_46',root:'C',difficulty:'Beginner',notes:[{"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 1, "f": 10, "degree": "5"}]},
      {id:'box2_C_47',root:'C',difficulty:'Intermediate',notes:[{"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 12, "degree": "6"}]},
      {id:'box2_C_48',root:'C',difficulty:'Advanced',notes:[{"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 12, "degree": "6"}]},
      {id:'box2_C_49',root:'C',difficulty:'Beginner',notes:[{"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 10, "degree": "2"}, {"s": 0, "f": 10, "degree": "2"}]},
    ],
    3: [
      {id:'box3_G_0',root:'G',difficulty:'Beginner',notes:[{"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 10, "degree": "2"}]},
      {id:'box3_G_1',root:'G',difficulty:'Intermediate',notes:[{"s": 4, "f": 10, "degree": "2"}, {"s": 4, "f": 10, "degree": "2"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 7, "degree": "5"}]},
      {id:'box3_G_2',root:'G',difficulty:'Advanced',notes:[{"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}]},
      {id:'box3_G_3',root:'G',difficulty:'Beginner',notes:[{"s": 4, "f": 8, "degree": "1"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}]},
      {id:'box3_G_4',root:'G',difficulty:'Intermediate',notes:[{"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}]},
      {id:'box3_G_5',root:'G',difficulty:'Advanced',notes:[{"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}]},
      {id:'box3_G_6',root:'G',difficulty:'Beginner',notes:[{"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 7, "degree": "5"}]},
      {id:'box3_G_7',root:'G',difficulty:'Intermediate',notes:[{"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 10, "degree": "2"}, {"s": 4, "f": 10, "degree": "2"}]},
      {id:'box3_G_8',root:'G',difficulty:'Advanced',notes:[{"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 8, "degree": "1"}]},
      {id:'box3_G_9',root:'G',difficulty:'Beginner',notes:[{"s": 4, "f": 8, "degree": "1"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}]},
      {id:'box3_G_10',root:'G',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}]},
      {id:'box3_G_11',root:'G',difficulty:'Advanced',notes:[{"s": 2, "f": 9, "degree": "3"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 8, "degree": "1"}]},
      {id:'box3_G_12',root:'G',difficulty:'Beginner',notes:[{"s": 4, "f": 10, "degree": "2"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}]},
      {id:'box3_G_13',root:'G',difficulty:'Intermediate',notes:[{"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 8, "degree": "1"}]},
      {id:'box3_G_14',root:'G',difficulty:'Advanced',notes:[{"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}]},
      {id:'box3_G_15',root:'G',difficulty:'Beginner',notes:[{"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 8, "degree": "1"}]},
      {id:'box3_G_16',root:'G',difficulty:'Intermediate',notes:[{"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}]},
      {id:'box3_G_17',root:'G',difficulty:'Advanced',notes:[{"s": 4, "f": 10, "degree": "2"}, {"s": 4, "f": 10, "degree": "2"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 7, "degree": "5"}]},
      {id:'box3_G_18',root:'G',difficulty:'Beginner',notes:[{"s": 4, "f": 10, "degree": "2"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 2, "f": 7, "degree": "2"}]},
      {id:'box3_G_19',root:'G',difficulty:'Intermediate',notes:[{"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 1, "f": 10, "degree": "1"}]},
      {id:'box3_G_20',root:'G',difficulty:'Advanced',notes:[{"s": 2, "f": 9, "degree": "3"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 8, "degree": "1"}]},
      {id:'box3_G_21',root:'G',difficulty:'Beginner',notes:[{"s": 2, "f": 9, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 10, "degree": "2"}]},
      {id:'box3_G_22',root:'G',difficulty:'Intermediate',notes:[{"s": 2, "f": 7, "degree": "2"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 8, "degree": "1"}]},
      {id:'box3_G_23',root:'G',difficulty:'Advanced',notes:[{"s": 2, "f": 9, "degree": "3"}, {"s": 2, "f": 9, "degree": "3"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 7, "degree": "5"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 3, "f": 9, "degree": "6"}, {"s": 4, "f": 8, "degree": "1"}, {"s": 4, "f": 8, "degree": "1"}]},
      {id:'box3_G_24',root:'G',difficulty:'Beginner',notes:[{"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 7, "degree": "6"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}, {"s": 0, "f": 7, "degree": "3"}]},
      {id:'box3_C_25',root:'C',difficulty:'Beginner',notes:[{"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 2, "f": 14, "degree": "3"}]},
      {id:'box3_C_26',root:'C',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 15, "degree": "2"}]},
      {id:'box3_C_27',root:'C',difficulty:'Advanced',notes:[{"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 15, "degree": "2"}]},
      {id:'box3_C_28',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 13, "degree": "1"}]},
      {id:'box3_C_29',root:'C',difficulty:'Intermediate',notes:[{"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 12, "degree": "6"}, {"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 15, "degree": "5"}]},
      {id:'box3_C_30',root:'C',difficulty:'Advanced',notes:[{"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 13, "degree": "1"}]},
      {id:'box3_C_31',root:'C',difficulty:'Beginner',notes:[{"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 12, "degree": "6"}, {"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}]},
      {id:'box3_C_32',root:'C',difficulty:'Intermediate',notes:[{"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}]},
      {id:'box3_C_33',root:'C',difficulty:'Advanced',notes:[{"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}]},
      {id:'box3_C_34',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 13, "degree": "1"}]},
      {id:'box3_C_35',root:'C',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 13, "degree": "1"}]},
      {id:'box3_C_36',root:'C',difficulty:'Advanced',notes:[{"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 12, "degree": "5"}]},
      {id:'box3_C_37',root:'C',difficulty:'Beginner',notes:[{"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}]},
      {id:'box3_C_38',root:'C',difficulty:'Intermediate',notes:[{"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}]},
      {id:'box3_C_39',root:'C',difficulty:'Advanced',notes:[{"s": 1, "f": 12, "degree": "6"}, {"s": 1, "f": 12, "degree": "6"}, {"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}, {"s": 0, "f": 12, "degree": "3"}]},
      {id:'box3_C_40',root:'C',difficulty:'Beginner',notes:[{"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}]},
      {id:'box3_C_41',root:'C',difficulty:'Intermediate',notes:[{"s": 2, "f": 14, "degree": "3"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 4, "f": 13, "degree": "1"}]},
      {id:'box3_C_42',root:'C',difficulty:'Advanced',notes:[{"s": 2, "f": 14, "degree": "3"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 13, "degree": "1"}]},
      {id:'box3_C_43',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 14, "degree": "3"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 4, "f": 13, "degree": "1"}]},
      {id:'box3_C_44',root:'C',difficulty:'Intermediate',notes:[{"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 15, "degree": "2"}]},
      {id:'box3_C_45',root:'C',difficulty:'Advanced',notes:[{"s": 4, "f": 13, "degree": "1"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 2, "f": 14, "degree": "3"}]},
      {id:'box3_C_46',root:'C',difficulty:'Beginner',notes:[{"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}]},
      {id:'box3_C_47',root:'C',difficulty:'Intermediate',notes:[{"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 2, "f": 14, "degree": "3"}]},
      {id:'box3_C_48',root:'C',difficulty:'Advanced',notes:[{"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 2, "f": 14, "degree": "3"}, {"s": 2, "f": 12, "degree": "2"}, {"s": 2, "f": 12, "degree": "2"}]},
      {id:'box3_C_49',root:'C',difficulty:'Beginner',notes:[{"s": 4, "f": 15, "degree": "2"}, {"s": 4, "f": 13, "degree": "1"}, {"s": 3, "f": 14, "degree": "6"}, {"s": 3, "f": 12, "degree": "5"}, {"s": 2, "f": 14, "degree": "3"}]},
    ],
    4: [
      {id:'box4_G_0',root:'G',difficulty:'Beginner',notes:[{"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 12, "degree": "2"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 14, "degree": "6"}]},
      {id:'box4_G_1',root:'G',difficulty:'Intermediate',notes:[{"s": 1, "f": 12, "degree": "2"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}]},
      {id:'box4_G_2',root:'G',difficulty:'Advanced',notes:[{"s": 2, "f": 12, "degree": "5"}, {"s": 2, "f": 12, "degree": "5"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 3, "f": 14, "degree": "2"}, {"s": 3, "f": 12, "degree": "1"}]},
      {id:'box4_G_3',root:'G',difficulty:'Beginner',notes:[{"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}]},
      {id:'box4_G_4',root:'G',difficulty:'Intermediate',notes:[{"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}]},
      {id:'box4_G_5',root:'G',difficulty:'Advanced',notes:[{"s": 3, "f": 14, "degree": "2"}, {"s": 3, "f": 14, "degree": "2"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 12, "degree": "5"}, {"s": 2, "f": 12, "degree": "5"}]},
      {id:'box4_G_6',root:'G',difficulty:'Beginner',notes:[{"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 12, "degree": "2"}]},
      {id:'box4_G_7',root:'G',difficulty:'Intermediate',notes:[{"s": 1, "f": 12, "degree": "2"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}]},
      {id:'box4_G_8',root:'G',difficulty:'Advanced',notes:[{"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 12, "degree": "2"}, {"s": 1, "f": 12, "degree": "2"}]},
      {id:'box4_G_9',root:'G',difficulty:'Beginner',notes:[{"s": 1, "f": 12, "degree": "2"}, {"s": 1, "f": 12, "degree": "2"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "1"}]},
      {id:'box4_G_10',root:'G',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "1"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 12, "degree": "5"}, {"s": 2, "f": 12, "degree": "5"}]},
      {id:'box4_G_11',root:'G',difficulty:'Advanced',notes:[{"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 12, "degree": "5"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}]},
      {id:'box4_G_12',root:'G',difficulty:'Beginner',notes:[{"s": 3, "f": 12, "degree": "1"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 12, "degree": "5"}, {"s": 2, "f": 12, "degree": "5"}]},
      {id:'box4_G_13',root:'G',difficulty:'Intermediate',notes:[{"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 12, "degree": "2"}, {"s": 1, "f": 10, "degree": "1"}]},
      {id:'box4_G_14',root:'G',difficulty:'Advanced',notes:[{"s": 3, "f": 14, "degree": "2"}, {"s": 3, "f": 14, "degree": "2"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 12, "degree": "5"}]},
      {id:'box4_G_15',root:'G',difficulty:'Beginner',notes:[{"s": 3, "f": 14, "degree": "2"}, {"s": 3, "f": 14, "degree": "2"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 2, "f": 14, "degree": "6"}]},
      {id:'box4_G_16',root:'G',difficulty:'Intermediate',notes:[{"s": 3, "f": 14, "degree": "2"}, {"s": 3, "f": 14, "degree": "2"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 1, "f": 10, "degree": "1"}]},
      {id:'box4_G_17',root:'G',difficulty:'Advanced',notes:[{"s": 1, "f": 12, "degree": "2"}, {"s": 1, "f": 12, "degree": "2"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 10, "degree": "5"}]},
      {id:'box4_G_18',root:'G',difficulty:'Beginner',notes:[{"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 12, "degree": "2"}]},
      {id:'box4_G_19',root:'G',difficulty:'Intermediate',notes:[{"s": 1, "f": 12, "degree": "2"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}]},
      {id:'box4_G_20',root:'G',difficulty:'Advanced',notes:[{"s": 1, "f": 12, "degree": "2"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}]},
      {id:'box4_G_21',root:'G',difficulty:'Beginner',notes:[{"s": 3, "f": 14, "degree": "2"}, {"s": 3, "f": 14, "degree": "2"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 3, "f": 12, "degree": "1"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 14, "degree": "6"}]},
      {id:'box4_G_22',root:'G',difficulty:'Intermediate',notes:[{"s": 2, "f": 14, "degree": "6"}, {"s": 2, "f": 12, "degree": "5"}, {"s": 2, "f": 14, "degree": "6"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}]},
      {id:'box4_G_23',root:'G',difficulty:'Advanced',notes:[{"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}]},
      {id:'box4_G_24',root:'G',difficulty:'Beginner',notes:[{"s": 1, "f": 10, "degree": "1"}, {"s": 1, "f": 10, "degree": "1"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 12, "degree": "6"}, {"s": 0, "f": 10, "degree": "5"}, {"s": 0, "f": 10, "degree": "5"}]},
      {id:'box4_C_25',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 15, "degree": "1"}]},
      {id:'box4_C_26',root:'C',difficulty:'Intermediate',notes:[{"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}]},
      {id:'box4_C_27',root:'C',difficulty:'Advanced',notes:[{"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 19, "degree": "2"}, {"s": 3, "f": 19, "degree": "2"}]},
      {id:'box4_C_28',root:'C',difficulty:'Beginner',notes:[{"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 17, "degree": "2"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 1, "f": 15, "degree": "1"}]},
      {id:'box4_C_29',root:'C',difficulty:'Intermediate',notes:[{"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 17, "degree": "2"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}]},
      {id:'box4_C_30',root:'C',difficulty:'Advanced',notes:[{"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 15, "degree": "5"}]},
      {id:'box4_C_31',root:'C',difficulty:'Beginner',notes:[{"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 0, "f": 15, "degree": "5"}]},
      {id:'box4_C_32',root:'C',difficulty:'Intermediate',notes:[{"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 15, "degree": "5"}]},
      {id:'box4_C_33',root:'C',difficulty:'Advanced',notes:[{"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 17, "degree": "2"}, {"s": 1, "f": 17, "degree": "2"}]},
      {id:'box4_C_34',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 19, "degree": "2"}, {"s": 3, "f": 19, "degree": "2"}]},
      {id:'box4_C_35',root:'C',difficulty:'Intermediate',notes:[{"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}]},
      {id:'box4_C_36',root:'C',difficulty:'Advanced',notes:[{"s": 1, "f": 17, "degree": "2"}, {"s": 1, "f": 17, "degree": "2"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 15, "degree": "5"}]},
      {id:'box4_C_37',root:'C',difficulty:'Beginner',notes:[{"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 17, "degree": "5"}]},
      {id:'box4_C_38',root:'C',difficulty:'Intermediate',notes:[{"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 17, "degree": "5"}]},
      {id:'box4_C_39',root:'C',difficulty:'Advanced',notes:[{"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 19, "degree": "2"}, {"s": 3, "f": 17, "degree": "1"}]},
      {id:'box4_C_40',root:'C',difficulty:'Beginner',notes:[{"s": 3, "f": 19, "degree": "2"}, {"s": 3, "f": 19, "degree": "2"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 2, "f": 19, "degree": "6"}]},
      {id:'box4_C_41',root:'C',difficulty:'Intermediate',notes:[{"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 19, "degree": "2"}, {"s": 3, "f": 19, "degree": "2"}]},
      {id:'box4_C_42',root:'C',difficulty:'Advanced',notes:[{"s": 3, "f": 19, "degree": "2"}, {"s": 3, "f": 19, "degree": "2"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 17, "degree": "5"}]},
      {id:'box4_C_43',root:'C',difficulty:'Beginner',notes:[{"s": 0, "f": 17, "degree": "6"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 17, "degree": "2"}, {"s": 1, "f": 15, "degree": "1"}]},
      {id:'box4_C_44',root:'C',difficulty:'Intermediate',notes:[{"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}]},
      {id:'box4_C_45',root:'C',difficulty:'Advanced',notes:[{"s": 3, "f": 19, "degree": "2"}, {"s": 3, "f": 19, "degree": "2"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 17, "degree": "5"}]},
      {id:'box4_C_46',root:'C',difficulty:'Beginner',notes:[{"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 1, "f": 15, "degree": "1"}]},
      {id:'box4_C_47',root:'C',difficulty:'Intermediate',notes:[{"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 17, "degree": "5"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}]},
      {id:'box4_C_48',root:'C',difficulty:'Advanced',notes:[{"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 15, "degree": "5"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 0, "f": 17, "degree": "6"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 15, "degree": "1"}, {"s": 1, "f": 17, "degree": "2"}, {"s": 1, "f": 15, "degree": "1"}]},
      {id:'box4_C_49',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 19, "degree": "6"}, {"s": 2, "f": 19, "degree": "6"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}, {"s": 3, "f": 17, "degree": "1"}]},
    ],
    5: [
      {id:'box5_G_0',root:'G',difficulty:'Beginner',notes:[{"s": 4, "f": 3, "degree": "5"}, {"s": 4, "f": 3, "degree": "5"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 0, "degree": "1"}]},
      {id:'box5_G_1',root:'G',difficulty:'Intermediate',notes:[{"s": 2, "f": 0, "degree": "5"}, {"s": 2, "f": 2, "degree": "6"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 4, "f": 3, "degree": "5"}, {"s": 4, "f": 3, "degree": "5"}]},
      {id:'box5_G_2',root:'G',difficulty:'Advanced',notes:[{"s": 1, "f": 2, "degree": "3"}, {"s": 1, "f": 0, "degree": "2"}, {"s": 0, "f": 3, "degree": "1"}, {"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 0, "degree": "6"}]},
      {id:'box5_G_3',root:'G',difficulty:'Beginner',notes:[{"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 2, "f": 2, "degree": "6"}, {"s": 2, "f": 2, "degree": "6"}, {"s": 2, "f": 0, "degree": "5"}]},
      {id:'box5_G_4',root:'G',difficulty:'Intermediate',notes:[{"s": 4, "f": 3, "degree": "5"}, {"s": 4, "f": 3, "degree": "5"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 0, "degree": "1"}]},
      {id:'box5_G_5',root:'G',difficulty:'Advanced',notes:[{"s": 2, "f": 2, "degree": "6"}, {"s": 2, "f": 2, "degree": "6"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 4, "f": 0, "degree": "3"}]},
      {id:'box5_G_6',root:'G',difficulty:'Beginner',notes:[{"s": 4, "f": 3, "degree": "5"}, {"s": 4, "f": 3, "degree": "5"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 2, "degree": "2"}]},
      {id:'box5_G_7',root:'G',difficulty:'Intermediate',notes:[{"s": 1, "f": 2, "degree": "3"}, {"s": 1, "f": 0, "degree": "2"}, {"s": 0, "f": 3, "degree": "1"}, {"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 0, "degree": "6"}]},
      {id:'box5_G_8',root:'G',difficulty:'Advanced',notes:[{"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 4, "f": 3, "degree": "5"}]},
      {id:'box5_G_9',root:'G',difficulty:'Beginner',notes:[{"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 2, "f": 2, "degree": "6"}]},
      {id:'box5_G_10',root:'G',difficulty:'Intermediate',notes:[{"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 2, "f": 2, "degree": "6"}, {"s": 3, "f": 0, "degree": "1"}]},
      {id:'box5_G_11',root:'G',difficulty:'Advanced',notes:[{"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 4, "f": 3, "degree": "5"}]},
      {id:'box5_G_12',root:'G',difficulty:'Beginner',notes:[{"s": 2, "f": 0, "degree": "5"}, {"s": 2, "f": 2, "degree": "6"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 4, "f": 3, "degree": "5"}]},
      {id:'box5_G_13',root:'G',difficulty:'Intermediate',notes:[{"s": 2, "f": 0, "degree": "5"}, {"s": 2, "f": 2, "degree": "6"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 4, "f": 3, "degree": "5"}]},
      {id:'box5_G_14',root:'G',difficulty:'Advanced',notes:[{"s": 4, "f": 3, "degree": "5"}, {"s": 4, "f": 3, "degree": "5"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 0, "degree": "1"}]},
      {id:'box5_G_15',root:'G',difficulty:'Beginner',notes:[{"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 4, "f": 0, "degree": "3"}]},
      {id:'box5_G_16',root:'G',difficulty:'Intermediate',notes:[{"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 3, "degree": "1"}, {"s": 0, "f": 3, "degree": "1"}, {"s": 1, "f": 0, "degree": "2"}, {"s": 1, "f": 0, "degree": "2"}, {"s": 1, "f": 2, "degree": "3"}]},
      {id:'box5_G_17',root:'G',difficulty:'Advanced',notes:[{"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 3, "degree": "1"}, {"s": 0, "f": 3, "degree": "1"}, {"s": 1, "f": 0, "degree": "2"}, {"s": 1, "f": 0, "degree": "2"}, {"s": 0, "f": 3, "degree": "1"}]},
      {id:'box5_G_18',root:'G',difficulty:'Beginner',notes:[{"s": 1, "f": 0, "degree": "2"}, {"s": 1, "f": 0, "degree": "2"}, {"s": 0, "f": 3, "degree": "1"}, {"s": 0, "f": 3, "degree": "1"}, {"s": 0, "f": 0, "degree": "6"}]},
      {id:'box5_G_19',root:'G',difficulty:'Intermediate',notes:[{"s": 1, "f": 2, "degree": "3"}, {"s": 1, "f": 2, "degree": "3"}, {"s": 1, "f": 0, "degree": "2"}, {"s": 1, "f": 0, "degree": "2"}, {"s": 0, "f": 3, "degree": "1"}, {"s": 0, "f": 3, "degree": "1"}]},
      {id:'box5_G_20',root:'G',difficulty:'Advanced',notes:[{"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 2, "f": 2, "degree": "6"}, {"s": 2, "f": 2, "degree": "6"}, {"s": 2, "f": 0, "degree": "5"}]},
      {id:'box5_G_21',root:'G',difficulty:'Beginner',notes:[{"s": 4, "f": 3, "degree": "5"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 2, "f": 2, "degree": "6"}, {"s": 2, "f": 0, "degree": "5"}]},
      {id:'box5_G_22',root:'G',difficulty:'Intermediate',notes:[{"s": 4, "f": 3, "degree": "5"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 2, "f": 2, "degree": "6"}, {"s": 2, "f": 0, "degree": "5"}]},
      {id:'box5_G_23',root:'G',difficulty:'Advanced',notes:[{"s": 1, "f": 0, "degree": "2"}, {"s": 1, "f": 0, "degree": "2"}, {"s": 0, "f": 3, "degree": "1"}, {"s": 0, "f": 3, "degree": "1"}, {"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 0, "degree": "6"}, {"s": 0, "f": 0, "degree": "6"}]},
      {id:'box5_G_24',root:'G',difficulty:'Beginner',notes:[{"s": 4, "f": 3, "degree": "5"}, {"s": 4, "f": 0, "degree": "3"}, {"s": 3, "f": 2, "degree": "2"}, {"s": 3, "f": 0, "degree": "1"}, {"s": 2, "f": 2, "degree": "6"}, {"s": 2, "f": 0, "degree": "5"}]},
      {id:'box5_C_25',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 7, "degree": "6"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 4, "f": 5, "degree": "3"}, {"s": 4, "f": 8, "degree": "5"}]},
      {id:'box5_C_26',root:'C',difficulty:'Intermediate',notes:[{"s": 4, "f": 5, "degree": "3"}, {"s": 4, "f": 5, "degree": "3"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 5, "degree": "1"}]},
      {id:'box5_C_27',root:'C',difficulty:'Advanced',notes:[{"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 2, "f": 5, "degree": "5"}, {"s": 2, "f": 5, "degree": "5"}]},
      {id:'box5_C_28',root:'C',difficulty:'Beginner',notes:[{"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 3, "f": 5, "degree": "1"}]},
      {id:'box5_C_29',root:'C',difficulty:'Intermediate',notes:[{"s": 4, "f": 8, "degree": "5"}, {"s": 4, "f": 5, "degree": "3"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 2, "f": 5, "degree": "5"}]},
      {id:'box5_C_30',root:'C',difficulty:'Advanced',notes:[{"s": 1, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "2"}, {"s": 0, "f": 8, "degree": "1"}, {"s": 0, "f": 5, "degree": "6"}, {"s": 0, "f": 5, "degree": "6"}, {"s": 0, "f": 5, "degree": "6"}, {"s": 0, "f": 8, "degree": "1"}]},
      {id:'box5_C_31',root:'C',difficulty:'Beginner',notes:[{"s": 1, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "2"}, {"s": 0, "f": 8, "degree": "1"}, {"s": 0, "f": 5, "degree": "6"}, {"s": 0, "f": 5, "degree": "6"}]},
      {id:'box5_C_32',root:'C',difficulty:'Intermediate',notes:[{"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 2, "f": 5, "degree": "5"}]},
      {id:'box5_C_33',root:'C',difficulty:'Advanced',notes:[{"s": 4, "f": 5, "degree": "3"}, {"s": 4, "f": 5, "degree": "3"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 2, "f": 7, "degree": "6"}]},
      {id:'box5_C_34',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "5"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 4, "f": 5, "degree": "3"}]},
      {id:'box5_C_35',root:'C',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "2"}, {"s": 1, "f": 5, "degree": "2"}, {"s": 0, "f": 8, "degree": "1"}, {"s": 0, "f": 8, "degree": "1"}, {"s": 0, "f": 5, "degree": "6"}, {"s": 0, "f": 5, "degree": "6"}, {"s": 0, "f": 5, "degree": "6"}]},
      {id:'box5_C_36',root:'C',difficulty:'Advanced',notes:[{"s": 1, "f": 5, "degree": "2"}, {"s": 1, "f": 5, "degree": "2"}, {"s": 0, "f": 8, "degree": "1"}, {"s": 0, "f": 8, "degree": "1"}, {"s": 0, "f": 5, "degree": "6"}, {"s": 0, "f": 5, "degree": "6"}, {"s": 0, "f": 5, "degree": "6"}]},
      {id:'box5_C_37',root:'C',difficulty:'Beginner',notes:[{"s": 4, "f": 5, "degree": "3"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 2, "f": 5, "degree": "5"}]},
      {id:'box5_C_38',root:'C',difficulty:'Intermediate',notes:[{"s": 2, "f": 5, "degree": "5"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 4, "f": 5, "degree": "3"}, {"s": 4, "f": 8, "degree": "5"}]},
      {id:'box5_C_39',root:'C',difficulty:'Advanced',notes:[{"s": 2, "f": 7, "degree": "6"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 4, "f": 5, "degree": "3"}, {"s": 4, "f": 5, "degree": "3"}]},
      {id:'box5_C_40',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "5"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 4, "f": 5, "degree": "3"}, {"s": 4, "f": 8, "degree": "5"}]},
      {id:'box5_C_41',root:'C',difficulty:'Intermediate',notes:[{"s": 2, "f": 5, "degree": "5"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 4, "f": 5, "degree": "3"}, {"s": 4, "f": 8, "degree": "5"}]},
      {id:'box5_C_42',root:'C',difficulty:'Advanced',notes:[{"s": 4, "f": 8, "degree": "5"}, {"s": 4, "f": 8, "degree": "5"}, {"s": 4, "f": 5, "degree": "3"}, {"s": 4, "f": 5, "degree": "3"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 5, "degree": "1"}]},
      {id:'box5_C_43',root:'C',difficulty:'Beginner',notes:[{"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 2, "f": 5, "degree": "5"}]},
      {id:'box5_C_44',root:'C',difficulty:'Intermediate',notes:[{"s": 4, "f": 8, "degree": "5"}, {"s": 4, "f": 5, "degree": "3"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 2, "f": 5, "degree": "5"}]},
      {id:'box5_C_45',root:'C',difficulty:'Advanced',notes:[{"s": 1, "f": 7, "degree": "3"}, {"s": 1, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "2"}, {"s": 1, "f": 5, "degree": "2"}, {"s": 0, "f": 8, "degree": "1"}, {"s": 0, "f": 8, "degree": "1"}, {"s": 0, "f": 5, "degree": "6"}, {"s": 0, "f": 8, "degree": "1"}]},
      {id:'box5_C_46',root:'C',difficulty:'Beginner',notes:[{"s": 1, "f": 7, "degree": "3"}, {"s": 1, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "2"}, {"s": 1, "f": 5, "degree": "2"}, {"s": 0, "f": 8, "degree": "1"}, {"s": 0, "f": 8, "degree": "1"}]},
      {id:'box5_C_47',root:'C',difficulty:'Intermediate',notes:[{"s": 4, "f": 8, "degree": "5"}, {"s": 4, "f": 5, "degree": "3"}, {"s": 3, "f": 7, "degree": "2"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 2, "f": 5, "degree": "5"}]},
      {id:'box5_C_48',root:'C',difficulty:'Advanced',notes:[{"s": 1, "f": 7, "degree": "3"}, {"s": 1, "f": 5, "degree": "2"}, {"s": 0, "f": 8, "degree": "1"}, {"s": 0, "f": 5, "degree": "6"}, {"s": 0, "f": 5, "degree": "6"}, {"s": 0, "f": 5, "degree": "6"}, {"s": 0, "f": 5, "degree": "6"}, {"s": 0, "f": 8, "degree": "1"}]},
      {id:'box5_C_49',root:'C',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "5"}, {"s": 2, "f": 5, "degree": "5"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 2, "f": 7, "degree": "6"}, {"s": 3, "f": 5, "degree": "1"}, {"s": 3, "f": 5, "degree": "1"}]},
    ],
  },
  'Blues': {
    1: [
      {id:'box1_A_0',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box1_A_1',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}]},
      {id:'box1_A_2',root:'A',difficulty:'Advanced',notes:[{"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}]},
      {id:'box1_A_3',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}]},
      {id:'box1_A_4',root:'A',difficulty:'Intermediate',notes:[{"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 6, "degree": "b5"}, {"s": 1, "f": 6, "degree": "b5"}]},
      {id:'box1_A_5',root:'A',difficulty:'Advanced',notes:[{"s": 1, "f": 6, "degree": "b5"}, {"s": 1, "f": 6, "degree": "b5"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}]},
      {id:'box1_A_6',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box1_A_7',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 6, "degree": "b5"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}]},
      {id:'box1_A_8',root:'A',difficulty:'Advanced',notes:[{"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box1_A_9',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 8, "degree": "b7"}]},
      {id:'box1_A_10',root:'A',difficulty:'Intermediate',notes:[{"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box1_A_11',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 5, "degree": "b7"}]},
      {id:'box1_A_12',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 8, "degree": "b7"}]},
      {id:'box1_A_13',root:'A',difficulty:'Intermediate',notes:[{"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box1_A_14',root:'A',difficulty:'Advanced',notes:[{"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box1_A_15',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 8, "degree": "b7"}]},
      {id:'box1_A_16',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box1_A_17',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 5, "degree": "b7"}]},
      {id:'box1_A_18',root:'A',difficulty:'Beginner',notes:[{"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 8, "degree": "b7"}]},
      {id:'box1_A_19',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}]},
      {id:'box1_A_20',root:'A',difficulty:'Advanced',notes:[{"s": 1, "f": 6, "degree": "b5"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}]},
      {id:'box1_A_21',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 5, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 5, "degree": "b7"}]},
      {id:'box1_A_22',root:'A',difficulty:'Intermediate',notes:[{"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}]},
      {id:'box1_A_23',root:'A',difficulty:'Advanced',notes:[{"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}]},
      {id:'box1_A_24',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 8, "degree": "b7"}, {"s": 4, "f": 5, "degree": "5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 5, "degree": "b7"}]},
      {id:'box1_E_25',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 0, "degree": "b7"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 3, "degree": "b7"}]},
      {id:'box1_E_26',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box1_E_27',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 3, "degree": "b7"}]},
      {id:'box1_E_28',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 0, "degree": "1"}]},
      {id:'box1_E_29',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 0, "degree": "b7"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 3, "degree": "b7"}]},
      {id:'box1_E_30',root:'E',difficulty:'Advanced',notes:[{"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 1, "degree": "b5"}, {"s": 1, "f": 1, "degree": "b5"}]},
      {id:'box1_E_31',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 0, "degree": "b7"}]},
      {id:'box1_E_32',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box1_E_33',root:'E',difficulty:'Advanced',notes:[{"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 0, "degree": "5"}]},
      {id:'box1_E_34',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 1, "degree": "b5"}, {"s": 1, "f": 1, "degree": "b5"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 0, "degree": "1"}]},
      {id:'box1_E_35',root:'E',difficulty:'Intermediate',notes:[{"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 0, "degree": "4"}]},
      {id:'box1_E_36',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 0, "degree": "b7"}]},
      {id:'box1_E_37',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 0, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box1_E_38',root:'E',difficulty:'Intermediate',notes:[{"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 0, "degree": "4"}]},
      {id:'box1_E_39',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 0, "degree": "1"}]},
      {id:'box1_E_40',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 0, "degree": "1"}]},
      {id:'box1_E_41',root:'E',difficulty:'Intermediate',notes:[{"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}]},
      {id:'box1_E_42',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 0, "degree": "b7"}, {"s": 2, "f": 0, "degree": "b7"}]},
      {id:'box1_E_43',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box1_E_44',root:'E',difficulty:'Intermediate',notes:[{"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 1, "degree": "b5"}, {"s": 1, "f": 1, "degree": "b5"}]},
      {id:'box1_E_45',root:'E',difficulty:'Advanced',notes:[{"s": 2, "f": 0, "degree": "b7"}, {"s": 2, "f": 0, "degree": "b7"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}]},
      {id:'box1_E_46',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 2, "degree": "1"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 3, "degree": "b7"}]},
      {id:'box1_E_47',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 3, "f": 0, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box1_E_48',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 0, "degree": "4"}, {"s": 1, "f": 0, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 0, "degree": "1"}, {"s": 0, "f": 0, "degree": "1"}]},
      {id:'box1_E_49',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 3, "degree": "b7"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 4, "f": 0, "degree": "5"}, {"s": 3, "f": 2, "degree": "4"}]},
    ],
    2: [
      {id:'box2_A_0',root:'A',difficulty:'Beginner',notes:[{"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 1, "f": 7, "degree": "5"}]},
      {id:'box2_A_1',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}]},
      {id:'box2_A_2',root:'A',difficulty:'Advanced',notes:[{"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 8, "degree": "b5"}]},
      {id:'box2_A_3',root:'A',difficulty:'Beginner',notes:[{"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 1, "f": 7, "degree": "5"}]},
      {id:'box2_A_4',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 8, "degree": "b3"}]},
      {id:'box2_A_5',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box2_A_6',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 0, "f": 10, "degree": "4"}]},
      {id:'box2_A_7',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}]},
      {id:'box2_A_8',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box2_A_9',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}]},
      {id:'box2_A_10',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box2_A_11',root:'A',difficulty:'Advanced',notes:[{"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 8, "degree": "b5"}]},
      {id:'box2_A_12',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 0, "f": 10, "degree": "4"}]},
      {id:'box2_A_13',root:'A',difficulty:'Intermediate',notes:[{"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}]},
      {id:'box2_A_14',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box2_A_15',root:'A',difficulty:'Beginner',notes:[{"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box2_A_16',root:'A',difficulty:'Intermediate',notes:[{"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 8, "degree": "b3"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 10, "degree": "b7"}]},
      {id:'box2_A_17',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box2_A_18',root:'A',difficulty:'Beginner',notes:[{"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 10, "degree": "b7"}]},
      {id:'box2_A_19',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box2_A_20',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box2_A_21',root:'A',difficulty:'Beginner',notes:[{"s": 0, "f": 10, "degree": "4"}, {"s": 0, "f": 10, "degree": "4"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 7, "degree": "5"}, {"s": 1, "f": 10, "degree": "b7"}, {"s": 1, "f": 10, "degree": "b7"}]},
      {id:'box2_A_22',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 8, "degree": "b5"}]},
      {id:'box2_A_23',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 8, "degree": "b5"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 7, "degree": "1"}, {"s": 2, "f": 7, "degree": "1"}]},
      {id:'box2_A_24',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}, {"s": 3, "f": 8, "degree": "b5"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 3, "f": 7, "degree": "4"}]},
      {id:'box2_E_25',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}]},
      {id:'box2_E_26',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}]},
      {id:'box2_E_27',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}]},
      {id:'box2_E_28',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box2_E_29',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}]},
      {id:'box2_E_30',root:'E',difficulty:'Advanced',notes:[{"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}]},
      {id:'box2_E_31',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}]},
      {id:'box2_E_32',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box2_E_33',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}]},
      {id:'box2_E_34',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}]},
      {id:'box2_E_35',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}]},
      {id:'box2_E_36',root:'E',difficulty:'Advanced',notes:[{"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 3, "degree": "b5"}]},
      {id:'box2_E_37',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}]},
      {id:'box2_E_38',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}]},
      {id:'box2_E_39',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}]},
      {id:'box2_E_40',root:'E',difficulty:'Beginner',notes:[{"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 1, "f": 2, "degree": "5"}]},
      {id:'box2_E_41',root:'E',difficulty:'Intermediate',notes:[{"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}]},
      {id:'box2_E_42',root:'E',difficulty:'Advanced',notes:[{"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 2, "degree": "1"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 3, "degree": "b5"}, {"s": 3, "f": 3, "degree": "b5"}]},
      {id:'box2_E_43',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}]},
      {id:'box2_E_44',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 3, "degree": "b5"}, {"s": 3, "f": 3, "degree": "b5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box2_E_45',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}, {"s": 0, "f": 3, "degree": "b3"}]},
      {id:'box2_E_46',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}]},
      {id:'box2_E_47',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 3, "degree": "b5"}, {"s": 3, "f": 3, "degree": "b5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box2_E_48',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 3, "degree": "b5"}, {"s": 3, "f": 3, "degree": "b5"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 3, "f": 2, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 2, "degree": "1"}]},
      {id:'box2_E_49',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 5, "degree": "b7"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 1, "f": 2, "degree": "5"}, {"s": 0, "f": 5, "degree": "4"}, {"s": 0, "f": 5, "degree": "4"}]},
    ],
    3: [
      {id:'box3_A_0',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}]},
      {id:'box3_A_1',root:'A',difficulty:'Intermediate',notes:[{"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}]},
      {id:'box3_A_2',root:'A',difficulty:'Advanced',notes:[{"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box3_A_3',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box3_A_4',root:'A',difficulty:'Intermediate',notes:[{"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}]},
      {id:'box3_A_5',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 13, "degree": "b3"}]},
      {id:'box3_A_6',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 10, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}]},
      {id:'box3_A_7',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box3_A_8',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}]},
      {id:'box3_A_9',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}]},
      {id:'box3_A_10',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box3_A_11',root:'A',difficulty:'Advanced',notes:[{"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}]},
      {id:'box3_A_12',root:'A',difficulty:'Beginner',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}]},
      {id:'box3_A_13',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 13, "degree": "b3"}]},
      {id:'box3_A_14',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box3_A_15',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 13, "degree": "b3"}]},
      {id:'box3_A_16',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box3_A_17',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}]},
      {id:'box3_A_18',root:'A',difficulty:'Beginner',notes:[{"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box3_A_19',root:'A',difficulty:'Intermediate',notes:[{"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}]},
      {id:'box3_A_20',root:'A',difficulty:'Advanced',notes:[{"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 10, "degree": "1"}]},
      {id:'box3_A_21',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}]},
      {id:'box3_A_22',root:'A',difficulty:'Intermediate',notes:[{"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 4, "f": 10, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}]},
      {id:'box3_A_23',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}]},
      {id:'box3_A_24',root:'A',difficulty:'Beginner',notes:[{"s": 3, "f": 9, "degree": "5"}, {"s": 3, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 12, "degree": "4"}, {"s": 2, "f": 10, "degree": "b3"}, {"s": 2, "f": 10, "degree": "b3"}]},
      {id:'box3_E_25',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}]},
      {id:'box3_E_26',root:'E',difficulty:'Intermediate',notes:[{"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}]},
      {id:'box3_E_27',root:'E',difficulty:'Advanced',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}]},
      {id:'box3_E_28',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}]},
      {id:'box3_E_29',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}]},
      {id:'box3_E_30',root:'E',difficulty:'Advanced',notes:[{"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}]},
      {id:'box3_E_31',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}]},
      {id:'box3_E_32',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}]},
      {id:'box3_E_33',root:'E',difficulty:'Advanced',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 7, "degree": "4"}]},
      {id:'box3_E_34',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}]},
      {id:'box3_E_35',root:'E',difficulty:'Intermediate',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}]},
      {id:'box3_E_36',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 8, "degree": "b3"}]},
      {id:'box3_E_37',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 7, "degree": "4"}]},
      {id:'box3_E_38',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}]},
      {id:'box3_E_39',root:'E',difficulty:'Advanced',notes:[{"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}]},
      {id:'box3_E_40',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}]},
      {id:'box3_E_41',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}]},
      {id:'box3_E_42',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}]},
      {id:'box3_E_43',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}]},
      {id:'box3_E_44',root:'E',difficulty:'Intermediate',notes:[{"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}]},
      {id:'box3_E_45',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}]},
      {id:'box3_E_46',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}]},
      {id:'box3_E_47',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 5, "degree": "1"}]},
      {id:'box3_E_48',root:'E',difficulty:'Advanced',notes:[{"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}]},
      {id:'box3_E_49',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 5, "degree": "b3"}, {"s": 2, "f": 7, "degree": "4"}, {"s": 3, "f": 4, "degree": "5"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 4, "f": 5, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}]},
    ],
    4: [
      {id:'box4_A_0',root:'A',difficulty:'Beginner',notes:[{"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}]},
      {id:'box4_A_1',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 3, "f": 14, "degree": "1"}]},
      {id:'box4_A_2',root:'A',difficulty:'Advanced',notes:[{"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 12, "degree": "1"}]},
      {id:'box4_A_3',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}]},
      {id:'box4_A_4',root:'A',difficulty:'Intermediate',notes:[{"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 15, "degree": "b3"}]},
      {id:'box4_A_5',root:'A',difficulty:'Advanced',notes:[{"s": 4, "f": 15, "degree": "4"}, {"s": 4, "f": 15, "degree": "4"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}]},
      {id:'box4_A_6',root:'A',difficulty:'Beginner',notes:[{"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}]},
      {id:'box4_A_7',root:'A',difficulty:'Intermediate',notes:[{"s": 4, "f": 15, "degree": "4"}, {"s": 4, "f": 15, "degree": "4"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}]},
      {id:'box4_A_8',root:'A',difficulty:'Advanced',notes:[{"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 15, "degree": "b3"}]},
      {id:'box4_A_9',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}]},
      {id:'box4_A_10',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 12, "degree": "5"}]},
      {id:'box4_A_11',root:'A',difficulty:'Advanced',notes:[{"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 12, "degree": "5"}]},
      {id:'box4_A_12',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}]},
      {id:'box4_A_13',root:'A',difficulty:'Intermediate',notes:[{"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}]},
      {id:'box4_A_14',root:'A',difficulty:'Advanced',notes:[{"s": 4, "f": 15, "degree": "4"}, {"s": 4, "f": 15, "degree": "4"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}]},
      {id:'box4_A_15',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 12, "degree": "5"}]},
      {id:'box4_A_16',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 3, "f": 14, "degree": "1"}]},
      {id:'box4_A_17',root:'A',difficulty:'Advanced',notes:[{"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 15, "degree": "b3"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}]},
      {id:'box4_A_18',root:'A',difficulty:'Beginner',notes:[{"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 1, "f": 12, "degree": "1"}]},
      {id:'box4_A_19',root:'A',difficulty:'Intermediate',notes:[{"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}]},
      {id:'box4_A_20',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 15, "degree": "4"}, {"s": 4, "f": 15, "degree": "4"}]},
      {id:'box4_A_21',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}]},
      {id:'box4_A_22',root:'A',difficulty:'Intermediate',notes:[{"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}]},
      {id:'box4_A_23',root:'A',difficulty:'Advanced',notes:[{"s": 1, "f": 12, "degree": "1"}, {"s": 1, "f": 12, "degree": "1"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 15, "degree": "b7"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}, {"s": 0, "f": 12, "degree": "5"}]},
      {id:'box4_A_24',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 13, "degree": "b3"}, {"s": 4, "f": 13, "degree": "b3"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 14, "degree": "1"}, {"s": 3, "f": 12, "degree": "b7"}, {"s": 3, "f": 12, "degree": "b7"}]},
      {id:'box4_E_25',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box4_E_26',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}]},
      {id:'box4_E_27',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_28',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_29',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_30',root:'E',difficulty:'Advanced',notes:[{"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 10, "degree": "b3"}]},
      {id:'box4_E_31',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_32',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_33',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_34',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 7, "degree": "b7"}]},
      {id:'box4_E_35',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_36',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_37',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box4_E_38',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_39',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_40',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_41',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_42',root:'E',difficulty:'Advanced',notes:[{"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box4_E_43',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 7, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box4_E_44',root:'E',difficulty:'Intermediate',notes:[{"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}]},
      {id:'box4_E_45',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_46',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 8, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}]},
      {id:'box4_E_47',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_48',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 7, "degree": "5"}]},
      {id:'box4_E_49',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 1, "f": 7, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}]},
    ],
    5: [
      {id:'box5_A_0',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 4, "degree": "b5"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 2, "degree": "5"}]},
      {id:'box5_A_1',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 4, "degree": "b5"}]},
      {id:'box5_A_2',root:'A',difficulty:'Advanced',notes:[{"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 2, "f": 5, "degree": "b7"}]},
      {id:'box5_A_3',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 4, "degree": "b5"}]},
      {id:'box5_A_4',root:'A',difficulty:'Intermediate',notes:[{"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 4, "degree": "b5"}]},
      {id:'box5_A_5',root:'A',difficulty:'Advanced',notes:[{"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 3, "f": 2, "degree": "1"}]},
      {id:'box5_A_6',root:'A',difficulty:'Beginner',notes:[{"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}]},
      {id:'box5_A_7',root:'A',difficulty:'Intermediate',notes:[{"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}]},
      {id:'box5_A_8',root:'A',difficulty:'Advanced',notes:[{"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}]},
      {id:'box5_A_9',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}]},
      {id:'box5_A_10',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}]},
      {id:'box5_A_11',root:'A',difficulty:'Advanced',notes:[{"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}]},
      {id:'box5_A_12',root:'A',difficulty:'Beginner',notes:[{"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 3, "degree": "b7"}, {"s": 0, "f": 3, "degree": "b7"}, {"s": 0, "f": 3, "degree": "b7"}]},
      {id:'box5_A_13',root:'A',difficulty:'Intermediate',notes:[{"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 3, "degree": "b7"}, {"s": 0, "f": 3, "degree": "b7"}, {"s": 0, "f": 3, "degree": "b7"}, {"s": 0, "f": 3, "degree": "b7"}]},
      {id:'box5_A_14',root:'A',difficulty:'Advanced',notes:[{"s": 0, "f": 3, "degree": "b7"}, {"s": 0, "f": 3, "degree": "b7"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 1, "f": 5, "degree": "4"}]},
      {id:'box5_A_15',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 4, "degree": "b5"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 2, "degree": "5"}]},
      {id:'box5_A_16',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 3, "degree": "4"}]},
      {id:'box5_A_17',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 4, "degree": "b5"}, {"s": 4, "f": 4, "degree": "b5"}]},
      {id:'box5_A_18',root:'A',difficulty:'Beginner',notes:[{"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 1, "f": 5, "degree": "4"}, {"s": 1, "f": 5, "degree": "4"}]},
      {id:'box5_A_19',root:'A',difficulty:'Intermediate',notes:[{"s": 4, "f": 4, "degree": "b5"}, {"s": 4, "f": 4, "degree": "b5"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}]},
      {id:'box5_A_20',root:'A',difficulty:'Advanced',notes:[{"s": 0, "f": 3, "degree": "b7"}, {"s": 0, "f": 3, "degree": "b7"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 0, "f": 5, "degree": "1"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 1, "f": 3, "degree": "b3"}, {"s": 1, "f": 5, "degree": "4"}]},
      {id:'box5_A_21',root:'A',difficulty:'Beginner',notes:[{"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}]},
      {id:'box5_A_22',root:'A',difficulty:'Intermediate',notes:[{"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 4, "f": 4, "degree": "b5"}]},
      {id:'box5_A_23',root:'A',difficulty:'Advanced',notes:[{"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 5, "degree": "b7"}, {"s": 2, "f": 2, "degree": "5"}, {"s": 2, "f": 2, "degree": "5"}]},
      {id:'box5_A_24',root:'A',difficulty:'Beginner',notes:[{"s": 4, "f": 4, "degree": "b5"}, {"s": 4, "f": 3, "degree": "4"}, {"s": 3, "f": 5, "degree": "b3"}, {"s": 3, "f": 2, "degree": "1"}, {"s": 3, "f": 2, "degree": "1"}]},
      {id:'box5_E_25',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 12, "degree": "4"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 12, "degree": "1"}]},
      {id:'box5_E_26',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 12, "degree": "4"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}]},
      {id:'box5_E_27',root:'E',difficulty:'Advanced',notes:[{"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}]},
      {id:'box5_E_28',root:'E',difficulty:'Beginner',notes:[{"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 11, "degree": "b5"}]},
      {id:'box5_E_29',root:'E',difficulty:'Intermediate',notes:[{"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}]},
      {id:'box5_E_30',root:'E',difficulty:'Advanced',notes:[{"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 12, "degree": "4"}, {"s": 1, "f": 12, "degree": "4"}]},
      {id:'box5_E_31',root:'E',difficulty:'Beginner',notes:[{"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 12, "degree": "1"}]},
      {id:'box5_E_32',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 12, "degree": "4"}, {"s": 1, "f": 12, "degree": "4"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 12, "degree": "1"}]},
      {id:'box5_E_33',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 11, "degree": "b5"}, {"s": 4, "f": 11, "degree": "b5"}]},
      {id:'box5_E_34',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 10, "degree": "4"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 9, "degree": "5"}]},
      {id:'box5_E_35',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 12, "degree": "4"}, {"s": 1, "f": 12, "degree": "4"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 12, "degree": "1"}]},
      {id:'box5_E_36',root:'E',difficulty:'Advanced',notes:[{"s": 1, "f": 12, "degree": "4"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}]},
      {id:'box5_E_37',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 9, "degree": "5"}]},
      {id:'box5_E_38',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}]},
      {id:'box5_E_39',root:'E',difficulty:'Advanced',notes:[{"s": 4, "f": 11, "degree": "b5"}, {"s": 4, "f": 11, "degree": "b5"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box5_E_40',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 11, "degree": "b5"}, {"s": 4, "f": 11, "degree": "b5"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}]},
      {id:'box5_E_41',root:'E',difficulty:'Intermediate',notes:[{"s": 1, "f": 12, "degree": "4"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 12, "degree": "1"}]},
      {id:'box5_E_42',root:'E',difficulty:'Advanced',notes:[{"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 10, "degree": "b7"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 0, "f": 12, "degree": "1"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 10, "degree": "b3"}, {"s": 1, "f": 12, "degree": "4"}]},
      {id:'box5_E_43',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 11, "degree": "b5"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 2, "f": 12, "degree": "b7"}]},
      {id:'box5_E_44',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box5_E_45',root:'E',difficulty:'Advanced',notes:[{"s": 4, "f": 10, "degree": "4"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 12, "degree": "b7"}]},
      {id:'box5_E_46',root:'E',difficulty:'Beginner',notes:[{"s": 4, "f": 11, "degree": "b5"}, {"s": 4, "f": 10, "degree": "4"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box5_E_47',root:'E',difficulty:'Intermediate',notes:[{"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 9, "degree": "5"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}]},
      {id:'box5_E_48',root:'E',difficulty:'Advanced',notes:[{"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 12, "degree": "b3"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 9, "degree": "5"}]},
      {id:'box5_E_49',root:'E',difficulty:'Beginner',notes:[{"s": 3, "f": 9, "degree": "1"}, {"s": 3, "f": 9, "degree": "1"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 12, "degree": "b7"}, {"s": 2, "f": 9, "degree": "5"}]},
    ],
  },
};
const DIFF_COLORS = {
  Beginner:     {bg:'#e8f5e2',color:'#2a6b17',border:'#b5d9a5'},
  Intermediate: {bg:'#fff8e1',color:'#7a5000',border:'#f0c040'},
  Advanced:     {bg:'#fde8e8',color:'#8b1a1a',border:'#f0b8b8'},
};

// The reference "measure length" every box-mode diagram is padded out to,
// computed directly from the actual data (currently 8) rather than
// hardcoded, so this stays correct automatically if the lick generator is
// ever rerun and produces a different max. A lick shorter than this just
// gets extra plain dashes appended after its last note — same technique
// as an unused string, not a visual trick — which is what guarantees the
// closing pipe lands in the same column on every single card.
const MAX_BOX_LICK_NOTES = Object.values(BOX_LICK_DATA)
  .flatMap(group => Object.values(group))
  .flat()
  .reduce((max, lick) => Math.max(max, lick.notes.length), 0);

// Every non-box TabCard (free licks, double stops, chords) uses this
// same fixed width with its content centered inside it, so those
// diagrams don't jump around in size depending on which item is showing.
//
// Box-mode cards are handled differently (see `fitContent` below): since
// every box-mode row is now padded to an identical fixed length
// (MAX_BOX_LICK_NOTES), there's no longer any need to guess a pixel
// width for them — the box can size exactly to its own content with
// zero slack, which is what guarantees no leftover gap on either side.
const TAB_CARD_WIDTH = 460; // border-box width including the pre's own padding — comfortably fits the widest real content (~340px) with margin to spare

// Bumped by hand on every Practice.jsx change so a screenshot can be
// checked against this string to confirm which build is actually
// deployed — added specifically because a recent round of changes
// produced zero visible difference despite a confirmed correct deploy
// and app refresh, which needs to be distinguishable from "the fix
// didn't work" going forward.
const PRACTICE_BUILD_TAG = 'build 2026-08-22 17:17 PDT — fixed padding double-count in margin calc';

function TabCard({ title, subtitle, tab, difficulty, align = 'center', fitContent = false, boxRef = null, wrapperRef = null, debugInfo = null, computedWidth = null, computedMarginLeft = null }) {
  const diff = difficulty ? DIFF_COLORS[difficulty] : null;
  return (
    <div style={{border:'1px solid #ddd',borderRadius:'10px',overflow:'hidden',backgroundColor:'#fafafa'}}>
      <div style={{padding:'10px 16px',backgroundColor:'#f0f0f0',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'6px'}}>
        <div>
          <span style={{fontWeight:'600',fontSize:'14px'}}>{title}</span>
          {subtitle && <span style={{marginLeft:'10px',fontSize:'12px',color:'#666'}}>{subtitle}</span>}
        </div>
        {diff && (
          <span style={{padding:'3px 10px',borderRadius:'20px',fontSize:'12px',fontWeight:'600',backgroundColor:diff.bg,color:diff.color,border:`1px solid ${diff.border}`}}>
            {difficulty}
          </span>
        )}
      </div>
      <div ref={wrapperRef} style={{
        padding:'12px 16px', display:'flex',
        // Centering is now handled by an explicit computed marginLeft on
        // the pre itself (see computedMarginLeft), not by justify-content
        // — CSS auto-centering (justify-content:center, then margin:auto)
        // both visibly failed to center correctly on this device, so
        // this wrapper just needs flex-start plus scroll capability for
        // whenever content is too wide to fully display.
        justifyContent: fitContent ? 'flex-start' : 'center',
        overflowX: fitContent ? 'auto' : 'visible',
      }}>
        {/* fitContent (box mode only): `display:inline-block` with no
            width was measured to undersize the box relative to its real
            content (14px left gap vs. a measured 1px right gap — proof
            the browser's own shrink-to-fit math was wrong here, not a
            theory). Once `computedWidth` is available (measured directly
            from each row's actual rendered content, see rowRefsContainer
            in Practice()), that explicit pixel value is used instead —
            a declared width the browser doesn't have to calculate itself,
            so there's nothing left for it to get wrong. inline-block/auto
            is only a placeholder for the very first paint, before the
            first measurement has run. Non-box modes keep the original
            fixed 460px width with centered content. */}
        <pre ref={boxRef} style={{
          fontFamily:'"Courier New",monospace', fontSize:'13px', lineHeight:'1.9',
          backgroundColor:'#000', color:'#e0e0e0', padding:'10px 14px', borderRadius:'8px',
          // Explicit computed marginLeft (see computedMarginLeft in
          // Practice()) instead of CSS margin:'0 auto' — auto-centering
          // was tried twice (justify-content:center, then margin:auto)
          // and neither visibly centered the box on this device. Falls
          // back to margin:'0 auto' only before the first measurement.
          marginLeft: fitContent ? (computedMarginLeft !== null ? `${computedMarginLeft}px` : 'auto') : 0,
          marginRight: fitContent ? 0 : 0,
          marginTop: 0, marginBottom: 0,
          whiteSpace:'pre', textAlign: align,
          display: fitContent && !computedWidth ? 'inline-block' : 'block',
          width: fitContent ? (computedWidth ? `${computedWidth}px` : 'auto') : `${TAB_CARD_WIDTH}px`,
          // maxWidth:'100%' would cap this box back down to whatever the
          // card's available space happens to be — CSS resolves an
          // explicit width against max-width:100% by taking whichever is
          // SMALLER, which is exactly what was silently overriding the
          // computed width back to 334px every time. Once a real
          // computedWidth is set, the box is allowed to be exactly that
          // size, growing past the card's own width if it has to —
          // matching "grow the box, don't shrink the content" from
          // earlier. Falls back to maxWidth:100% only before the first
          // measurement (computedWidth still null), so nothing overflows
          // wildly during that brief initial paint.
          maxWidth: fitContent && computedWidth ? 'none' : '100%',
          boxSizing: 'border-box',
          overflowX: 'auto',
          // The immediate parent is `display:flex`, which makes this pre
          // a flex item — flex items default to flex-shrink:1, meaning
          // the flex algorithm can shrink an item back down below its
          // own explicit width if the container is tight on space. That
          // shrinking happens independently of max-width, so fixing the
          // max-width cap alone isn't necessarily enough on its own.
          flexShrink: fitContent && computedWidth ? 0 : undefined,
        }}>
          {tab}
        </pre>
      </div>
      {fitContent && (
        <p style={{ textAlign: 'center', fontSize: '9px', color: '#bbb', margin: '2px 0 8px' }}>
          {PRACTICE_BUILD_TAG}
          {debugInfo && (
            <>
              <br />
              <span style={{ color: '#e8b84b' }}>
                DEBUG — box width: {debugInfo.boxWidth}px · left gap: {debugInfo.leftGap}px · right gap: {debugInfo.rightGap}px · computed: {computedWidth ?? '—'}px · margin: {computedMarginLeft ?? '—'}px
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
}

// Scale groups available per mode
const LICK_GROUPS = ['Minor Pentatonic', 'Major Pentatonic', 'Blues', 'Natural Minor', 'Major'];
const DS_GROUPS   = ['Minor Pentatonic', 'Major Pentatonic', 'Blues', 'Natural Minor', 'Major'];
// Only these use the classic 5-box pentatonic position system
const BOX_GROUPS = ['Minor Pentatonic', 'Major Pentatonic', 'Blues'];

// Which scale groups make sense for major vs minor keys
const MAJOR_KEY_GROUPS = ['Major Pentatonic', 'Major', 'Blues'];
const MINOR_KEY_GROUPS = ['Minor Pentatonic', 'Natural Minor', 'Blues'];

// Mirrors the actual badge styling used in renderSingleNoteWithRoot, so
// the legend always visually matches what's really in the tab.
function BoxLegend() {
  const dotBase = { display: 'inline-block', width: '1.1em', height: '1.1em', borderRadius: '50%', fontSize: '10px', fontWeight: '800', lineHeight: '1.1em', textAlign: 'center', boxSizing: 'border-box' };
  return (
    <p style={{ textAlign: 'center', fontSize: '12px', color: '#888', marginBottom: '8px' }}>
      <span style={{ ...dotBase, backgroundColor: '#ff4444', color: '#111' }}>R</span>{' Root · '}
      <span style={{ ...dotBase, border: '1.5px solid #ff9d2e', color: '#ff9d2e' }}>3</span>{' 3rd · '}
      <span style={{ ...dotBase, border: '1.5px solid #ffe14d', color: '#ffe14d' }}>5</span>{' 5th'}
      <span style={{ color: '#fff' }}>{' — the rest are passing tones'}</span>
    </p>
  );
}

export default function Practice() {
  const [mode, setMode] = useState('licks');
  const [selectedKey, setSelectedKey] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('Minor Pentatonic');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedBox, setSelectedBox] = useState(''); // '' = free-roam, '1'-'5' = box position
  const [current, setCurrent] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Measures each row's own inline content width directly (bypassing the
  // browser's shrink-to-fit calculation for the box entirely), and uses
  // the actual widest row to compute an EXPLICIT pixel width for the box.
  // The earlier attempt trusted `display:inline-block` to size the box
  // correctly on its own — the measured 14px-vs-1px gap asymmetry proved
  // that trust was misplaced (the box came out ~13px narrower than the
  // real content, so content overflowed past the right padding). Setting
  // an explicit width computed from real measurements removes the
  // browser's auto-sizing from the equation altogether.
  const debugBoxRef = useRef(null);
  const debugLabelRef = useRef(null);
  const debugPipeRef = useRef(null);
  const debugWrapperRef = useRef(null);
  const rowRefsContainer = useRef([]);
  const [debugGaps, setDebugGaps] = useState(null);
  const [computedBoxWidth, setComputedBoxWidth] = useState(null);
  const [computedMarginLeft, setComputedMarginLeft] = useState(null);

  useEffect(() => {
    const measure = () => {
      const rowEls = rowRefsContainer.current.filter(Boolean);
      if (rowEls.length > 0) {
        const widths = rowEls.map(el => el.getBoundingClientRect().width);
        const maxContentWidth = Math.max(...widths);
        // 28 = 14px left padding + 14px right padding on the pre. A
        // small 1px safety margin is kept (not 0) because this width is
        // measured from the FIRST card only but then shared across every
        // card in the list — other cards' content can be a hair wider
        // (e.g. more 2-digit frets), and 1px is enough slack for normal
        // rounding without leaving a visibly loose gap like 4px did.
        const newWidth = Math.ceil(maxContentWidth) + 28 + 1;
        setComputedBoxWidth(prev => (prev === newWidth ? prev : newWidth));

        // CSS margin:'0 auto' should center a flex item with this much
        // free space — it visibly didn't on this device (twice now,
        // first with justify-content:center, then with margin:auto).
        // Rather than trust another CSS mechanism to get this right,
        // measure the wrapper's real available width directly and
        // compute the centering offset by hand, the same way the width
        // itself was fixed.
        if (debugWrapperRef.current) {
          const wrapperEl = debugWrapperRef.current;
          // getBoundingClientRect().width on the wrapper includes the
          // wrapper's OWN padding (12px 16px) — but the pre is centered
          // within the wrapper's CONTENT box, inside that padding, not
          // against its outer edge. Using the padding-inclusive width
          // overestimated available space by the padding amount, which
          // is exactly what pushed the box too far right on every
          // screen size (worse in absolute pixels on wider screens,
          // which is why it looked fine-ish on the phone but clearly
          // wrong on desktop). Reading the actual computed padding
          // (rather than hardcoding it) keeps this correct even if the
          // wrapper's padding is ever changed later.
          const cs = window.getComputedStyle(wrapperEl);
          const padLeft = parseFloat(cs.paddingLeft) || 0;
          const padRight = parseFloat(cs.paddingRight) || 0;
          const contentWidth = wrapperEl.clientWidth - padLeft - padRight;
          const newMargin = Math.max(0, Math.floor((contentWidth - newWidth) / 2));
          setComputedMarginLeft(prev => (prev === newMargin ? prev : newMargin));
        }
      }
      if (!debugBoxRef.current || !debugLabelRef.current || !debugPipeRef.current) {
        setDebugGaps(null);
        return;
      }
      const box = debugBoxRef.current.getBoundingClientRect();
      const label = debugLabelRef.current.getBoundingClientRect();
      const pipe = debugPipeRef.current.getBoundingClientRect();
      const next = {
        boxWidth: Math.round(box.width),
        leftGap: Math.round(label.left - box.left),
        rightGap: Math.round(box.right - pipe.right),
      };
      // Without this equality check, setDebugGaps fires with a brand-new
      // object every single effect pass (even when the numbers haven't
      // changed), and since this effect has no dependency array, that
      // triggers an endless render → measure → setState → render loop
      // that never settles — which is exactly what produced an earlier
      // screenshot showing a stale box width alongside a newer computed
      // width in the same render. Only update state when a value has
      // actually changed.
      setDebugGaps(prev => (
        prev && prev.boxWidth === next.boxWidth && prev.leftGap === next.leftGap && prev.rightGap === next.rightGap
          ? prev
          : next
      ));
    };
    // Measure after paint, and re-measure on resize/orientation change
    // since the gap could legitimately differ across screen widths.
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
  });

  const root = selectedKey ? selectedKey.split(' ').slice(0,-1).join(' ') : null;
  const keyMode = selectedKey ? selectedKey.split(' ').slice(-1)[0] : null; // 'Major' or 'Minor'

  // When key is selected, limit available scale groups to musically appropriate ones
  const availableGroups = !selectedKey
    ? (mode === 'licks' ? LICK_GROUPS : DS_GROUPS)
    : keyMode === 'Major' ? MAJOR_KEY_GROUPS : MINOR_KEY_GROUPS;

  // Auto-correct selectedGroup if it's not in the available list
  const effectiveGroup = availableGroups.includes(selectedGroup) ? selectedGroup : availableGroups[0];

  const handleKeyChange = (key) => {
    setSelectedKey(key);
    setCurrent(null);
    setShowAll(false);
    // If current group isn't valid for new key, reset to first valid one
    if (key) {
      const km = key.split(' ').slice(-1)[0];
      const validGroups = km === 'Major' ? MAJOR_KEY_GROUPS : MINOR_KEY_GROUPS;
      if (!validGroups.includes(selectedGroup)) {
        setSelectedGroup(validGroups[0]);
      }
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setCurrent(null);
    setShowAll(false);
    setSelectedKey('');
    setSelectedGroup('Minor Pentatonic');
    setSelectedBox('');
  };

  const isBoxMode = mode === 'licks' && BOX_GROUPS.includes(effectiveGroup) && selectedBox;

  const getItems = () => {
    if (mode === 'licks') {
      if (isBoxMode) {
        return (BOX_LICK_DATA[effectiveGroup]?.[selectedBox] || []).filter(l => !selectedDifficulty || l.difficulty === selectedDifficulty);
      }
      return (LICK_DATA[effectiveGroup] || []).filter(l => !selectedDifficulty || l.difficulty === selectedDifficulty);
    }
    if (mode === 'doublestops')
      return (DS_DATA[effectiveGroup] || []).filter(l => !selectedDifficulty || l.difficulty === selectedDifficulty);
    if (mode === 'chords')
      return selectedKey ? (CHORD_DATA[selectedKey] || []) : Object.values(CHORD_DATA).flat();
    return [];
  };

  const items = getItems();

  const renderItem = (item, idx) => {
    if (mode === 'licks') {
      if (isBoxMode) {
        const notes = root ? transposeBoxLick(item.notes, item.root, root) : item.notes;
        const isFirst = idx === 0;
        return <TabCard
          key={item.id||idx}
          title={`${effectiveGroup} — Box ${selectedBox}`}
          subtitle={selectedKey?`in ${selectedKey}`:`ref. root ${item.root}`}
          tab={renderSingleNoteWithRoot(notes, MAX_BOX_LICK_NOTES, isFirst ? debugLabelRef : null, isFirst ? debugPipeRef : null, isFirst ? rowRefsContainer : null)}
          difficulty={item.difficulty}
          align="left"
          fitContent
          boxRef={isFirst ? debugBoxRef : null}
          wrapperRef={isFirst ? debugWrapperRef : null}
          debugInfo={isFirst ? debugGaps : null}
          computedWidth={computedBoxWidth}
          computedMarginLeft={computedMarginLeft}
        />;
      }
      const notes = root ? transposeLick(item.notes, effectiveGroup, root) : item.notes;
      return <TabCard key={item.id||idx} title={item.scale} subtitle={selectedKey?`in ${selectedKey}`:'select a key for tab'} tab={renderSingleNote(notes)} difficulty={item.difficulty} />;
    }
    if (mode === 'doublestops') {
      const pairs = root ? transposeDS(item.pairs, effectiveGroup, root) : item.pairs;
      return <TabCard key={item.id||idx} title={item.scale} subtitle={selectedKey?`in ${selectedKey}`:'select a key for tab'} tab={renderDoubleStop(pairs)} difficulty={item.difficulty} />;
    }
    if (mode === 'chords') {
      const chords = item.chords.map(c => {
        const out = {};
        Object.entries(c).forEach(([k,v]) => { out[parseInt(k)] = v === 'x' ? 'x' : parseInt(v); });
        return out;
      });
      return <TabCard key={item.name+item.key+idx} title={item.name} subtitle={`Key of ${item.key}`} tab={renderChords(chords)} />;
    }
  };

  const randomItem = () => {
    if (!items.length) return;
    setCurrent(items[Math.floor(Math.random() * items.length)]);
    setShowAll(false);
  };

  const labelStyle = {fontSize:'11px',fontWeight:'600',color:'#888',textTransform:'uppercase',marginBottom:'4px',display:'block'};
  const selectStyle = {padding:'8px 12px',fontSize:'14px',borderRadius:'8px',border:'1px solid #ccc',backgroundColor:'white',color:'#222',width:'100%'};

  return (
    <div style={{marginTop:'20px'}}>
      <h2 style={{textAlign:'center',marginBottom:'20px'}}>Practice</h2>

      <div style={{display:'flex',flexWrap:'wrap',gap:'16px',justifyContent:'center',marginBottom:'20px'}}>

        <div style={{minWidth:'160px'}}>
          <label style={labelStyle}>Type</label>
          <select value={mode} onChange={e=>handleModeChange(e.target.value)}
            style={{...selectStyle,border:'2px solid #1a73e8',color:'#1a73e8',fontWeight:'600'}}>
            <option value="licks">Single-note Licks</option>
            <option value="doublestops">Double Stops</option>
            <option value="chords">Chord Riffs</option>
          </select>
        </div>

        <div style={{minWidth:'160px'}}>
          <label style={labelStyle}>Key</label>
          <select value={selectedKey} onChange={e=>handleKeyChange(e.target.value)} style={selectStyle}>
            <option value="">{mode==='chords'?'All keys':'Any key'}</option>
            {mode==='chords'
              ? ALL_KEYS.map(k=><option key={k} value={k}>{k}</option>)
              : <>
                  <optgroup label="Major Keys">{ALL_KEYS.filter(k=>k.includes('Major')).map(k=><option key={k} value={k}>{k}</option>)}</optgroup>
                  <optgroup label="Minor Keys">{ALL_KEYS.filter(k=>k.includes('Minor')).map(k=><option key={k} value={k}>{k}</option>)}</optgroup>
                </>
            }
          </select>
        </div>

        {mode !== 'chords' && (
          <div style={{minWidth:'160px'}}>
            <label style={labelStyle}>Scale</label>
            <select value={effectiveGroup} onChange={e=>{setSelectedGroup(e.target.value);setSelectedBox('');setCurrent(null);setShowAll(false);}} style={selectStyle}>
              {availableGroups.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        )}

        {mode === 'licks' && BOX_GROUPS.includes(effectiveGroup) && (
          <div style={{minWidth:'140px'}}>
            <label style={labelStyle}>Box Position</label>
            <select value={selectedBox} onChange={e=>{setSelectedBox(e.target.value);setCurrent(null);setShowAll(false);}} style={selectStyle}>
              <option value="">Free (any position)</option>
              <option value="1">Box 1</option>
              <option value="2">Box 2</option>
              <option value="3">Box 3</option>
              <option value="4">Box 4</option>
              <option value="5">Box 5</option>
            </select>
          </div>
        )}

        {mode !== 'chords' && (
          <div style={{minWidth:'140px'}}>
            <label style={labelStyle}>Difficulty</label>
            <select value={selectedDifficulty} onChange={e=>setSelectedDifficulty(e.target.value)} style={selectStyle}>
              <option value="">Any</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
        )}
      </div>

      <div style={{display:'flex',justifyContent:'center',gap:'10px',marginBottom:'24px'}}>
        <button onClick={randomItem}
          style={{padding:'10px 24px',backgroundColor:'#cc0000',color:'white',border:'none',borderRadius:'8px',fontSize:'16px',cursor:'pointer',fontWeight:'600'}}>
          🎲 Random
        </button>
        <button onClick={()=>{setShowAll(v=>!v);setCurrent(null);}}
          style={{padding:'10px 24px',backgroundColor:'#1a73e8',color:'white',border:'none',borderRadius:'8px',fontSize:'16px',cursor:'pointer'}}>
          {showAll?'Hide all':`Browse all (${items.length})`}
        </button>
      </div>

      {current && !showAll && (
        <>
          {isBoxMode && (
            <BoxLegend />
          )}
          {renderItem(current, 0)}
          {selectedKey && <FretboardDiagram selectedKey={selectedKey} />}
        </>
      )}
      {showAll && (
        <>
          {isBoxMode && (
            <BoxLegend />
          )}
          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>{items.map((item,i)=>renderItem(item,i))}</div>
          {selectedKey && <FretboardDiagram selectedKey={selectedKey} />}
        </>
      )}
      {items.length===0 && <p style={{textAlign:'center',color:'#888'}}>No items found for this selection.</p>}
    </div>
  );
}
