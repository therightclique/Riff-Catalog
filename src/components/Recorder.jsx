import { useState, useRef, useEffect, useCallback } from 'react';

function Recorder({ onRecordingComplete }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
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
      audioCtxRef.current?.close();
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
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < bufferLength; i++) {
        const x = (i / bufferLength) * W;
        const y = (dataArray[i] / 255) * H;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    draw();
  }, []);

  const startRecording = async () => {
    try {
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
      const captureSampleRate = audioCtx.sampleRate;
      const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptNode.onaudioprocess = (e) => {
        pcmChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
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

        onRecordingComplete(blob, mediaRecorder.mimeType, { pcm, sampleRate: captureSampleRate });
        stream.getTracks().forEach(track => track.stop());
        cancelAnimationFrame(animFrameRef.current);
        scriptNode.disconnect();
        audioCtx.close();
      };

      mediaRecorder.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

      // Delay waveform draw slightly to ensure canvas is in DOM
      setTimeout(() => drawWaveform(), 100);

    } catch (err) {
      alert('Microphone access denied or unavailable.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    setRecording(false);
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={{ marginTop: '20px' }}>
      {!recording ? (
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
