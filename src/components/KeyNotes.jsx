import { getScaleNotes } from './FretboardDiagram';

// The seven notes of a key, with the root, 3rd, and 5th softly highlighted.
// One component used everywhere a key's notes are shown (after recording,
// and under the Key dropdown in a clip's details), so they always look the
// same and always come from the same getScaleNotes Key Finder uses.
//
// Colors are deliberately subdued — these sit in the middle of a form, not
// on a diagram. The root is the app's red at 20% of its saturation
// (#cc0000 -> #7a5252); the 3rd and 5th are light, similarly muted tints of
// the orange and yellow used for those roles elsewhere in the app.
const CHIP_STYLES = {
  root:  { bg: '#7a5252', border: '#7a5252', text: '#ffffff' },
  third: { bg: '#e3c7b5', border: '#cca78e', text: '#472915' },
  fifth: { bg: '#e6dba8', border: '#c8bc7e', text: '#43390a' },
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
