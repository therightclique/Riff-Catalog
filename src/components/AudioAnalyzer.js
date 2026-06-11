import Meyda from 'meyda';

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

export async function analyzeAudio(blob) {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 44100 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);
    await audioContext.close();

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
    return null;
  }
}
