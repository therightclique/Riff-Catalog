import { getScaleNotes } from './FretboardDiagram';
import { NOTE_ROLE_COLORS, NOTE_ROLE_TEXT } from './theme';

// The seven notes of a key, with the root, 3rd, and 5th highlighted in the
// app's root / 3rd / 5th colors. One component used everywhere a key's
// notes are shown (after recording, and under the Key dropdown in a clip's
// details), so they always look the same and always come from the same
// getScaleNotes Key Finder uses. The colors come from theme.js — change
// them there, not here.
const chipFor = (role) => ({
  bg: NOTE_ROLE_COLORS[role], border: NOTE_ROLE_COLORS[role], text: NOTE_ROLE_TEXT[role],
});
const CHIP_STYLES = {
  root:  chipFor('root'),
  third: chipFor('third'),
  fifth: chipFor('fifth'),
  plain: { bg: '#ffffff', border: '#b5d4f0', text: '#222222' },
};

// getScaleNotes returns scale degrees 1–7 in order from the key's root, so
// the 3rd and 5th are simply the entries at index 2 and 4 — for a minor key
// that's automatically the minor third.
const ROLE_BY_INDEX = { 0: 'root', 2: 'third', 4: 'fifth' };
const ROLE_LABEL = { root: 'Root', third: '3rd', fifth: '5th' };

export default function KeyNotes({ keyName, marginTop = '8px', align = 'center' }) {
  if (!keyName) return null;
  const notes = getScaleNotes(keyName);
  if (notes.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: align === 'left' ? 'flex-start' : 'center', marginTop }}>
      {notes.map(({ note }, i) => {
        const role = ROLE_BY_INDEX[i] || 'plain';
        const c = CHIP_STYLES[role];
        return (
          <span
            key={note}
            title={ROLE_LABEL[role] || undefined}
            style={{
              minWidth: '30px', padding: '4px 8px', borderRadius: '6px', textAlign: 'center',
              fontSize: '13px', fontWeight: role === 'plain' ? '500' : '700',
              backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}`,
            }}
          >
            {note}
          </span>
        );
      })}
    </div>
  );
}

export { CHIP_STYLES };
