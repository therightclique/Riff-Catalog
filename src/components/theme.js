// ═══════════════════════════════════════════════════════════════════════
//  THE APP'S MUSIC COLORS — CHANGE THEM HERE AND EVERY SCREEN FOLLOWS
// ═══════════════════════════════════════════════════════════════════════
//
// The root / 3rd / 5th / other-note colors are now chosen in the app's Settings (menu →
// Settings) and saved to the user's Google Drive, so the values below are
// only the DEFAULTS (used until a color is picked, and by "Reset to
// defaults"). The other colors here are still edited in this file — plain
// hex colors (#rrggbb): edit the value, save, deploy. Text that sits on top of a color (the letter inside
// a note badge, the note names on a card) automatically switches between
// dark and light to stay readable, so there's no second color to keep in
// step with the first.
//
// Where each is used:
//   NOTE_ROLE_COLORS     root / 3rd / 5th of a key or chord, plus "other" (the key's
//                        remaining notes, shown on the fretboard, keyboard and note row) —
//                        • Practice tab: licks, double stops, and the legend
//                        • Key Finder: the fretboard, chord diagram dots,
//                          and chord note names
//                        • the key's note list after recording and under
//                          the Key dropdown in a clip's details
//   CHORD_QUALITY_STYLES the Key Finder's seven scale-degree cards:
//                        major / minor / diminished (black & white patterns)
//   RELATIVE_KEY_COLOR   the ring that marks the relative major/minor card

export const DEFAULT_NOTE_ROLE_COLORS = Object.freeze({
  root:  '#ff4444', // red
  third: '#bf5916', // orange
  fifth: '#ffe14d', // yellow
  other: '#1a73e8', // blue — every other note of the key
});

// LIVE objects: applyNoteRoleColors() changes them in place, so every screen
// that reads NOTE_ROLE_COLORS.root (etc.) during a render sees the current
// choice. Nothing should copy these at load time — read them when drawing.
export const NOTE_ROLE_COLORS = { ...DEFAULT_NOTE_ROLE_COLORS };

// Chord quality is shown in black & white (not color) so it never clashes
// with the note colors chosen in Settings:
//   major      — solid white card
//   minor      — black card with a white outline
//   diminished — black card filled with diagonal white lines
export const CHORD_QUALITY_STYLES = {
  M:   { background: '#ffffff', border: '2px solid #ffffff', ink: '#000000', pill: null },
  m:   { background: '#000000', border: '2px solid #ffffff', ink: '#ffffff', pill: null },
  dim: {
    background: 'repeating-linear-gradient(45deg, #000000 0, #000000 4px, #ffffff 4px, #ffffff 7px)',
    border: '2px solid #ffffff', ink: '#ffffff', pill: '#000000',
  },
};

export const RELATIVE_KEY_COLOR = '#e879f9'; // magenta — unused by anything else, so it can't be mistaken

// ── helpers ─────────────────────────────────────────────────────────────

function toRgb(hex) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [128, 128, 128]; // unparseable → mid grey, never crashes a screen
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

function luminance(hex) {
  const [r, g, b] = toRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Dark or white text — whichever reads better on top of this color.
export function readableTextOn(hex) {
  return contrast(hex, '#ffffff') >= contrast(hex, '#111111') ? '#ffffff' : '#111111';
}

// Convenience: the text color for each role, derived from the role colors
// (kept in step automatically whenever the colors change).
export const NOTE_ROLE_TEXT = {
  root:  readableTextOn(NOTE_ROLE_COLORS.root),
  third: readableTextOn(NOTE_ROLE_COLORS.third),
  fifth: readableTextOn(NOTE_ROLE_COLORS.fifth),
  other: readableTextOn(NOTE_ROLE_COLORS.other),
};

// ── choosing the colors at runtime ──────────────────────────────────────
const HEX6 = /^#[0-9a-f]{6}$/i;
export const isValidHex = (v) => HEX6.test(String(v || ''));

const listeners = new Set();
// Call fn whenever the colors change; returns an unsubscribe function.
export function subscribeNoteRoleColors(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Apply any of { root, third, fifth }. Invalid values are ignored. Returns
// true if anything actually changed.
export function applyNoteRoleColors(colors) {
  let changed = false;
  for (const role of Object.keys(DEFAULT_NOTE_ROLE_COLORS)) {
    const v = colors && colors[role];
    if (isValidHex(v) && v.toLowerCase() !== NOTE_ROLE_COLORS[role]) {
      NOTE_ROLE_COLORS[role] = v.toLowerCase();
      NOTE_ROLE_TEXT[role] = readableTextOn(NOTE_ROLE_COLORS[role]);
      changed = true;
    }
  }
  if (changed) listeners.forEach(fn => { try { fn(); } catch { /* a listener must never break a color change */ } });
  return changed;
}
