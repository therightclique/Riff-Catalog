// Which microphone and which speaker the app uses.
//
// The choice is saved on THIS device only (never synced to Google Drive): the
// ids that browsers hand out for microphones and speakers are different on every
// phone, tablet and computer, so an id saved on a Mac would mean nothing on an iPhone.
//
// Choosing a microphone works wherever the browser lists more than one. Choosing a
// speaker needs the browser to allow it (Chrome and Edge do; some browsers, including
// Safari on iPhone and iPad, don't) — canChooseSpeaker() says which. When it isn't
// possible the app simply uses the device's own sound output.

const KEY_IN = 'rc_audio_in';
const KEY_OUT = 'rc_audio_out';

const read = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const write = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* remembering is optional */ } };

const listeners = new Set();
export function subscribeAudioDevices(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const changed = () => listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });

export const getSavedMic = () => read(KEY_IN);
export const getSavedSpeaker = () => read(KEY_OUT);
export function setSavedMic(id) { write(KEY_IN, id); changed(); }
export function setSavedSpeaker(id) { write(KEY_OUT, id); changed(); }

export const canListDevices = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.enumerateDevices;
export const canChooseSpeaker = () =>
  (typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype) ||
  (typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype);

// Lists what's plugged in. Browsers hide the names until the microphone has been allowed
// once, so `namesHidden` tells the screen to offer a "Show my devices" button.
export async function listDevices() {
  if (!canListDevices()) return { mics: [], speakers: [], namesHidden: false };
  let all = [];
  try { all = await navigator.mediaDevices.enumerateDevices(); } catch { return { mics: [], speakers: [], namesHidden: false }; }
  const pick = (kind) => all
    .filter(d => d.kind === kind && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
    .map((d, i) => ({ id: d.deviceId, label: d.label || '' , index: i }));
  const mics = pick('audioinput');
  const speakers = pick('audiooutput');
  const namesHidden = mics.length > 0 && mics.every(m => !m.label);
  return { mics, speakers, namesHidden };
}

// Asks for the microphone once (and lets go straight away) so the browser reveals device names.
export async function revealDeviceNames() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach(t => t.stop());
}

// The microphone options for getUserMedia. "ideal" means: use the saved one if it's
// plugged in, otherwise quietly fall back to the device's default.
export function micConstraints(base) {
  const id = getSavedMic();
  return id ? { ...base, deviceId: { ideal: id } } : base;
}

// Points an <audio> element at the chosen speaker. Never throws, never blocks playback.
export function applySpeakerToElement(el) {
  if (!el || typeof el.setSinkId !== 'function') return;
  el.setSinkId(getSavedSpeaker()).catch(() => { /* speaker gone or not allowed — keep the default */ });
}

// Same for an AudioContext (the app's drums, chords and count-in all play through one).
export function applySpeakerToContext(ctx) {
  if (!ctx || typeof ctx.setSinkId !== 'function') return;
  try {
    const p = ctx.setSinkId(getSavedSpeaker());
    if (p && p.catch) p.catch(() => { /* keep the default */ });
  } catch { /* keep the default */ }
}

// Friendly text for a device that has no name yet.
export const deviceName = (d, kind) => d.label || `${kind} ${d.index + 1}`;
