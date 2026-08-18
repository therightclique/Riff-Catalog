import Meyda from 'meyda';
import * as MP4Box from 'mp4box';

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

// iOS Safari's MediaRecorder writes fragmented MP4 (multiple internal
// moov/moof/mdat sections). AudioContext.decodeAudioData() is a strict
// whole-file decoder and commonly rejects that structure with a generic
// "EncodingError: Decoding failed", even though the file is perfectly
// valid — it's why Library playback (which uses a plain <audio> element
// and the OS's native, more tolerant media pipeline) works fine while
// analysis fails. This fallback properly demuxes the fragmented MP4 with
// mp4box.js into raw AAC chunks, then decodes them with the WebCodecs
// AudioDecoder, which is built to handle streaming/fragmented input. No
// playback, no audio output, purely binary parsing.
function decodeFragmentedMp4(blob) {
  return Promise.race([
    decodeFragmentedMp4Inner(blob),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Decode timed out after 15s')), 15000)
    ),
  ]);
}

function decodeFragmentedMp4Inner(blob) {
  return new Promise((resolve, reject) => {
    const steps = [];
    const fail = (msg) => reject(new Error(msg + ' | steps: ' + steps.join(' > ')));

    if (typeof AudioDecoder === 'undefined') {
      fail('WebCodecs AudioDecoder is not available on this browser');
      return;
    }
    steps.push('AudioDecoder available');

    const mp4boxFile = MP4Box.createFile();
    const pcmChunks = [];
    let sampleRate = null;
    let numberOfChannels = null;
    let decoder = null;
    let samplesReceived = 0;
    let samplesExpected = 0;
    let decodeErrors = 0;
    let finalized = false;

    const finalize = () => {
      if (finalized) return;
      finalized = true;
      steps.push(`finalize (received ${samplesReceived}/${samplesExpected}, decodeErrors ${decodeErrors})`);
      if (!pcmChunks.length) {
        fail('No audio samples were decoded from the recording');
        return;
      }
      const totalLength = pcmChunks.reduce((sum, c) => sum + c.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of pcmChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      resolve({
        sampleRate,
        getChannelData: () => merged,
      });
    };

    mp4boxFile.onError = (err) => fail('mp4box demux error: ' + err);

    mp4boxFile.onReady = (info) => {
      steps.push('mp4box onReady');
      const audioTrack = info.tracks.find(t => t.type === 'audio' || t.audio);
      if (!audioTrack) {
        fail('No audio track found in recording (tracks: ' + info.tracks.map(t => t.type).join(',') + ')');
        return;
      }
      sampleRate = audioTrack.audio?.sample_rate || audioTrack.timescale;
      numberOfChannels = audioTrack.audio?.channel_count || 1;
      samplesExpected = audioTrack.nb_samples;
      steps.push(`track found (codec=${audioTrack.codec}, sr=${sampleRate}, ch=${numberOfChannels}, samples=${samplesExpected})`);

      let decoderConfigured = false;
      try {
        decoder = new AudioDecoder({
          output: (audioData) => {
            try {
              const numFrames = audioData.numberOfFrames;
              const channelData = new Float32Array(numFrames);
              audioData.copyTo(channelData, { planeIndex: 0 });
              pcmChunks.push(channelData);
            } finally {
              audioData.close();
            }
            samplesReceived++;
            if (samplesReceived >= samplesExpected) finalize();
          },
          error: (err) => fail('AudioDecoder error: ' + err.message),
        });

        decoder.configure({
          codec: audioTrack.codec,
          sampleRate,
          numberOfChannels,
        });
        decoderConfigured = true;
        steps.push('decoder configured');
      } catch (configErr) {
        fail('AudioDecoder configure failed: ' + configErr.message);
        return;
      }

      if (!decoderConfigured) return;

      mp4boxFile.setExtractionOptions(audioTrack.id, null, { nbSamples: 100 });
      mp4boxFile.start();
      steps.push('extraction started');
    };

    mp4boxFile.onSamples = (trackId, ref, samples) => {
      steps.push(`onSamples (${samples.length} samples)`);
      for (const sample of samples) {
        try {
          const chunk = new EncodedAudioChunk({
            type: sample.is_sync ? 'key' : 'delta',
            timestamp: (sample.cts / sample.timescale) * 1_000_000,
            duration: (sample.duration / sample.timescale) * 1_000_000,
            data: sample.data,
          });
          decoder.decode(chunk);
        } catch (decodeErr) {
          decodeErrors++;
          console.warn('Sample decode failed:', decodeErr);
        }
      }
    };

    blob.arrayBuffer().then(async (arrayBuffer) => {
      arrayBuffer.fileStart = 0;
      steps.push(`blob read (${arrayBuffer.byteLength} bytes)`);
      mp4boxFile.appendBuffer(arrayBuffer);
      mp4boxFile.flush();
      steps.push('buffer appended + flushed');

      // mp4box's flush() only forces IT to emit samples via onSamples;
      // it does not touch the AudioDecoder. WebCodecs decoders are allowed
      // to buffer decoded output internally and are only REQUIRED to emit
      // everything once AudioDecoder.flush() is called. Without this,
      // decode() can accept every chunk with zero errors while output
      // never fires — exactly the "received 0/N, decodeErrors 0" failure
      // seen on iOS Safari.
      try {
        if (decoder && decoder.state === 'configured') {
          steps.push('calling decoder.flush()');
          await decoder.flush();
          steps.push('decoder.flush() resolved');
        }
      } catch (flushErr) {
        steps.push('decoder.flush() threw: ' + flushErr.message);
      }
      finalize();
    }).catch((err) => fail('blob read failed: ' + err.message));
  });
}

export async function analyzeAudio(blob) {
  try {
    let sampleRate, channelData;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      sampleRate = audioBuffer.sampleRate;
      channelData = audioBuffer.getChannelData(0);
      await audioContext.close();
    } catch (directErr) {
      console.warn('Direct decode failed, demuxing fragmented MP4 instead:', directErr);
      const decoded = await decodeFragmentedMp4(blob);
      sampleRate = decoded.sampleRate;
      channelData = decoded.getChannelData();
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
    alert(
      'Key/BPM analysis failed.\n\n' +
      'Blob type: ' + blob.type + '\n' +
      'Blob size: ' + blob.size + ' bytes\n' +
      'Error name: ' + (err?.name || 'unknown') + '\n' +
      'Error message: ' + (err?.message || 'unknown error')
    );
    return null;
  }
}
