// Sound for the Key Finder: plays chords and single notes. Everything is
// synthesized live with the Web Audio API — no sound files to download, so
// it works offline and starts instantly.
//   • guitar — a plucked-string model (Karplus-Strong), through a little
//              body/warmth filtering: a basic clean guitar
//   • piano  — a bright-to-mellow decaying tone with a hammer tap and a
//              two-stage decay: a basic grand piano
// Chords are strummed (notes staggered by a few ms) so each can be heard.

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const GUITAR_OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // low E, A, D, G, B, high E
const STRUM_SECONDS = { guitar: 0.09, piano: 0.065 }; // gap between successive notes of a chord

// How drawn out a chord strum is, as a multiple of the default (Settings → Strum speed).
let strumScale = 1;
export function setStrumScale(v) { strumScale = Math.min(3, Math.max(0.1, Number(v) || 1)); }

export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pitchClass = (name) => CHROMATIC.indexOf(name);

// ── what to play ────────────────────────────────────────────────────────

// MIDI notes of a guitar chord shape (frets listed low string → high string;
// negative = muted), lowest first.
export function guitarChordMidi(shape) {
  if (!shape?.frets) return [];
  return shape.frets
    .map((fret, i) => (fret < 0 ? null : GUITAR_OPEN_MIDI[i] + fret))
    .filter(m => m !== null);
}

// Root-position triad around the middle of the piano (between G3 and F#4).
export function pianoChordMidi(root, quality) {
  const pc = pitchClass(root);
  if (pc === -1) return [];
  const base = 55 + (((pc - 55) % 12) + 12) % 12;
  const intervals = quality === 'M' ? [0, 4, 7] : quality === 'm' ? [0, 3, 7] : [0, 3, 6];
  return intervals.map(i => base + i);
}

// The notes of a key from its root up through the octave (8 notes), at a
// comfortable register for the instrument. `noteNames` are the seven scale
// notes in order starting from the root.
export function scaleMidi(instrument, noteNames) {
  if (!noteNames?.length) return [];
  const rootPc = pitchClass(noteNames[0]);
  const base = (instrument === 'guitar' ? 48 : 60) + rootPc;
  const notes = noteNames.map(n => base + ((pitchClass(n) - rootPc + 12) % 12));
  return [...notes, base + 12];
}

// ── the engine ──────────────────────────────────────────────────────────

export function createEngine(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0.7;
  const comp = ctx.createDynamicsCompressor(); // keeps big chords from clipping
  comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4;
  comp.attack.value = 0.003; comp.release.value = 0.2;
  master.connect(comp); comp.connect(ctx.destination);

  // Guitar bus: a touch of body around 240 Hz, highs rolled off for a warm, clean tone.
  const guitarBus = ctx.createGain();
  const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 240; body.gain.value = 3;
  const warm = ctx.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 4500;
  guitarBus.connect(body); body.connect(warm); warm.connect(master);

  const pianoBus = ctx.createGain();
  pianoBus.connect(master);

  // Limit how many notes ring at once so rapid tapping can't pile up.
  let voices = [];
  const MAX_VOICES = 28;
  const track = (gain, end) => {
    const now = ctx.currentTime;
    voices = voices.filter(v => v.end > now);
    voices.push({ gain, end });
    while (voices.length > MAX_VOICES) {
      const v = voices.shift();
      try {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setValueAtTime(v.gain.gain.value, now);
        v.gain.gain.linearRampToValueAtTime(0, now + 0.05);
      } catch { /* voice already finished */ }
    }
  };

  // ── guitar: Karplus-Strong plucked string, rendered once per note and cached ──
  const pluckCache = new Map();
  function pluck(midi) {
    if (pluckCache.has(midi)) return pluckCache.get(midi);
    const sr = ctx.sampleRate;
    const f = midiToFreq(midi);
    const N = Math.max(2, Math.round(sr / f + 0.5));      // averaging with the next sample makes the loop half a sample SHORTER than N
    const actualF = sr / (N - 0.5);
    const T = clamp(3.4 - (midi - 40) * 0.03, 1.4, 3.4);    // seconds to fade out: longer for low notes
    const perCycle = Math.pow(10, -3 / (T * actualF));      // loop gain that gives that fade time
    const len = Math.floor(sr * T);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const ring = new Float32Array(N);
    let seed = 12345 + midi * 977;                          // same noise every time → consistent sound
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
    let prev = 0;
    for (let i = 0; i < N; i++) { prev = prev * 0.55 + rnd() * 0.45; ring[i] = prev; } // softened pick noise
    let peak = 0;
    for (let n = 0; n < len; n++) {
      const i = n % N;
      const cur = ring[i];
      out[n] = cur;
      ring[i] = perCycle * 0.5 * (cur + ring[(i + 1) % N]);
      const a = Math.abs(cur); if (a > peak) peak = a;
    }
    const norm = peak > 0 ? 0.7 / peak : 1;
    for (let n = 0; n < len; n++) out[n] *= norm;
    const entry = { buf, rate: f / actualF };
    pluckCache.set(midi, entry);
    return entry;
  }

  function guitarNote(midi, when, vel, dest = guitarBus) {
    const { buf, rate } = pluck(midi);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = vel;
    src.connect(g); g.connect(dest);
    src.start(when);
    src.onended = () => { try { g.disconnect(); } catch { /* already gone */ } };
    track(g, when + buf.duration / rate);
  }

  // ── piano ──
  let pianoWave = null;
  const getPianoWave = () => {
    if (pianoWave) return pianoWave;
    const amps = [0, 1.0, 0.62, 0.38, 0.3, 0.18, 0.15, 0.09, 0.07, 0.05, 0.04, 0.03, 0.02, 0.015, 0.01];
    pianoWave = ctx.createPeriodicWave(new Float32Array(amps.length), new Float32Array(amps));
    return pianoWave;
  };
  let hammerBuf = null;
  const getHammer = () => {
    if (hammerBuf) return hammerBuf;
    const len = Math.floor(ctx.sampleRate * 0.06);
    hammerBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = hammerBuf.getChannelData(0);
    let seed = 99;
    for (let i = 0; i < len; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = (seed / 2147483648 - 1) * Math.exp(-i / (len * 0.2)); }
    return hammerBuf;
  };

  function pianoNote(midi, when, vel, dest = pianoBus) {
    const f = midiToFreq(midi);
    const decay = clamp(5.2 - (midi - 36) * 0.045, 1.3, 5.2);   // lower notes ring longer
    const level = vel * clamp(0.5 - (midi - 60) * 0.004, 0.25, 0.62);
    const end = when + decay;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(level, when + 0.004);
    g.gain.exponentialRampToValueAtTime(level * 0.34, when + 0.28);   // quick first decay…
    g.gain.exponentialRampToValueAtTime(0.0005, end);                  // …then the long tail

    const lp = ctx.createBiquadFilter();                               // bright at the strike, mellow as it rings
    lp.type = 'lowpass'; lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(clamp(f * 9, 1500, 9000), when);
    lp.frequency.exponentialRampToValueAtTime(clamp(f * 2.6, 500, 3500), when + 0.9);

    const wave = getPianoWave();
    for (const detune of [-2.5, 2.5]) {                                // two slightly-off strings → natural shimmer
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(wave); osc.frequency.value = f; osc.detune.value = detune;
      osc.connect(lp);
      osc.start(when); osc.stop(end + 0.05);
    }
    lp.connect(g); g.connect(dest);

    const tap = ctx.createBufferSource();                              // hammer thump
    tap.buffer = getHammer();
    const tapFilter = ctx.createBiquadFilter(); tapFilter.type = 'bandpass'; tapFilter.frequency.value = clamp(f * 3, 400, 3000);
    const tapGain = ctx.createGain(); tapGain.gain.value = 0.35 * vel;
    tap.connect(tapFilter); tapFilter.connect(tapGain); tapGain.connect(dest);
    tap.start(when);

    track(g, end);
  }

  // ── public ──
  const note = (instrument, midi, when = ctx.currentTime + 0.005, vel = 0.9, dest) =>
    (instrument === 'guitar' ? guitarNote : pianoNote)(midi, when, vel, dest ?? (instrument === 'guitar' ? guitarBus : pianoBus));

  // A scale run plays through its own fader so it can be cut off cleanly:
  // starting a new run (or stopping) fades the previous one out in a few ms.
  let seq = null;
  const stopSequence = () => {
    if (!seq) return;
    const { gain } = seq; seq = null;
    const now = ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.04);
    } catch { /* already gone */ }
    setTimeout(() => { try { gain.disconnect(); } catch { /* already gone */ } }, 120);
  };
  const sequence = (instrument, midis, gapSeconds) => {
    stopSequence();
    const gain = ctx.createGain();
    gain.connect(instrument === 'guitar' ? guitarBus : pianoBus);
    seq = { gain };
    const t0 = ctx.currentTime + 0.06;   // a hair after the old run's fade-out
    midis.forEach((m, i) => note(instrument, m, t0 + i * gapSeconds, 0.9, gain));
  };

  // Strummed from the lowest note to the highest.
  const chord = (instrument, midis, when = ctx.currentTime + 0.005) => {
    const sorted = [...midis].sort((a, b) => a - b);
    const step = (STRUM_SECONDS[instrument] ?? 0.035) * strumScale;
    sorted.forEach((m, i) => note(instrument, m, when + i * step, clamp(0.92 - i * 0.04, 0.6, 0.95)));
  };

  return { note, chord, sequence, stopSequence, ctx };
}

// ── the shared engine for the app ───────────────────────────────────────

let sharedCtx = null;
let sharedEngine = null;

function getEngine() {
  if (sharedEngine) return sharedEngine;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    // iOS: let sound play even with the ringer/silent switch on.
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch { /* not supported — sound still works with the ringer on */ }
  try {
    sharedCtx = new AC({ latencyHint: 'interactive' });
    sharedEngine = createEngine(sharedCtx);
  } catch (err) {
    console.warn('[audio] could not start audio:', err);
    return null;
  }
  return sharedEngine;
}

function whenRunning(fn) {
  const engine = getEngine();
  if (!engine) return;
  if (sharedCtx.state === 'running') { fn(engine); return; }
  sharedCtx.resume().then(() => fn(engine)).catch(() => { /* needs a tap first — the unlock below handles it */ });
}

// iOS and some browsers only allow sound after a real tap. Call once; the
// first taps anywhere start the audio so it's ready (and instant) by the
// time someone taps a note.
let unlockInstalled = false;
export function installAudioUnlock() {
  if (unlockInstalled || typeof document === 'undefined') return;
  unlockInstalled = true;
  const events = ['touchend', 'pointerup', 'click', 'keydown'];
  const unlock = () => {
    const engine = getEngine();
    if (!engine) return;
    if (sharedCtx.state === 'running') { events.forEach(e => document.removeEventListener(e, unlock, true)); return; }
    sharedCtx.resume().catch(() => {});
  };
  events.forEach(e => document.addEventListener(e, unlock, true));
}

// The app's one shared AudioContext (browsers limit how many can exist, and
// iOS unlocks them per page), for other features such as the Jam drums.
export function getAudioContext() {
  return getEngine() ? sharedCtx : null;
}

export const playChord = (instrument, midis) => whenRunning(e => e.chord(instrument, midis));
export const playNote = (instrument, midi) => whenRunning(e => e.note(instrument, midi));

// Plays a list of notes one after another (e.g. the scale going up).
export const playSequence = (instrument, midis, gapSeconds = 0.44) =>
  whenRunning(e => e.sequence(instrument, midis, gapSeconds));
export const stopSequence = () => { if (sharedEngine) sharedEngine.stopSequence(); };
