import { useState } from 'react';

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
  const sem = (CHROMATIC.indexOf(targetRoot) - CHROMATIC.indexOf(ref) + 12) % 12;
  if (!sem) return notes;
  return notes.map(n => ({ ...n, f: transposeNote(n.s, n.f, sem) }));
}

function transposeDS(pairs, group, targetRoot) {
  const ref = REF_ROOTS[group];
  if (!ref || !targetRoot) return pairs;
  const sem = (CHROMATIC.indexOf(targetRoot) - CHROMATIC.indexOf(ref) + 12) % 12;
  if (!sem) return pairs;
  return pairs.map(pair => pair.map(n => ({ ...n, f: transposeNote(n.s, n.f, sem) })));
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

const DIFF_COLORS = {
  Beginner:     {bg:'#e8f5e2',color:'#2a6b17',border:'#b5d9a5'},
  Intermediate: {bg:'#fff8e1',color:'#7a5000',border:'#f0c040'},
  Advanced:     {bg:'#fde8e8',color:'#8b1a1a',border:'#f0b8b8'},
};

function TabCard({ title, subtitle, tab, difficulty }) {
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
      <div style={{padding:'12px 16px'}}>
        <pre style={{fontFamily:'"Courier New",monospace',fontSize:'13px',lineHeight:'1.9',backgroundColor:'#111',color:'#e0e0e0',padding:'10px 14px',borderRadius:'8px',margin:0,overflowX:'auto',whiteSpace:'pre'}}>
          {tab}
        </pre>
      </div>
    </div>
  );
}

// Scale groups available per mode
const LICK_GROUPS = ['Minor Pentatonic', 'Major Pentatonic', 'Blues', 'Natural Minor', 'Major'];
const DS_GROUPS   = ['Minor Pentatonic', 'Major Pentatonic', 'Blues', 'Natural Minor', 'Major'];

// Which scale groups make sense for major vs minor keys
const MAJOR_KEY_GROUPS = ['Major Pentatonic', 'Major', 'Blues'];
const MINOR_KEY_GROUPS = ['Minor Pentatonic', 'Natural Minor', 'Blues'];

export default function Practice() {
  const [mode, setMode] = useState('licks');
  const [selectedKey, setSelectedKey] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('Minor Pentatonic');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [current, setCurrent] = useState(null);
  const [showAll, setShowAll] = useState(false);

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
  };

  const getItems = () => {
    if (mode === 'licks')
      return (LICK_DATA[effectiveGroup] || []).filter(l => !selectedDifficulty || l.difficulty === selectedDifficulty);
    if (mode === 'doublestops')
      return (DS_DATA[effectiveGroup] || []).filter(l => !selectedDifficulty || l.difficulty === selectedDifficulty);
    if (mode === 'chords')
      return selectedKey ? (CHORD_DATA[selectedKey] || []) : Object.values(CHORD_DATA).flat();
    return [];
  };

  const items = getItems();

  const renderItem = (item, idx) => {
    if (mode === 'licks') {
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
            <select value={effectiveGroup} onChange={e=>{setSelectedGroup(e.target.value);setCurrent(null);setShowAll(false);}} style={selectStyle}>
              {availableGroups.map(g=><option key={g} value={g}>{g}</option>)}
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

      {current && !showAll && renderItem(current, 0)}
      {showAll && <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>{items.map((item,i)=>renderItem(item,i))}</div>}
      {items.length===0 && <p style={{textAlign:'center',color:'#888'}}>No items found for this selection.</p>}
    </div>
  );
}
