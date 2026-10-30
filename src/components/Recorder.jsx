import { useState, useRef, useEffect, useCallback } from 'react';
import { createDrumMachine, makeMetronomeBeat } from './DrumMachine';
import { TapTempoButton } from './TapTempo';

// Record-tab metronome: an audible count-in, then a silent pulse (circles only)
// while recording, so no click ever reaches the microphone.
const clampBpm = (v) => Math.min(220, Math.max(40, Math.round(Number(v) || 100)));
const loadMetro = () => {
  try {
    const s = JSON.parse(localStorage.getItem('rc_rec_metro') || '{}');
    return { on: !!s.on, bpm: clampBpm(s.bpm || 100), beats: Math.min(7, Math.max(2, parseInt(s.beats) || 4)), bars: s.bars === 2 ? 2 : 1 };
  } catch { return { on: false, bpm: 100, beats: 4, bars: 1 }; }
};

function Recorder({ onRecordingComplete, onRecordingStateChange }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [metro, setMetro] = useState(loadMetro);          // { on, bpm, beats, bars (of count-in) }
  const [phase, setPhase] = useState('idle');             // 'idle' | 'counting' | 'recording'
  const [pos, setPos] = useState(null);                   // metronome position while counting/recording
  const machineRef = useRef(null);
  const posRaf = useRef(null);
  const beginTimer = useRef(null);
  const cancelRef = useRef(null);
  const savedSession = useRef(undefined);
  useEffect(() => {
    try { localStorage.setItem('rc_rec_metro', JSON.stringify(metro)); } catch { /* remembering is optional */ }
  }, [metro]);
  const setM = (patch) => setMetro(m => ({ ...m, ...patch }));

  // Lets App know a take is in progress, so the global refresh button can
  // warn before throwing it away. Driven off the single `recording` flag
  // rather than called from start/stop separately, so it can't drift out
  // of sync with what's actually on screen.
  useEffect(() => {
    onRecordingStateChange?.(recording);
  }, [recording]);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      clearInterval(timerRef.current);
      clearTimeout(beginTimer.current);
      cancelAnimationFrame(posRaf.current);
      machineRef.current?.stop();
      audioCtxRef.current?.close();
      onRecordingStateChange?.(false);
    };
  }, []);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, W, H);

      // Center line
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      // Waveform
      ctx.strokeStyle = '#cc0000';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      // getByteTimeDomainData centers silence at 128. Convert to a
      // -1..1 deviation, amplify it, then clamp so loud peaks stay on
      // canvas. Without the gain, normal singing/playing barely moves
      // off the center line.
      const GAIN = 6;
      const half = H / 2;
      for (let i = 0; i < bufferLength; i++) {
        const x = (i / bufferLength) * W;
        const deviation = (dataArray[i] - 128) / 128;
        let y = half - deviation * GAIN * half;
        if (y < 2) y = 2;
        if (y > H - 2) y = H - 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    draw();
  }, []);

  const endMetronome = () => {
    cancelAnimationFrame(posRaf.current);
    machineRef.current?.stop();
    machineRef.current = null;
    cancelRef.current = null;
    setPos(null);
    try {
      if (savedSession.current !== undefined && navigator.audioSession) navigator.audioSession.type = savedSession.current;
    } catch { /* not supported */ }
    savedSession.current = undefined;
  };

  const startRecording = async () => {
    const usedMetro = metro.on;
    try {
      if (usedMetro && navigator.audioSession) {
        // iOS: the count-in has to be heard while the microphone is open.
        try { savedSession.current = navigator.audioSession.type; navigator.audioSession.type = 'play-and-record'; } catch { /* not supported */ }
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        }
      });

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Capture raw PCM during recording so key/BPM analysis never needs
      // to decode the compressed file afterward. This sidesteps platform
      // decoder bugs entirely (iOS Safari cannot reliably decode its own
      // MediaRecorder fragmented-MP4 output via decodeAudioData or
      // WebCodecs AudioDecoder as of iOS 27).
      const pcmChunks = [];
      let capturing = !metro.on;             // with a count-in, capture begins when the take does
      const captureSampleRate = audioCtx.sampleRate;
      const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptNode.onaudioprocess = (e) => {
        if (capturing) pcmChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(scriptNode);
      // ScriptProcessor must be connected to destination to fire on some
      // browsers; route through a zero-gain node so nothing is audible.
      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0;
      scriptNode.connect(muteGain);
      muteGain.connect(audioCtx.destination);

      // Explicitly pick a MIME type MediaRecorder can produce AND
      // AudioContext.decodeAudioData can reliably decode. Leaving this
      // unspecified lets the browser choose its own default, which on
      // some iOS versions produces a container decodeAudioData can't
      // read, causing "Decoding failed" after recording.
      const preferredTypes = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/aac',
        'audio/ogg;codecs=opus',
      ];
      const supportedType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t));

      const mediaRecorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });

        // Merge captured PCM into one Float32Array
        const totalLen = pcmChunks.reduce((s, c) => s + c.length, 0);
        const pcm = new Float32Array(totalLen);
        let off = 0;
        for (const c of pcmChunks) { pcm.set(c, off); off += c.length; }

        onRecordingComplete(blob, mediaRecorder.mimeType, { pcm, sampleRate: captureSampleRate, tempo: usedMetro ? metro.bpm : null });
        stream.getTracks().forEach(track => track.stop());
        cancelAnimationFrame(animFrameRef.current);
        scriptNode.disconnect();
        endMetronome();
        audioCtx.close();
      };

      const beginTake = () => {
        capturing = true;
        mediaRecorder.start();
        setRecording(true);
        setPhase('recording');
        setDuration(0);
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        // Delay waveform draw slightly to ensure canvas is in DOM
        setTimeout(() => drawWaveform(), 100);
      };

      if (!usedMetro) {
        beginTake();
      } else {
        // Audible count-in on the capture context, then a silent pulse. The count-in's
        // last click lands one beat before the take starts; the take's downbeat is silent.
        if (audioCtx.state !== 'running') await audioCtx.resume().catch(() => {});
        const machine = createDrumMachine(audioCtx);
        machineRef.current = machine;
        machine.setBpm(metro.bpm);
        machine.setBeat(makeMetronomeBeat(metro.beats));
        const beatSec = 60 / metro.bpm;
        const t0 = audioCtx.currentTime + 0.3;
        const takeStart = t0 + metro.bars * metro.beats * beatSec;
        machine.muteFrom(takeStart);
        machine.startAt(t0);
        setPhase('counting');
        setPos(null);
        let last = -1;
        const poll = () => {
          const p = machine.getPosition();
          const b = p ? p.beat : -1;
          if (b !== last) { last = b; setPos(p); }
          posRaf.current = requestAnimationFrame(poll);
        };
        posRaf.current = requestAnimationFrame(poll);
        beginTimer.current = setTimeout(beginTake, Math.max(0, (takeStart - audioCtx.currentTime) * 1000));
        // Cancel during the count-in: throw everything away, nothing is saved.
        cancelRef.current = () => {
          clearTimeout(beginTimer.current);
          endMetronome();
          stream.getTracks().forEach(track => track.stop());
          scriptNode.disconnect();
          audioCtx.close();
          setPhase('idle');
        };
      }

    } catch (err) {
      endMetronome();
      setPhase('idle');
      alert('Microphone access denied or unavailable.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    setRecording(false);
    setPhase('idle');
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // The row of circles: one per beat in the bar, the current beat lit; beat 1 is orange.
  const beatDots = (silent) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ display: 'flex', gap: '12px' }} aria-label="Beat">
        {Array.from({ length: metro.beats }, (_, i) => {
          const lit = pos && pos.beat === i;
          return (
            <div key={i} style={{
              width: '34px', height: '34px', borderRadius: '50%',
              backgroundColor: lit ? (i === 0 ? '#e07a10' : '#1a73e8') : '#d9d9d9',
              transform: lit ? 'scale(1.2)' : 'none', transition: 'background-color 60ms, transform 60ms',
            }} />
          );
        })}
      </div>
      <div style={{ fontSize: '11px', color: '#888' }}>{silent ? 'Silent metronome · orange = beat 1' : `${metro.bpm} BPM · orange = beat 1`}</div>
    </div>
  );

  const stepBtn = (label, delta) => (
    <button onClick={() => setM({ bpm: clampBpm(metro.bpm + delta) })} aria-label={`${delta > 0 ? 'Faster' : 'Slower'} by ${Math.abs(delta)}`}
      style={{ width: '44px', height: '38px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#222', fontSize: '14px', fontWeight: '600', cursor: 'pointer', touchAction: 'manipulation' }}>
      {label}
    </button>
  );
  const chip = (active, label, onClick, key) => (
    <button key={key} onClick={onClick} aria-pressed={active}
      style={{ minWidth: '40px', height: '36px', padding: '0 10px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
        border: `2px solid ${active ? '#1a73e8' : '#ddd'}`, backgroundColor: active ? '#e8f0fe' : '#fff', color: '#222' }}>
      {label}
    </button>
  );

  return (
    <div style={{ marginTop: '20px' }}>
      {phase === 'counting' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#cc0000' }}>Count-in…</div>
          {beatDots(false)}
          <button onClick={() => cancelRef.current?.()}
            style={{ padding: '10px 24px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      ) : !recording ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
          <div style={{ width: '100%', maxWidth: '340px', padding: '10px 14px', backgroundColor: '#f9f9f9', borderRadius: '10px', color: '#222', textAlign: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
              <input type="checkbox" checked={metro.on} onChange={e => setM({ on: e.target.checked })} />
              ⏱ Metronome &amp; count-in
            </label>
            {metro.on && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '30px', fontWeight: '800', lineHeight: 1.1 }}>
                  {metro.bpm}<span style={{ fontSize: '13px', fontWeight: '600', color: '#666', marginLeft: '6px' }}>BPM</span>
                </div>
                <input type="range" min="40" max="220" step="1" value={metro.bpm} onChange={e => setM({ bpm: clampBpm(e.target.value) })}
                  aria-label="Metronome tempo" style={{ width: '100%', margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {stepBtn('−5', -5)}{stepBtn('−1', -1)}{stepBtn('+1', 1)}{stepBtn('+5', 5)}
                  <TapTempoButton min={40} max={220} onBpm={bpm => setM({ bpm })} style={{ height: '38px', padding: '0 12px' }} />
                </div>
                <div style={{ fontSize: '12px', color: '#666', margin: '12px 0 6px' }}>Beats per bar</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {[2, 3, 4, 5, 6, 7].map(n => chip(metro.beats === n, n, () => setM({ beats: n }), n))}
                </div>
                <div style={{ fontSize: '12px', color: '#666', margin: '12px 0 6px' }}>Count-in</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                  {chip(metro.bars === 1, '1 bar', () => setM({ bars: 1 }), 'b1')}
                  {chip(metro.bars === 2, '2 bars', () => setM({ bars: 2 }), 'b2')}
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '10px', lineHeight: 1.4 }}>
                  You&rsquo;ll hear the count-in, then the click goes silent and the circles keep time while you record. The tempo is saved with the clip.
                </div>
              </div>
            )}
          </div>
          <button
            onClick={startRecording}
            style={{
              width: '80px', height: '80px', borderRadius: '50%',
              backgroundColor: '#cc0000', color: 'white',
              fontSize: '24px', border: 'none', cursor: 'pointer'
            }}
          >
            ●
          </button>
        </div>
      ) : (
        <div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <canvas
            ref={canvasRef}
            width={300}
            height={80}
            style={{
              display: 'block',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '300px',
              border: '1px solid #333',
            }}
          />
          {machineRef.current && beatDots(true)}
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#cc0000' }}>
            ● {formatDuration(duration)}
          </span>
          <button
            onClick={stopRecording}
            style={{
              padding: '10px 24px', backgroundColor: '#333',
              color: 'white', border: 'none', borderRadius: '6px',
              fontSize: '16px', cursor: 'pointer'
            }}
          >
            Stop
          </button>
        </div>
        </div>
      )}
    </div>
  );
}

export default Recorder;
