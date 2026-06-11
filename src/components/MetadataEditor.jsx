import { useState } from 'react';

const ALL_KEYS = [
  'A Major', 'A# Major', 'B Major', 'C Major', 'C# Major', 'D Major',
  'D# Major', 'E Major', 'F Major', 'F# Major', 'G Major', 'G# Major',
  'A Minor', 'A# Minor', 'B Minor', 'C Minor', 'C# Minor', 'D Minor',
  'D# Minor', 'E Minor', 'F Minor', 'F# Minor', 'G Minor', 'G# Minor',
];

const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '5/4', '7/8', '12/8', 'Other'];
const QUALITY_FLAGS = ['Keeper', 'Rough idea', 'Needs work'];
const INSTRUMENTS = ['Guitar', 'Bass', 'Drums', 'Speech', 'Singing', 'Keyboard/Piano', 'Combination', 'Other'];
const TUNINGS = ['E Standard', 'Half-Step Down', 'Drop D', 'D Standard', 'Drop C#', 'Open G', 'Open E', 'DADGAD', 'Other'];
const GENRES = [
  'Alternative', 'Ambient', 'Bluegrass', 'Blues', 'Classical', 'Country',
  'Electronic', 'Folk', 'Funk', 'Gospel', 'Hip-Hop', 'Indie', 'Jazz',
  'Metal', 'Pop', 'Punk', 'R&B / Soul', 'Reggae', 'Rock', 'Singer-Songwriter',
  'World', 'Other',
];
const MOODS = [
  'Aggressive', 'Chill', 'Dark', 'Dreamy', 'Energetic', 'Happy',
  'Hopeful', 'Melancholy', 'Mysterious', 'Nostalgic', 'Peaceful',
  'Romantic', 'Sad', 'Tense', 'Uplifting',
];

function abbr(key) {
  if (!key) return key;
  return key.replace('Major', 'Maj').replace('Minor', 'Min');
}

const fieldStyle = { marginBottom: '12px' };
const labelStyle = {
  display: 'block', fontSize: '12px', fontWeight: '600', color: '#555',
  marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const inputStyle = {
  width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd',
  borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#222222',
};
const selectStyle = { ...inputStyle };

function MetadataEditor({ metadata, onChange, onAnalyze, analyzing, keyCandidates }) {
  const [tagInput, setTagInput] = useState('');
  const [moodInput, setMoodInput] = useState('');

  const update = (field, value) => onChange({ ...metadata, [field]: value });

  const addTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      const existing = metadata.tags || [];
      if (!existing.includes(tagInput.trim())) update('tags', [...existing, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tag) => update('tags', (metadata.tags || []).filter(t => t !== tag));

  const toggleMood = (mood) => {
    const existing = metadata.moods || [];
    const updated = existing.includes(mood) ? existing.filter(m => m !== mood) : [...existing, mood];
    update('moods', updated);
  };

  const candidateKeys = (keyCandidates || []).map(c => c.key);
  const remainingKeys = ALL_KEYS.filter(k => !candidateKeys.includes(k));

  return (
    <div style={{ padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px', marginTop: '8px' }}>

      {/* Key */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Musical Key</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select style={{ ...selectStyle, flex: 1 }} value={metadata.key || ''} onChange={e => update('key', e.target.value)}>
            <option value="">— Unknown —</option>
            {keyCandidates && keyCandidates.length > 0 && (
              <optgroup label="Suggested">
                {keyCandidates.map(c => (
                  <option key={c.key} value={c.key}>{abbr(c.key)}{c.isRelative ? ' ↔' : ''} — {c.confidence}%</option>
                ))}
              </optgroup>
            )}
            <optgroup label={keyCandidates?.length > 0 ? 'All other keys — Major' : 'Major Keys'}>
              {(keyCandidates?.length > 0 ? remainingKeys.filter(k => k.includes('Major')) : ALL_KEYS.filter(k => k.includes('Major')))
                .map(k => <option key={k} value={k}>{abbr(k)}</option>)}
            </optgroup>
            <optgroup label={keyCandidates?.length > 0 ? 'All other keys — Minor' : 'Minor Keys'}>
              {(keyCandidates?.length > 0 ? remainingKeys.filter(k => k.includes('Minor')) : ALL_KEYS.filter(k => k.includes('Minor')))
                .map(k => <option key={k} value={k}>{abbr(k)}</option>)}
            </optgroup>
          </select>
          {onAnalyze && (
            <button onClick={onAnalyze} disabled={analyzing}
              style={{ padding: '6px 12px', backgroundColor: '#1a73e8', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                whiteSpace: 'nowrap', flexShrink: 0 }}>
              {analyzing ? '🔍...' : '🔍 Analyze'}
            </button>
          )}
        </div>
      </div>

      {/* BPM + Time Signature */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Tempo (BPM)</label>
          <input style={inputStyle} type="number" min="40" max="300"
            value={metadata.bpm || ''} onChange={e => update('bpm', e.target.value)} placeholder="e.g. 120" />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Time Signature</label>
          <select style={selectStyle} value={metadata.timeSignature || ''} onChange={e => update('timeSignature', e.target.value)}>
            <option value="">— Unknown —</option>
            {TIME_SIGNATURES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Instrument + Tuning */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Instrument</label>
          <select style={selectStyle} value={metadata.instrument || ''} onChange={e => update('instrument', e.target.value)}>
            <option value="">— Unknown —</option>
            {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Tuning</label>
          <select style={selectStyle} value={metadata.tuning || ''} onChange={e => update('tuning', e.target.value)}>
            <option value="">— Unknown —</option>
            {TUNINGS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Genre + Capo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Genre</label>
          <select style={selectStyle} value={metadata.genre || ''} onChange={e => update('genre', e.target.value)}>
            <option value="">— Unknown —</option>
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Capo</label>
          <select style={selectStyle} value={metadata.capo ?? ''} onChange={e => update('capo', e.target.value)}>
            <option value="">— None —</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>Fret {n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Quality */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Quality</label>
        <select style={selectStyle} value={metadata.quality || ''} onChange={e => update('quality', e.target.value)}>
          <option value="">— Unrated —</option>
          {QUALITY_FLAGS.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
      </div>

      {/* Needs Lyrics */}
      <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          type="checkbox"
          id="needsLyrics"
          checked={metadata.needsLyrics || false}
          onChange={e => update('needsLyrics', e.target.checked)}
          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
        />
        <label htmlFor="needsLyrics" style={{ fontSize: '13px', color: '#555', cursor: 'pointer' }}>
          Needs lyrics
        </label>
      </div>

      {/* Mood */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Mood</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {MOODS.map(mood => {
            const active = (metadata.moods || []).includes(mood);
            return (
              <button key={mood} onClick={() => toggleMood(mood)} style={{
                padding: '4px 10px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
                border: active ? '2px solid #1a73e8' : '1px solid #ccc',
                backgroundColor: active ? '#1a73e8' : 'white',
                color: active ? 'white' : '#555',
              }}>
                {mood}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Tags (press Enter to add)</label>
        <input style={inputStyle} type="text" value={tagInput}
          onChange={e => setTagInput(e.target.value)} onKeyDown={addTag}
          placeholder="e.g. verse, bridge, riff" />
        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {(metadata.tags || []).map(tag => (
            <span key={tag} style={{
              backgroundColor: '#e8f5e2', color: '#2a6b17', padding: '3px 10px',
              borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              {tag}
              <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a6b17', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Notes / Lyrics</label>
        <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical' }}
          value={metadata.notes || ''} onChange={e => update('notes', e.target.value)}
          placeholder="Chord progression, lyrics, ideas..." />
      </div>

    </div>
  );
}

export default MetadataEditor;
