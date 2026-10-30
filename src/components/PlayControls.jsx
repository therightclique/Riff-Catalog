import { useRef, useState } from 'react';
import { NOTE_ROLE_COLORS, NOTE_ROLE_TEXT } from './theme';
import { getScaleNotes } from './FretboardDiagram';
import { noteIn } from './Notation';
import { playNote, playSequence, scaleMidi } from './AudioEngine';

// Row of tappable notes for a key: root up through the octave. Colored like
// the diagrams (root / 3rd / 5th / other, all from Settings). Notes start on
// touch-down, not on release, so quick melodies feel immediate.
export function NoteStrip({ selectedKey, instrument }) {
  const [pressed, setPressed] = useState(null);
  const timer = useRef(null);
  const scale = getScaleNotes(selectedKey);
  if (!scale.length) return null;

  const midis = scaleMidi(instrument, scale.map(n => n.note));
  const entries = [...scale, { ...scale[0], degree: '8' }]; // top note is the root again, an octave up

  const roleOf = (degree) =>
    degree === '1' || degree === '8' ? 'root' : degree === '3' ? 'third' : degree === '5' ? 'fifth' : 'other';

  const tap = (i) => (e) => {
    e.preventDefault();
    playNote(instrument, midis[i]);
    setPressed(i);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPressed(null), 140);
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '13px', color: '#888', textAlign: 'center', marginBottom: '8px' }}>
        🎵 Tap the notes to play them
      </div>
      <div style={{ display: 'flex', gap: '5px', maxWidth: '420px', margin: '0 auto' }}>
        {entries.map((n, i) => {
          const role = roleOf(n.degree);
          const bg = NOTE_ROLE_COLORS[role];
          const ink = NOTE_ROLE_TEXT[role];
          return (
            <button
              key={`${n.note}-${n.degree}`}
              onPointerDown={tap(i)}
              onContextMenu={e => e.preventDefault()}
              aria-label={`Play ${noteIn(n.note, selectedKey)}`}
              style={{
                flex: 1, minWidth: 0, height: '58px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: bg, color: ink, fontWeight: '800', fontSize: '15px', padding: 0,
                touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                transform: pressed === i ? 'scale(0.92)' : 'none', filter: pressed === i ? 'brightness(1.25)' : 'none',
                transition: 'transform 60ms, filter 60ms',
              }}>
              {noteIn(n.note, selectedKey)}
              <div style={{ fontSize: '9px', fontWeight: '600', opacity: 0.8 }}>{n.degree === '8' ? '8va' : n.degree}</div>
            </button>
          );
        })}
      </div>
      <div style={{ textAlign: 'center', marginTop: '10px' }}>
        <button
          onPointerDown={e => { e.preventDefault(); playSequence(instrument, midis); }}
          style={{
            padding: '8px 18px', fontSize: '13px', borderRadius: '8px', border: '1px solid var(--rc-line)',
            backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)', cursor: 'pointer', touchAction: 'manipulation', userSelect: 'none',
          }}>
          ▶ Play scale
        </button>
      </div>
    </div>
  );
}

// ▶ button for a chord diagram. Stops the tap from also opening the zoom view.
export function PlayChordButton({ onPlay, big = false }) {
  return (
    <button
      onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onPlay(); }}
      onClick={e => e.stopPropagation()}
      aria-label="Play chord"
      style={{
        padding: big ? '10px 28px' : '3px 14px', fontSize: big ? '16px' : '12px', borderRadius: big ? '10px' : '12px',
        border: '1px solid #1a73e8', backgroundColor: 'var(--rc-surface)', color: '#1a73e8', fontWeight: '700', cursor: 'pointer',
        touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
        marginTop: big ? '14px' : '2px',
      }}>
      ▶ Play
    </button>
  );
}
