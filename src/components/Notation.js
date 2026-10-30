// Sharps or flats. The app stores and computes every note and key with sharps
// ("A# Major", "C#"); this module only changes how they're SHOWN. The choice
// is a Setting (Settings → Note names) and is applied by setAccidentals().
//
// In "flats" mode a key's scale is spelled the way a musician would write it
// (D major keeps F# and C#; Bb major shows Bb and Eb; C# minor stays C# minor)
// — see keySpelling(). Anywhere there's no key to go by, a plain sharp-to-flat
// swap is used (A# → Bb).

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_OF = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const INTERVALS = { Major: [0, 2, 4, 5, 7, 9, 11], Minor: [0, 2, 3, 5, 7, 8, 10] };

let mode = 'sharps';
const listeners = new Set();

export const getAccidentals = () => mode;
export const subscribeAccidentals = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// Returns true if the mode actually changed.
export function applyAccidentals(next) {
  if ((next !== 'sharps' && next !== 'flats') || next === mode) return false;
  mode = next;
  cache.clear();
  listeners.forEach(fn => { try { fn(mode); } catch { /* ignore */ } });
  return true;
}

// "A#" → "Bb", "C#m" → "Dbm", "F# Minor" → "Gb Minor" (flats mode only; otherwise unchanged).
export function noteLabel(text) {
  if (mode !== 'flats' || typeof text !== 'string') return text;
  return text.replace(/^([A-G])#/, (m) => FLAT_OF[m] || m);
}

// Any text that may mention several notes ("F#, C# and A#").
export function textLabel(text) {
  if (mode !== 'flats' || typeof text !== 'string') return text;
  return text.replace(/\b([A-G]#)/g, (m) => FLAT_OF[m] || m);
}

const cache = new Map();

function trySpell(rootName, intervals, rootPc) {
  const rootLetter = LETTERS.indexOf(rootName[0]);
  const names = [];
  let accidentals = 0;
  for (let i = 0; i < 7; i++) {
    const pc = (rootPc + intervals[i]) % 12;
    const li = (rootLetter + i) % 7;
    const diff = ((pc - LETTER_PC[li] + 18) % 12) - 6;
    if (Math.abs(diff) > 1) return null;      // would need a double sharp/flat
    if (diff) accidentals++;
    names.push(LETTERS[li] + (diff === 1 ? '#' : diff === -1 ? 'b' : ''));
  }
  return { names, accidentals };
}

// { 'A#': 'Bb', ... } for the notes of a key as they should be written (flats
// mode; empty in sharps mode). Picks whichever of the sharp or flat spelling of
// the key needs fewer accidentals (flats win a tie).
export function keySpelling(key) {
  if (mode !== 'flats' || typeof key !== 'string') return {};
  const hit = cache.get(key);
  if (hit) return hit;
  const parts = key.split(' ');
  const quality = parts[parts.length - 1];
  const root = parts.slice(0, -1).join(' ');
  const rootPc = SHARPS.indexOf(root);
  const intervals = INTERVALS[quality];
  const map = {};
  if (rootPc !== -1 && intervals) {
    const flat = FLAT_OF[root] ? trySpell(FLAT_OF[root], intervals, rootPc) : null;
    const sharp = trySpell(root, intervals, rootPc);
    let best = null;
    if (flat && (!sharp || flat.accidentals <= sharp.accidentals)) best = flat;
    else if (sharp) best = sharp;
    for (let i = 0; i < 7; i++) {
      const pc = (rootPc + intervals[i]) % 12;
      map[SHARPS[pc]] = best ? best.names[i] : noteLabel(SHARPS[pc]);
    }
  }
  cache.set(key, map);
  return map;
}

// A note as written in `key` (falls back to the plain swap when there's no key
// or the note isn't in it).
export const noteIn = (note, key) => (key ? keySpelling(key)[note] : undefined) ?? noteLabel(note);

// "A# Major" → "Bb Major"; "C# Minor" stays "C# Minor" in flats mode, as written in practice.
export function keyLabel(key) {
  if (mode !== 'flats' || typeof key !== 'string') return key;
  const parts = key.split(' ');
  if (parts.length < 2) return noteLabel(key);
  const root = parts.slice(0, -1).join(' ');
  return `${keySpelling(key)[root] ?? noteLabel(root)} ${parts[parts.length - 1]}`;
}
