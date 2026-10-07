// ═══════════════════════════════════════════════════════════════════════
//  THE APP'S MUSIC COLORS — CHANGE THEM HERE AND EVERY SCREEN FOLLOWS
// ═══════════════════════════════════════════════════════════════════════
//
// Each of these is a plain hex color (#rrggbb). Edit the value, save,
// deploy — that's all. Text that sits on top of a color (the letter inside
// a note badge, the note names on a card) automatically switches between
// dark and light to stay readable, so there's no second color to keep in
// step with the first.
//
// Where each is used:
//   NOTE_ROLE_COLORS     root / 3rd / 5th of a key or chord —
//                        • Practice tab: licks, double stops, and the legend
//                        • Key Finder: the fretboard, chord diagram dots,
//                          and chord note names
//                        • the key's note list after recording and under
//                          the Key dropdown in a clip's details
//   CHORD_QUALITY_COLORS the Key Finder's seven scale-degree cards:
//                        major / minor / diminished
//   RELATIVE_KEY_COLOR   the ring that marks the relative major/minor card

export const NOTE_ROLE_COLORS = {
  root:  '#ff4444', // red
  third: '#bf5916', // orange
  fifth: '#ffe14d', // yellow
};

export const CHORD_QUALITY_COLORS = {
  M:   '#00c853', // major      — green
  m:   '#2979ff', // minor      — blue
  dim: '#ff1744', // diminished — red
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

// Convenience: the text color for each role, derived from the role colors.
export const NOTE_ROLE_TEXT = {
  root:  readableTextOn(NOTE_ROLE_COLORS.root),
  third: readableTextOn(NOTE_ROLE_COLORS.third),
  fifth: readableTextOn(NOTE_ROLE_COLORS.fifth),
};
