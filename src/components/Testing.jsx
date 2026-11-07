// Testing section — only people the owner has assigned (and the owner) can open it.
//
// Everything here is deliberately SELF-CONTAINED: it does not import or touch the
// recorder, the audio engine, the library or any saved setting of the main app. A
// feature is tried here first, on real phones, and only moved into the main app once it
// has proven itself. If something in this page fails, the rest of the app is unaffected.
//
// Experiment 1: choosing which microphone to record with. Speaker choice is left out on
// purpose (it is the part most likely to upset an iPhone's audio).
import { useState, useRef, useEffect, useCallback } from 'react';

const KEY = 'rc_test_mic';   // this page's own setting; the main app never reads it
const card = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '16px', marginBottom: '16px', textAlign: 'left' };
const h = { margin: '0 0 6px', fontSize: '16px', color: '#222' };
const sub = { margin: '0 0 12px', fontSize: '13px', color: '#555', lineHeight: 1.45 };
const btn = { padding: '10px 16px', borderRadius: '8px', border: '1px solid #1a73e8', background: '#1a73e8', color: '#fff', fontSize: '14px', cursor: 'pointer', marginRight: '8px', marginBottom: '8px' };
const btnGhost = { ...btn, background: '#fff', color: '#1a73e8' };

const read = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
const write = (v) => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch { /* optional */ } };
// What went wrong, in words a tester can paste back to the owner.
const why = (e) => `${e?.name || 'Error'}${e?.message ? ': ' + e.message : ''}`;

export default function Testing() {
  const [mics, setMics] = useState([]);
  const [chosen, setChosen] = useState(read);
  const [names, setNames] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [level, setLevel] = useState(0);
  const [clip, setClip] = useState(null);       // { url, used, type, ms }
  const [busy, setBusy] = useState(false);
  const live = useRef(null);                    // everything to clean up if the page closes mid-test

  const canList = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.enumerateDevices;

  const refresh = useCallback(async () => {
    if (!canList) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const list = all.filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
      setMics(list.map((d, i) => ({ id: d.deviceId, label: d.label || `Microphone ${i + 1}` })));
      setNames(list.length === 0 || list.some(d => d.label));
    } catch (e) { setError('Could not list microphones — ' + why(e)); }
  }, [canList]);

  useEffect(() => {
    refresh();
    const md = navigator.mediaDevices;
    if (md?.addEventListener) { md.addEventListener('devicechange', refresh); }
    return () => { if (md?.removeEventListener) md.removeEventListener('devicechange', refresh); };
  }, [refresh]);

  const stopAll = useCallback(() => {
    const l = live.current; live.current = null;
    if (!l) return;
    try { clearInterval(l.timer); clearTimeout(l.stopper); } catch { /* ignore */ }
    try { l.stream?.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
    try { l.ctx?.close(); } catch { /* ignore */ }
  }, []);
  useEffect(() => stopAll, [stopAll]);
  useEffect(() => () => { if (clip?.url) URL.revokeObjectURL(clip.url); }, [clip]);

  // Browsers hide microphone names until the microphone has been allowed once.
  const showMics = async () => {
    setError(''); setStatus('Asking the browser for the microphone…');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
      await refresh(); setStatus('Microphones found.');
    } catch (e) { setStatus(''); setError('Microphone not allowed — ' + why(e)); }
  };

  const pick = (id) => { setChosen(id); write(id); };

  // Same microphone settings the main recorder uses, plus the chosen device (if it is plugged in).
  const test = async () => {
    setError(''); setStatus('Starting…'); setBusy(true); setLevel(0);
    setClip(null);
    stopAll();
    try {
      const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };
      if (chosen) audio.deviceId = { ideal: chosen };
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      const track = stream.getAudioTracks()[0];
      const used = track?.label || '(unnamed microphone)';
      await refresh();

      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const an = ctx.createAnalyser(); an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const timer = setInterval(() => {
        an.getByteTimeDomainData(buf);
        let peak = 0; for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
        setLevel(Math.min(1, peak / 100));
      }, 60);

      const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac', 'audio/ogg;codecs=opus'];
      const type = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
      const rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
      const chunks = []; const t0 = Date.now();
      rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      rec.onerror = (e) => { setError('Recorder error — ' + why(e.error)); };
      rec.onstop = () => {
        const ms = Date.now() - t0;
        stopAll();
        setLevel(0); setBusy(false);
        if (!chunks.length) { setStatus(''); setError('Nothing was recorded.'); return; }
        const blob = new Blob(chunks, { type: rec.mimeType || type || 'audio/mp4' });
        setClip({ url: URL.createObjectURL(blob), used, type: blob.type, ms });
        setStatus('Done. Press play to hear it.');
      };
      const stopper = setTimeout(() => { try { if (rec.state !== 'inactive') rec.stop(); } catch { /* ignore */ } }, 3000);
      live.current = { stream, ctx, timer, stopper };
      rec.start();
      setStatus(`Recording for 3 seconds with: ${used}. Make some noise!`);
    } catch (e) {
      stopAll(); setBusy(false); setLevel(0); setStatus('');
      setError('The test failed — ' + why(e));
    }
  };

  const note = !canList
    ? 'This browser cannot list microphones, so there is nothing to choose here.'
    : mics.length === 0
      ? 'No microphones listed yet. Press “Show my microphones”.'
      : mics.length === 1 ? 'Only one microphone is available on this device.' : '';

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      <div style={card}>
        <h3 style={h}>🧪 Welcome to Testing</h3>
        <p style={{ ...sub, margin: 0 }}>
          New features are tried here first, away from the rest of the app, before they are added to it. Nothing on this
          page changes your recordings, your library or your settings. If something goes wrong, the message shown is
          exactly what the owner needs — please send it with a note about what you were using.
        </p>
      </div>

      <div style={card}>
        <h3 style={h}>Experiment 1 — Choose your microphone</h3>
        <p style={sub}>
          Pick which microphone to record with, then make a 3-second test recording and play it back. Speakers are not part of
          this experiment. Please also report what happens if you plug in or unplug a headset while this page is open.
        </p>

        <button style={btnGhost} onClick={showMics} disabled={busy || !canList}>Show my microphones</button>
        {!names && <p style={{ ...sub, color: '#b45309' }}>The names are hidden until the microphone is allowed — press the button above.</p>}

        <label style={{ display: 'block', fontSize: '13px', color: '#333', margin: '4px 0 6px' }} htmlFor="rc-test-mic">Microphone</label>
        <select id="rc-test-mic" value={mics.some(m => m.id === chosen) ? chosen : ''} onChange={e => pick(e.target.value)}
          disabled={busy || mics.length === 0} style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '12px' }}>
          <option value="">Device default</option>
          {mics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        {note && <p style={sub}>{note}</p>}
        {chosen && !mics.some(m => m.id === chosen) && mics.length > 0 && (
          <p style={sub}>Your saved microphone isn’t connected right now, so the device default is used.</p>
        )}

        <button style={btn} onClick={test} disabled={busy}>{busy ? 'Recording…' : 'Record a 3-second test'}</button>

        <div aria-label="Microphone level" style={{ height: '10px', background: '#eee', borderRadius: '5px', overflow: 'hidden', margin: '4px 0 10px' }}>
          <div style={{ height: '100%', width: `${Math.round(level * 100)}%`, background: '#34a853', transition: 'width 60ms linear' }} />
        </div>

        {status && <p style={{ ...sub, color: '#222' }} role="status">{status}</p>}
        {error && <p style={{ ...sub, color: '#b00020', fontWeight: 600 }} role="alert">{error}</p>}

        {clip && (
          <div>
            <audio controls src={clip.url} style={{ width: '100%' }} />
            <p style={{ ...sub, marginTop: '8px' }}>
              Recorded with: <strong>{clip.used}</strong><br />
              Length {(clip.ms / 1000).toFixed(1)} s · format {clip.type || 'unknown'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
