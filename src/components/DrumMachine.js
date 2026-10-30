// The Jam section's drum machine. All sounds are synthesized with the Web
// Audio API (no sound files), and notes are scheduled slightly ahead of time
// on the audio clock — not with setTimeout — so the beat stays steady even if
// the screen is busy.
//
// A beat is described on a grid of "steps" per bar, one string per drum:
//   x = normal hit   X = accent   o = soft (ghost) hit   . = rest
//   k kick · s snare · h closed hat · o open hat · r rim click
//   T high tom · M mid tom · F floor tom · c crash · d ride
//   a metronome click, accent · m metronome click
// Every 4th bar the end of the bar is replaced by a short fill, and the bar
// after the fill starts with a crash.

const VEL = { X: 1.0, x: 0.75, o: 0.38 };
const LEVEL = { k: 1.0, s: 0.85, h: 0.32, o: 0.38, r: 0.6, T: 0.85, M: 0.85, F: 0.9, c: 0.55, d: 0.5, a: 0.9, m: 0.8 };
const LOOKAHEAD = 0.12;   // seconds scheduled ahead of the clock
const TICK_MS = 25;       // how often the scheduler wakes up
const FILL_EVERY = 4;     // bars

// Fills replace the LAST `steps` steps of every 4th bar.
const FILLS = {
  toms8:     { steps: 8, tracks: { k: 'x.......', s: 'x.x.....', T: '....xx..', M: '......x.', F: '.......x' } },
  roll8:     { steps: 8, tracks: { k: 'x.......', s: 'ooxxxxXX' } },
  beat4:     { steps: 4, tracks: { k: 'x...', s: '.x.x', T: '..x.' } },
  triplet6:  { steps: 6, tracks: { k: 'x.....', s: 'xxx...', T: '...x..', M: '....x.', F: '.....x' } },
  waltz4:    { steps: 4, tracks: { k: 'x...', s: 'xx..', T: '..x.', F: '...x' } },
};

// 4/4 beats use 16 steps (4 per beat); shuffle uses 12 (triplets); waltz is 3/4 with 12 (4 per beat).
export const BEATS = [
  { id: 'rock', name: 'Basic Rock', desc: 'Steady 8th-note hats, snare on 2 and 4', beatsPerBar: 4, stepsPerBeat: 4, steps: 16, bpm: [80, 130], fill: 'toms8',
    tracks: { h: 'x.x.x.x.x.x.x.x.', k: 'x.......x.x.....', s: '....x.......x...' } },
  { id: 'driving', name: 'Driving Rock', desc: 'Kick on every 8th, snare on 2 and 4', beatsPerBar: 4, stepsPerBeat: 4, steps: 16, bpm: [110, 170], fill: 'roll8',
    tracks: { h: 'x.x.x.x.x.x.x.x.', k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...' } },
  { id: 'halftime', name: 'Half-Time', desc: 'Big, slow backbeat — snare on 3', beatsPerBar: 4, stepsPerBeat: 4, steps: 16, bpm: [60, 100], fill: 'beat4',
    tracks: { h: 'x.x.x.x.x.x.x.x.', k: 'x.....x.......x.', s: '........x.......' } },
  { id: 'disco', name: 'Disco', desc: 'Four on the floor, open hats on the off-beats', beatsPerBar: 4, stepsPerBeat: 4, steps: 16, bpm: [100, 130], fill: 'toms8',
    tracks: { k: 'x...x...x...x...', h: 'x...x...x...x...', o: '..x...x...x...x.', s: '....x.......x...' } },
  { id: 'funk', name: 'Funk', desc: '16th-note hats with ghost-note snares', beatsPerBar: 4, stepsPerBeat: 4, steps: 16, bpm: [85, 115], fill: 'roll8',
    tracks: { h: 'xoxoxoxoxoxoxoxo', k: 'x..x....x.x.....', s: '....x..o.o..x..o' } },
  { id: 'hiphop', name: 'Hip-Hop', desc: 'Laid-back boom-bap with swung hats', beatsPerBar: 4, stepsPerBeat: 4, steps: 16, bpm: [70, 100], fill: 'beat4', swing: 0.22,
    tracks: { h: 'xoxoxoxoxoxoxoxo', k: 'x.....x...x.....', s: '....x.......x...' } },
  { id: 'shuffle', name: 'Blues Shuffle', desc: 'Triplet swing feel, snare on 2 and 4', beatsPerBar: 4, stepsPerBeat: 3, steps: 12, bpm: [70, 140], fill: 'triplet6',
    tracks: { h: 'x.xx.xx.xx.x', k: 'x.....x.....', s: '...x.....x..' } },
  { id: 'reggae', name: 'Reggae One-Drop', desc: 'Kick and rim click only on beat 3', beatsPerBar: 4, stepsPerBeat: 4, steps: 16, bpm: [65, 95], fill: 'beat4',
    tracks: { h: 'x.x.x.x.x.x.x.x.', k: '........x.......', r: '........x.......' } },
  { id: 'country', name: 'Country Train', desc: 'Constant snare chug with accented backbeat', beatsPerBar: 4, stepsPerBeat: 4, steps: 16, bpm: [110, 170], fill: 'roll8',
    tracks: { k: 'x.......x.......', s: 'o.o.X.o.o.o.X.o.' } },
  { id: 'metal', name: 'Metal Double-Kick', desc: 'Rapid kick drum under a half-time snare', beatsPerBar: 4, stepsPerBeat: 4, steps: 16, bpm: [80, 130], fill: 'toms8',
    tracks: { k: 'XxxxXxxxXxxxXxxx', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' } },
  { id: 'bossa', name: 'Bossa Nova', desc: 'Rim-click clave over a gentle kick', beatsPerBar: 4, stepsPerBeat: 4, steps: 16, bpm: [100, 150], fill: 'beat4',
    tracks: { h: 'x.x.x.x.x.x.x.x.', k: 'x.....x.x.....x.', r: 'x..x..x...x.x...' } },
  { id: 'waltz', name: 'Waltz (3/4)', desc: 'Kick on 1, snare on 2 and 3', beatsPerBar: 3, stepsPerBeat: 4, steps: 12, bpm: [90, 160], fill: 'waltz4',
    tracks: { k: 'x...........', s: '....x...x...', h: 'x.x.x.x.x.x.' } },
];

export const getBeat = (id) => BEATS.find(b => b.id === id) || BEATS[0];

// A one-bar, 16-step beat the user builds in the grid. It has no automatic
// fill, and `tracks` can be replaced at any time — the player reads it on every
// step, so edits are heard on the very next step.
export const makeCustomBeat = (tracks = {}) => ({
  id: 'custom', name: 'My Beat', desc: 'Your own pattern', beatsPerBar: 4, stepsPerBeat: 4, steps: 16, bpm: [60, 160], fill: null, tracks,
});

// A metronome: one step per beat, a higher click on beat 1. `tracks` is
// rebuilt for the number of beats in the bar.
export const makeMetronomeBeat = (beatsPerBar = 4) => ({
  id: 'metronome', name: `Metronome \u00B7 ${beatsPerBar} beats`, desc: 'Steady click', beatsPerBar, stepsPerBeat: 1, steps: beatsPerBar,
  bpm: [40, 220], fill: null,
  tracks: { a: 'X' + '.'.repeat(beatsPerBar - 1), m: '.' + 'x'.repeat(beatsPerBar - 1) },
});

// ── the drum sounds ─────────────────────────────────────────────────────

export function createDrumMachine(ctx, { onHit } = {}) {
  // one second of white noise, shared by the snare, hats, crash and toms
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  { const d = noise.getChannelData(0); let seed = 4242; for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; } }

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
  const master = ctx.createGain(); master.gain.value = 0.66;
  master.connect(comp); comp.connect(ctx.destination);

  let bus = null;            // everything for the current run goes through this, so Stop can cut it cleanly
  let openHat = null;        // the open hat that's currently ringing, so a closed hat can choke it

  const noiseSrc = (t, dur) => {
    const s = ctx.createBufferSource(); s.buffer = noise;
    s.start(t, Math.random() * 0.5, dur);
    return s;
  };
  const env = (g, t, peak, dur) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  };
  const filter = (type, freq, q = 0.7) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };

  const voices = {
    k(t, v) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
      const g = ctx.createGain(); env(g, t, v * 0.95, 0.42);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.45);
      const click = noiseSrc(t, 0.012), hp = filter('highpass', 2500), cg = ctx.createGain(); env(cg, t, v * 0.22, 0.01);
      click.connect(hp); hp.connect(cg); cg.connect(bus);
    },
    s(t, v) {
      const n = noiseSrc(t, 0.25), hp = filter('highpass', 900), bp = filter('peaking', 2200, 0.8); bp.gain.value = 5;
      const g = ctx.createGain(); env(g, t, v * 0.7, 0.2);
      n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(bus);
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(125, t + 0.08);
      const tg = ctx.createGain(); env(tg, t, v * 0.5, 0.11);
      o.connect(tg); tg.connect(bus); o.start(t); o.stop(t + 0.15);
    },
    // metronome clicks: a short, dry blip (accent is higher and brighter)
    a(t, v) { voices.click(t, v, 1900); },
    m(t, v) { voices.click(t, v, 1250); },
    click(t, v, freq) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const g = ctx.createGain(); env(g, t, v * 0.8, 0.045);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.06);
      const n = noiseSrc(t, 0.01), hp = filter('highpass', 3500), ng = ctx.createGain(); env(ng, t, v * 0.25, 0.008);
      n.connect(hp); hp.connect(ng); ng.connect(bus);
    },
    r(t, v) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1750;
      const g = ctx.createGain(); env(g, t, v * 0.3, 0.035);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.05);
      const n = noiseSrc(t, 0.03), bp = filter('bandpass', 2800, 1.2), ng = ctx.createGain(); env(ng, t, v * 0.4, 0.03);
      n.connect(bp); bp.connect(ng); ng.connect(bus);
    },
    h(t, v) {
      if (openHat) { openHat.gain.cancelScheduledValues(t); openHat.gain.setTargetAtTime(0, t, 0.006); openHat = null; } // closed hat chokes the open one
      const n = noiseSrc(t, 0.07), hp = filter('highpass', 7000), g = ctx.createGain(); env(g, t, v * 0.5, 0.05);
      n.connect(hp); hp.connect(g); g.connect(bus);
    },
    o(t, v) {
      const n = noiseSrc(t, 0.4), hp = filter('highpass', 6500), g = ctx.createGain(); env(g, t, v * 0.5, 0.32);
      n.connect(hp); hp.connect(g); g.connect(bus);
      openHat = g;
    },
    d(t, v) {
      const n = noiseSrc(t, 0.8), hp = filter('highpass', 6000), g = ctx.createGain(); env(g, t, v * 0.45, 0.6);
      n.connect(hp); hp.connect(g); g.connect(bus);
      const bp = filter('bandpass', 5200, 1.5), pg = ctx.createGain(); env(pg, t, v * 0.22, 0.4);   // the bell-like "ping"
      for (const f of [3300, 4900]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(bp); o.start(t); o.stop(t + 0.45); }
      bp.connect(pg); pg.connect(bus);
    },
    c(t, v) {
      const n = noiseSrc(t, 1.0), hp = filter('highpass', 4200), g = ctx.createGain(); env(g, t, v * 0.55, 1.4);
      n.connect(hp); hp.connect(g); g.connect(bus);
    },
    tom(t, v, f1, f2) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + 0.16);
      const g = ctx.createGain(); env(g, t, v * 0.85, 0.38);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.42);
      const n = noiseSrc(t, 0.02), bp = filter('bandpass', 1500), ng = ctx.createGain(); env(ng, t, v * 0.15, 0.02);
      n.connect(bp); bp.connect(ng); ng.connect(bus);
    },
  };
  voices.T = (t, v) => voices.tom(t, v, 230, 150);
  voices.M = (t, v) => voices.tom(t, v, 170, 112);
  voices.F = (t, v) => voices.tom(t, v, 125, 82);

  // ── the player ──
  let beat = BEATS[0];
  let pendingBeat = null;     // a beat chosen mid-bar waits for the next bar line
  let bpm = 100;
  let playing = false;
  let timer = null;
  let barIdx = 0, stepIdx = 0, nextTime = 0, justFilled = false;
  let queue = [];             // recent steps {time, bar, beat, fill}, for the on-screen position

  function hit(drum, t, ch) {
    const v = (VEL[ch] ?? 0) * (LEVEL[drum] ?? 0.7);
    if (!v) return;
    if (onHit) onHit(drum, t, v);
    voices[drum](t, v);
  }

  function scheduleStep(t) {
    const fill = beat.fill ? FILLS[beat.fill] : null;         // some beats (the user's own) have no fill
    const fillBar = !!fill && barIdx === FILL_EVERY - 1;
    const fillStart = fill ? beat.steps - fill.steps : beat.steps;
    const inFill = fillBar && stepIdx >= fillStart;
    const when = t + (beat.swing && stepIdx % 2 === 1 ? beat.swing * (60 / bpm / beat.stepsPerBeat) : 0);

    const source = inFill ? fill.tracks : beat.tracks;
    const idx = inFill ? stepIdx - fillStart : stepIdx;
    for (const drum of Object.keys(source)) {
      const ch = source[drum][idx];
      if (ch && ch !== '.') hit(drum, when, ch);
    }
    if (barIdx === 0 && stepIdx === 0 && justFilled) hit('c', t, 'X');   // crash on the downbeat after a fill

    queue.push({ time: t, bar: barIdx, step: stepIdx, beat: Math.floor(stepIdx / beat.stepsPerBeat), fill: inFill });
    if (queue.length > 64) queue.splice(0, queue.length - 64);
  }

  function advance() {
    nextTime += 60 / bpm / beat.stepsPerBeat;
    stepIdx++;
    if (stepIdx >= beat.steps) {
      stepIdx = 0;
      justFilled = !!beat.fill && barIdx === FILL_EVERY - 1;
      barIdx = (barIdx + 1) % FILL_EVERY;
      if (pendingBeat) { beat = pendingBeat; pendingBeat = null; barIdx = 0; justFilled = false; }
    }
  }

  // Schedule every step that falls before `untilTime`.
  function pump(untilTime) {
    while (nextTime < untilTime) {
      scheduleStep(nextTime);
      if (barIdx === 0 && stepIdx === 0) justFilled = false; // crash (if any) has been scheduled for this downbeat
      advance();
    }
  }

  function begin(startTime) {
    bus = ctx.createGain(); bus.connect(master);
    openHat = null; queue = [];
    barIdx = 0; stepIdx = 0; justFilled = false; pendingBeat = null;
    nextTime = startTime; playing = true;
  }

  return {
    start() { return this.startAt(ctx.currentTime + 0.08); },
    // Start with the first beat exactly at audio-clock time `t`; returns `t`.
    startAt(t) {
      if (playing) return t;
      begin(t);
      pump(ctx.currentTime + LOOKAHEAD);
      timer = setInterval(() => {
        const now = ctx.currentTime;
        if (nextTime < now - 0.15) nextTime = now + 0.05;      // the app was paused/backgrounded — resume cleanly, don't machine-gun to catch up
        pump(now + LOOKAHEAD);
      }, TICK_MS);
      return t;
    },
    // Silence everything from audio-clock time `t` on (sample-accurate), while the
    // beat keeps running so its position can still be shown. Used by the Record tab:
    // audible count-in, then a silent pulse so nothing leaks into the microphone.
    muteFrom(t) {
      master.gain.cancelScheduledValues(0);
      master.gain.setValueAtTime(0.66, Math.max(0, t - 0.02));
      master.gain.setValueAtTime(0, Math.max(0, t - 0.005));
    },
    stop() {
      if (!playing) return;
      playing = false;
      clearInterval(timer); timer = null;
      const b = bus; bus = null;
      if (b) { b.gain.cancelScheduledValues(ctx.currentTime); b.gain.setTargetAtTime(0, ctx.currentTime, 0.015); setTimeout(() => { try { b.disconnect(); } catch { /* gone */ } }, 400); }
    },
    isPlaying: () => playing,
    setBpm(v) { bpm = Math.min(240, Math.max(30, Math.round(v))); },
    getBpm: () => bpm,
    // Choosing a beat while playing takes effect at the next bar line (and restarts the 4-bar fill cycle).
    setBeat(b) { if (playing) pendingBeat = b; else beat = b; },
    getBeat: () => beat,
    // Where the music is right now: { bar: 0-3, beat: 0-based, fill: bool }, or null when stopped.
    getPosition() {
      if (!playing) return null;
      const t = ctx.currentTime - (ctx.outputLatency || 0);
      let cur = null;
      for (const q of queue) { if (q.time <= t) cur = q; else break; }
      return cur ? { bar: cur.bar, step: cur.step, beat: cur.beat, fill: cur.fill } : null;
    },
    // Sound a single drum right now (to audition a step in the grid). Works while stopped.
    preview(drum, vel = 0.9) {
      if (!voices[drum]) return;
      if (!bus) { bus = ctx.createGain(); bus.connect(master); }
      voices[drum](ctx.currentTime + 0.005, vel * (LEVEL[drum] ?? 0.7));
    },
    // test hooks (no timers)
    _begin: begin, _pump: pump,
  };
}
