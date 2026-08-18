import Meyda from 'meyda';
import * as MP4Box from 'mp4box';

// iOS Safari's MediaRecorder writes fragmented MP4. Neither
// AudioContext.decodeAudioData nor the WASM AAC decoder can read that
// container directly. mp4box can, so we demux the raw AAC frames out of
// it and re-wrap each one in a 7-byte ADTS header, producing a plain AAC
// stream the WASM decoder handles. No playback, no platform decoder.

function parseAudioSpecificConfig(asc) {
  const b0 = asc[0], b1 = asc[1];
  return {
    objectType: (b0 >> 3) & 0x1F,
    freqIndex: ((b0 & 0x07) << 1) | ((b1 >> 7) & 0x01),
    channelConfig: (b1 >> 3) & 0x0F,
  };
}

function adtsHeader(payloadLength, { objectType, freqIndex, channelConfig }) {
  const frameLength = payloadLength + 7;
  const h = new Uint8Array(7);
  h[0] = 0xFF;
  h[1] = 0xF1; // MPEG-4, layer 0, no CRC
  h[2] = ((objectType - 1) << 6) | (freqIndex << 2) | ((channelConfig >> 2) & 0x01);
  h[3] = ((channelConfig & 0x03) << 6) | ((frameLength >> 11) & 0x03);
  h[4] = (frameLength >> 3) & 0xFF;
  h[5] = ((frameLength & 0x07) << 5) | 0x1F;
  h[6] = 0xFC;
  return h;
}

function demuxMp4ToAdts(arrayBuffer) {
  const file = MP4Box.createFile();
  const parts = [];
  let cfg = null;
  let trackId = null;
  let demuxError = null;

  file.onError = (e) => { demuxError = new Error('mp4box: ' + e); };

  file.onReady = (info) => {
    const track = info.tracks.find(t => t.type === 'audio' || t.audio);
    if (!track) { demuxError = new Error('No audio track in file'); return; }
    trackId = track.id;
    const trak = file.getTrackById(track.id);
    const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
    const dsi = entry?.esds?.esd?.descs
      ?.find(d => d.tag === 0x04)?.descs
      ?.find(d => d.tag === 0x05);
    if (!dsi?.data || dsi.data.length < 2) {
      demuxError = new Error('No AudioSpecificConfig found in file');
      return;
    }
    cfg = parseAudioSpecificConfig(dsi.data);
    file.setExtractionOptions(track.id, null, { nbSamples: 1000 });
    file.start();
  };

  file.onSamples = (id, ref, samples) => {
    if (!cfg) return;
    for (const s of samples) {
      const d = s.data instanceof Uint8Array ? s.data : new Uint8Array(s.data);
      parts.push(adtsHeader(d.length, cfg), d);
    }
  };

  const ab = arrayBuffer.slice(0);
  ab.fileStart = 0;
  file.appendBuffer(ab);
  file.flush();

  // If extraction was armed inside onReady after the buffer had already
  // been parsed, feed it once more so onSamples runs over the data.
  if (parts.length === 0 && cfg && trackId !== null && !demuxError) {
    const ab2 = arrayBuffer.slice(0);
    ab2.fileStart = 0;
    file.appendBuffer(ab2);
    file.flush();
  }

  if (demuxError) throw demuxError;
  if (parts.length === 0) throw new Error('mp4box extracted no audio frames');

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const adts = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { adts.set(p, offset); offset += p.length; }
  return adts;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const RELATIVE_MAP = {
  'C Major': 'A Minor', 'C# Major': 'A# Minor', 'D Major': 'B Minor',
  'D# Major': 'C Minor', 'E Major': 'C# Minor', 'F Major': 'D Minor',
  'F# Major': 'D# Minor', 'G Major': 'E Minor', 'G# Major': 'F Minor',
  'A Major': 'F# Minor', 'A# Major': 'G Minor', 'B Major': 'G# Minor',
  'A Minor': 'C Major', 'A# Minor': 'C# Major', 'B Minor': 'D Major',
  'C Minor': 'D# Major', 'C# Minor': 'E Major', 'D Minor': 'F Major',
  'D# Minor': 'F# Major', 'E Minor': 'G Major', 'F Minor': 'G# Major',
  'F# Minor': 'A Major', 'G Minor': 'A# Major', 'G# Minor': 'B Major',
};

function scoreAllKeys(chroma) {
  const chromaMean = chroma.reduce((a, b) => a + b) / 12;
  const majorMean = MAJOR_PROFILE.reduce((a, b) => a + b) / 12;
  const minorMean = MINOR_PROFILE.reduce((a, b) => a + b) / 12;
  const scores = [];

  for (let root = 0; root < 12; root++) {
    let majorScore = 0;
    let minorScore = 0;
    for (let i = 0; i < 12; i++) {
      const noteIdx = (i + root) % 12;
      majorScore += (chroma[noteIdx] - chromaMean) * (MAJOR_PROFILE[i] - majorMean);
      minorScore += (chroma[noteIdx] - chromaMean) * (MINOR_PROFILE[i] - minorMean);
    }
    scores.push({ key: `${NOTES[root]} Major`, score: majorScore });
    scores.push({ key: `${NOTES[root]} Minor`, score: minorScore });
  }

  const maxScore = Math.max(...scores.map(s => s.score));
  const minScore = Math.min(...scores.map(s => s.score));
  scores.forEach(s => {
    s.confidence = Math.round(((s.score - minScore) / (maxScore - minScore)) * 100);
  });

  return scores.sort((a, b) => b.score - a.score);
}

function getChromaFromBuffer(channelData, sampleRate, bufferSize = 4096) {
  const accumChroma = new Array(12).fill(0);
  let frameCount = 0;

  for (let offset = 0; offset + bufferSize <= channelData.length; offset += bufferSize) {
    const frame = Array.from(channelData.slice(offset, offset + bufferSize));
    try {
      const features = Meyda.extract(['chroma'], frame, { sampleRate, bufferSize });
      if (features?.chroma) {
        for (let i = 0; i < 12; i++) accumChroma[i] += features.chroma[i];
        frameCount++;
      }
    } catch (e) {}
  }

  if (frameCount > 0) {
    for (let i = 0; i < 12; i++) accumChroma[i] /= frameCount;
  }
  return accumChroma;
}

function detectBPM(channelData, sampleRate) {
  const hopSize = 512;
  const frameSize = 2048;
  const energies = [];

  for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) energy += channelData[i + j] ** 2;
    energies.push(energy / frameSize);
  }

  const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
  const threshold = mean * 1.5;
  const onsets = [];

  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > threshold && energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
      onsets.push(i * hopSize / sampleRate);
    }
  }

  if (onsets.length < 2) return 0;
  const intervals = [];
  for (let i = 1; i < onsets.length; i++) intervals.push(onsets[i] - onsets[i - 1]);
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  if (median <= 0) return 0;

  let bpm = Math.round(60 / median);
  while (bpm > 200) bpm = Math.round(bpm / 2);
  while (bpm < 60 && bpm > 0) bpm = Math.round(bpm * 2);
  return bpm;
}

function ensureRelativeKeyPresent(candidates) {
  if (!candidates || candidates.length === 0) return candidates;
  const topKey = candidates[0].key;
  const relativeKey = RELATIVE_MAP[topKey];
  if (!relativeKey) return candidates;

  const alreadyPresent = candidates.some(c => c.key === relativeKey);
  if (alreadyPresent) return candidates;

  // Insert relative key at position 1 with a label
  const relativeEntry = {
    key: relativeKey,
    confidence: candidates[0].confidence,
    score: 0,
    isRelative: true,
  };
  return [candidates[0], relativeEntry, ...candidates.slice(1)];
}

// iOS Safari cannot decode its own MediaRecorder output (fragmented MP4)
// via AudioContext.decodeAudioData or the WebCodecs AudioDecoder — both
// silently fail on files that are perfectly valid and play back fine.
// The fallback below uses a self-contained WASM AAC decoder, which parses
// and decodes the file entirely in JavaScript/WASM with no dependency on
// the platform's media stack. Loaded lazily so it only downloads when a
// clip actually needs decoding.
export async function analyzeAudio(blob, capturedPcm = null) {
  try {
    let sampleRate, channelData;
    if (capturedPcm?.pcm?.length > 0 && capturedPcm.sampleRate) {
      // PCM captured live during recording — no decoding needed at all.
      sampleRate = capturedPcm.sampleRate;
      channelData = capturedPcm.pcm;
    } else {
      const arrayBuffer = await blob.arrayBuffer();
      try {
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        sampleRate = audioBuffer.sampleRate;
        channelData = audioBuffer.getChannelData(0);
        await audioContext.close();
      } catch (directErr) {
        console.warn('Native decode failed, using WASM AAC decoder:', directErr);
        const { default: decodeAAC } = await import('@audio/decode-aac');

        // Try the file as-is first (works for plain, non-fragmented AAC),
        // then fall back to demuxing the MP4 container into an ADTS stream.
        let decoded = null;
        try {
          decoded = await decodeAAC(new Uint8Array(arrayBuffer.slice(0)));
        } catch (rawErr) {
          console.warn('Direct AAC decode threw, will demux:', rawErr);
        }

        if (!decoded?.channelData?.[0]?.length) {
          console.warn('Direct AAC decode produced no samples, demuxing MP4 to ADTS');
          const adts = demuxMp4ToAdts(arrayBuffer);
          console.log(`Demuxed ${adts.length} bytes of ADTS from container`);
          decoded = await decodeAAC(adts);
        }

        sampleRate = decoded.sampleRate;
        channelData = decoded.channelData?.[0];
        if (!channelData?.length) {
          throw new Error('AAC decoder returned no samples after demuxing');
        }
        console.log(`Decoded ${channelData.length} samples at ${sampleRate}Hz`);
      }
    }

    // Analyze first 2 seconds for opening bias
    const firstTwoSecs = Math.min(sampleRate * 2, channelData.length);
    const openingChroma = getChromaFromBuffer(channelData.slice(0, firstTwoSecs), sampleRate);
    const openingScores = scoreAllKeys(openingChroma);

    // Analyze full recording
    const fullChroma = getChromaFromBuffer(channelData, sampleRate);
    const fullScores = scoreAllKeys(fullChroma);

    // Blend: 60% opening bias, 40% full recording
    const blendedScores = fullScores.map(fullEntry => {
      const openingEntry = openingScores.find(o => o.key === fullEntry.key);
      const blendedScore = (openingEntry?.score || 0) * 0.6 + fullEntry.score * 0.4;
      return { key: fullEntry.key, score: blendedScore };
    });

    const maxScore = Math.max(...blendedScores.map(s => s.score));
    const minScore = Math.min(...blendedScores.map(s => s.score));
    blendedScores.forEach(s => {
      s.confidence = Math.round(((s.score - minScore) / (maxScore - minScore)) * 100);
    });
    blendedScores.sort((a, b) => b.score - a.score);

    let candidates = blendedScores.slice(0, 8);
    candidates = ensureRelativeKeyPresent(candidates);

    const bpm = detectBPM(channelData, sampleRate);

    return {
      key: candidates[0].key,
      candidates,
      bpm,
      keyConfidence: candidates[0].confidence,
    };
  } catch (err) {
    console.error('Audio analysis failed:', err);
    throw err;
  }
}
