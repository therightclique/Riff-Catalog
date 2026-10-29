import { useEffect, useRef, useState } from 'react';
import { BEATS, getBeat, createDrumMachine, makeCustomBeat } from './DrumMachine';
import { getAudioContext, installAudioUnlock } from './AudioEngine';

const MIN_BPM = 40, MAX_BPM = 220;
const clampBpm = (v) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(Number(v) || 100)));

// The rows of the "make your own" grid, in display order. `key` is the drum
// name the drum machine uses.
const ROWS = [
  { key: 'k', label: 'Kick',   color: '#ef5350' },
  { key: 's', label: 'Snare',  color: '#ff8a65' },
  { key: 'T', label: 'Tom 1',  color: '#ba68c8' },
  { key: 'M', label: 'Tom 2',  color: '#7986cb' },
  { key: 'c', label: 'Crash',  color: '#ffb300' },
  { key: 'd', label: 'Ride',   color: '#d4e157' },
  { key: 'o', label: 'Open hat',   color: '#26c6da' },
  { key: 'h', label: 'Closed hat', color: '#4fc3f7' },
];
const STEPS = 16;
const EMPTY_ROW = '.'.repeat(STEPS);

const loadCustom = () => {
  const tracks = {};
  try {
    const saved = JSON.parse(localStorage.getItem('rc_jam_custom') || '{}');
    for (const r of ROWS) {
      const s = saved[r.key];
      tracks[r.key] = typeof s === 'string' && s.length === STEPS && /^[x.]+$/.test(s) ? s : EMPTY_ROW;
    }
  } catch { for (const r of ROWS) tracks[r.key] = EMPTY_ROW; }
  return tracks;
};

const loadSaved = () => {
  try {
    const s = JSON.parse(localStorage.getItem('rc_jam') || '{}');
    return { beatId: getBeat(s.beatId).id, bpm: clampBpm(s.bpm || 100), mode: s.mode === 'custom' ? 'custom' : 'presets' };
  } catch { return { beatId: BEATS[0].id, bpm: 100, mode: 'presets' }; }
};

export default function Jam() {
  const saved = useRef(loadSaved()).current;
  const [beatId, setBeatId] = useState(saved.beatId);
  const [bpm, setBpmState] = useState(saved.bpm);
  const [mode, setMode] = useState(saved.mode);            // 'presets' | 'custom'
  const [grid, setGrid] = useState(loadCustom);            // { k: 'x...x...', s: ... } — the user's own beat
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(null);                    // { bar, step, beat, fill } while playing
  const [noAudio, setNoAudio] = useState(false);
  const machine = useRef(null);
  const raf = useRef(null);
  const lastPos = useRef(null);
  const customBeat = useRef(makeCustomBeat(grid));          // one stable object; the player reads its tracks live

  const presetBeat = getBeat(beatId);
  const beat = mode === 'custom' ? customBeat.current : presetBeat;

  useEffect(() => { installAudioUnlock(); }, []);
  useEffect(() => {
    try { localStorage.setItem('rc_jam', JSON.stringify({ beatId, bpm, mode })); } catch { /* remembering is optional */ }
  }, [beatId, bpm, mode]);
  useEffect(() => {
    customBeat.current.tracks = grid;                       // heard on the very next step
    try { localStorage.setItem('rc_jam_custom', JSON.stringify(grid)); } catch { /* remembering is optional */ }
  }, [grid]);

  // While playing, follow the music on screen.
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const p = machine.current?.getPosition() || null;
      const l = lastPos.current;
      if ((p?.step ?? -1) !== (l?.step ?? -1) || (p?.bar ?? -1) !== (l?.bar ?? -1) || (p?.fill ?? false) !== (l?.fill ?? false)) {
        lastPos.current = p; setPos(p);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  // Stop the drums if this screen is ever torn down.
  useEffect(() => () => { machine.current?.stop(); }, []);

  // The drum machine is created on first use, inside a tap (browsers require that for sound).
  const ensureMachine = () => {
    if (machine.current) return machine.current;
    const ctx = getAudioContext();
    if (!ctx) { setNoAudio(true); return null; }
    machine.current = createDrumMachine(ctx);
    machine.current.setBpm(bpm);
    return machine.current;
  };

  const begin = () => {
    const m = ensureMachine();
    if (!m) return;
    m.setBpm(bpm);
    m.setBeat(beat);
    m.start();
    lastPos.current = null;
    setPlaying(true);
  };

  const toggle = () => {
    if (playing) {
      machine.current?.stop();
      setPlaying(false); setPos(null); lastPos.current = null;
      return;
    }
    const ctx = getAudioContext();
    if (!ctx) { setNoAudio(true); return; }
    if (ctx.state === 'running') begin();
    else ctx.resume().then(begin).catch(() => setNoAudio(true));
  };

  const changeBpm = (v) => {
    const b = clampBpm(v);
    setBpmState(b);
    machine.current?.setBpm(b);   // takes effect on the very next beat
  };

  const chooseBeat = (id) => {
    setBeatId(id);
    machine.current?.setBeat(getBeat(id));  // while playing, switches at the next bar line
  };

  const chooseMode = (m) => {
    if (m === mode) return;
    setMode(m);
    machine.current?.setBeat(m === 'custom' ? customBeat.current : presetBeat);
  };

  const toggleCell = (key, i) => (e) => {
    e.preventDefault();
    const row = grid[key];
    const on = row[i] !== 'x';
    setGrid(g => ({ ...g, [key]: row.slice(0, i) + (on ? 'x' : '.') + row.slice(i + 1) }));
    if (on) { const m = ensureMachine(); m?.preview(key); }   // hear what you just added
  };

  const clearGrid = () => {
    const empty = {}; for (const r of ROWS) empty[r.key] = EMPTY_ROW;
    setGrid(empty);
  };
  const gridEmpty = ROWS.every(r => !grid[r.key].includes('x'));

  const stepBtn = (label, delta) => (
    <button onClick={() => changeBpm(bpm + delta)} aria-label={`${delta > 0 ? 'Faster' : 'Slower'} by ${Math.abs(delta)}`}
      style={{ width: '46px', height: '40px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#222',
        fontSize: '14px', fontWeight: '600', cursor: 'pointer', touchAction: 'manipulation' }}>
      {label}
    </button>
  );

  const hasFill = !!beat.fill;
  const modeBtn = (id, label, i) => {
    const active = mode === id;
    return (
      <button key={id} onClick={() => chooseMode(id)} role="tab" aria-selected={active}
        style={{
          padding: '8px 18px', fontSize: '14px', cursor: 'pointer', fontWeight: active ? '700' : '500',
          border: '1px solid #1a73e8', backgroundColor: active ? '#1a73e8' : 'white', color: active ? 'white' : '#1a73e8',
          borderRadius: i === 0 ? '8px 0 0 8px' : '0 8px 8px 0', marginLeft: i === 0 ? 0 : '-1px',
        }}>
        {label}
      </button>
    );
  };

  return (
    <div style={{ marginTop: '20px', textAlign: 'center' }}>
      <h2 style={{ marginBottom: '6px' }}>Jam</h2>
      <p style={{ fontSize: '13px', color: '#888', margin: '0 0 14px' }}>
        {mode === 'custom' ? 'Tap out your own one-bar beat and play along. It loops.' : 'Pick a beat and play along. It loops, with a fill every 4th bar.'}
      </p>

      <div role="tablist" aria-label="Beat source" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        {modeBtn('presets', '🥁 Preset beats', 0)}
        {modeBtn('custom', '✏️ Make your own', 1)}
      </div>

      {/* Transport */}
      <div style={{ padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '10px', color: '#222', marginBottom: '20px' }}>
        <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>{beat.name}</div>

        <button onClick={toggle} aria-label={playing ? 'Stop' : 'Start'}
          style={{
            width: '100%', maxWidth: '280px', height: '56px', borderRadius: '12px', border: 'none', cursor: 'pointer',
            fontSize: '18px', fontWeight: '800', color: '#fff', touchAction: 'manipulation',
            backgroundColor: playing ? '#cc0000' : '#2a8a3a',
          }}>
          {playing ? '■  Stop' : '▶  Start'}
        </button>
        {noAudio && <div style={{ fontSize: '12px', color: '#a00', marginTop: '8px' }}>Couldn't start audio on this device.</div>}

        {/* Where we are in the loop */}
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '10px' }} aria-label="Beat">
          {Array.from({ length: beat.beatsPerBar }, (_, i) => (
            <div key={i} style={{
              width: '22px', height: '22px', borderRadius: '50%',
              backgroundColor: pos && pos.beat === i ? '#1a73e8' : '#d9d9d9',
              transform: pos && pos.beat === i ? 'scale(1.2)' : 'none', transition: 'background-color 60ms, transform 60ms',
            }} />
          ))}
        </div>
        {hasFill && (
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }} aria-label="Bar">
            {[0, 1, 2, 3].map(i => {
              const on = pos && pos.bar === i;
              const isFillBar = i === 3;
              return (
                <div key={i} style={{
                  minWidth: '44px', padding: '3px 0', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                  backgroundColor: on ? (isFillBar && pos.fill ? '#e07a10' : '#1a73e8') : '#e6e6e6',
                  color: on ? '#fff' : '#777',
                }}>
                  {isFillBar ? 'Bar 4 · fill' : `Bar ${i + 1}`}
                </div>
              );
            })}
          </div>
        )}

        {/* Tempo — shared by preset beats and your own */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '12px', color: '#666', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Tempo</div>
          <div style={{ fontSize: '40px', fontWeight: '800', lineHeight: 1.1, margin: '2px 0 8px' }}>
            {bpm}<span style={{ fontSize: '14px', fontWeight: '600', color: '#666', marginLeft: '6px' }}>BPM</span>
          </div>
          <input type="range" min={MIN_BPM} max={MAX_BPM} step="1" value={bpm}
            onChange={e => changeBpm(e.target.value)} aria-label="Tempo in beats per minute"
            style={{ width: '100%', maxWidth: '340px' }} />
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
            {stepBtn('−5', -5)}{stepBtn('−1', -1)}{stepBtn('+1', 1)}{stepBtn('+5', 5)}
          </div>
          {mode === 'presets' && (
            <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
              This beat sits well around {beat.bpm[0]}–{beat.bpm[1]} BPM
            </div>
          )}
        </div>
      </div>

      {mode === 'presets' ? (
        <>
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '10px' }}>Choose a beat</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'left' }}>
            {BEATS.map(b => {
              const active = b.id === beatId;
              return (
                <button key={b.id} onClick={() => chooseBeat(b.id)} aria-pressed={active}
                  style={{
                    padding: '12px', borderRadius: '10px', cursor: 'pointer', touchAction: 'manipulation',
                    border: `2px solid ${active ? '#1a73e8' : '#ddd'}`, backgroundColor: active ? '#e8f0fe' : '#fff', color: '#222',
                  }}>
                  <div style={{ fontSize: '14px', fontWeight: '700' }}>{b.name}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px', lineHeight: 1.3 }}>{b.desc}</div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{b.beatsPerBar}/4 · {b.bpm[0]}–{b.bpm[1]} BPM</div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div>
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '10px' }}>
            One bar of 16 steps — tap a square to turn it on or off. Edits are heard right away.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '12px 8px', backgroundColor: '#f9f9f9', borderRadius: '10px' }}>
            {/* Beat numbers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              <div style={{ width: '54px', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
                {[1, 2, 3, 4].map(n => <div key={n} style={{ fontSize: '11px', fontWeight: '700', color: '#777' }}>{n}</div>)}
              </div>
            </div>
            {ROWS.map(row => (
              <div key={row.key} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '54px', flexShrink: 0, fontSize: '11px', fontWeight: '700', color: '#333', textAlign: 'left', lineHeight: 1.1, paddingRight: '4px' }}>
                  {row.label}
                </div>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
                  {[0, 1, 2, 3].map(group => (
                    <div key={group} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px' }}>
                      {[0, 1, 2, 3].map(k => {
                        const i = group * 4 + k;
                        const on = grid[row.key][i] === 'x';
                        const playhead = playing && pos && pos.step === i && mode === 'custom';
                        return (
                          <button key={i} onPointerDown={toggleCell(row.key, i)} onContextMenu={e => e.preventDefault()}
                            aria-label={`${row.label} step ${i + 1}`} aria-pressed={on}
                            style={{
                              height: '34px', minWidth: 0, padding: 0, border: playhead ? '2px solid #1a73e8' : '1px solid rgba(0,0,0,0.12)',
                              borderRadius: '3px', cursor: 'pointer', touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none',
                              backgroundColor: on ? row.color : (group % 2 === 0 ? '#e4e4e4' : '#d2d2d2'),
                              outline: playhead && on ? '2px solid #fff' : 'none',
                              filter: playhead ? 'brightness(1.12)' : 'none',
                            }} />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px' }}>
            <button onClick={clearGrid} disabled={gridEmpty}
              style={{ padding: '8px 18px', fontSize: '13px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: '#fff',
                color: gridEmpty ? '#aaa' : '#222', cursor: gridEmpty ? 'default' : 'pointer' }}>
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
