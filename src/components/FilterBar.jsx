import { useState } from 'react';

const ALL_KEYS = [
  'A Major', 'A# Major', 'B Major', 'C Major', 'C# Major', 'D Major',
  'D# Major', 'E Major', 'F Major', 'F# Major', 'G Major', 'G# Major',
  'A Minor', 'A# Minor', 'B Minor', 'C Minor', 'C# Minor', 'D Minor',
  'D# Minor', 'E Minor', 'F Minor', 'F# Minor', 'G Minor', 'G# Minor',
];

function abbr(key) { return key.replace('Major', 'Maj').replace('Minor', 'Min'); }

const QUALITY_FLAGS = ['Keeper', 'Rough idea', 'Needs work'];
const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '5/4', '7/8', '12/8', 'Other'];
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

const chipStyle = (active) => ({
  display: 'inline-block', padding: '4px 10px', borderRadius: '20px',
  fontSize: '12px', cursor: 'pointer', userSelect: 'none',
  border: active ? '2px solid #1a73e8' : '1px solid #ccc',
  backgroundColor: active ? '#1a73e8' : 'white',
  color: active ? 'white' : '#333',
  fontWeight: active ? '600' : '400',
});

const selectStyle = {
  padding: '4px 8px', fontSize: '12px', borderRadius: '6px',
  border: '1px solid #ccc', backgroundColor: 'white', color: '#222', width: '100%',
};

const sectionLabel = {
  fontSize: '11px', fontWeight: '600', color: '#888',
  textTransform: 'uppercase', marginBottom: '6px',
};

function FilterBar({ filters, onChange, availableTags }) {
  const [open, setOpen] = useState(false);

  const set = (key, value) => onChange({ ...filters, [key]: value });

  const toggleMood = (mood) => {
    const current = filters.moods || [];
    const updated = current.includes(mood) ? current.filter(m => m !== mood) : [...current, mood];
    set('moods', updated);
  };

  const toggleTag = (tag) => {
    const current = filters.tags || [];
    const updated = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    set('tags', updated);
  };

  const clearAll = () => onChange({
    key: '', keyMode: 'exact', instrument: '', quality: '',
    timeSignature: '', tuning: '', genre: '', capo: '', tags: [], moods: [], needsLyrics: false,
  });

  const activeCount = [
    filters.key, filters.instrument, filters.quality,
    filters.timeSignature, filters.tuning, filters.genre, filters.capo,
    filters.needsLyrics ? 'y' : '',
    ...(filters.tags || []),
    ...(filters.moods || []),
  ].filter(Boolean).length;

  return (
    <div style={{ marginBottom: '16px', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', backgroundColor: '#f5f5f5', cursor: 'pointer', userSelect: 'none',
      }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#444' }}>
          Filter {activeCount > 0 && <span style={{ color: '#1a73e8' }}>({activeCount} active)</span>}
        </span>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {activeCount > 0 && (
            <button onClick={e => { e.stopPropagation(); clearAll(); }}
              style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: '12px' }}>
              Clear all
            </button>
          )}
          <span style={{ fontSize: '12px', color: '#888' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: '12px 14px', backgroundColor: 'white' }}>

          {/* Key */}
          <div style={{ marginBottom: '12px' }}>
            <div style={sectionLabel}>Key</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={filters.key || ''} onChange={e => set('key', e.target.value)}
                style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: 'white', color: '#222' }}>
                <option value="">Any key</option>
                <optgroup label="Major Keys">
                  {ALL_KEYS.filter(k => k.includes('Major')).map(k => <option key={k} value={k}>{abbr(k)}</option>)}
                </optgroup>
                <optgroup label="Minor Keys">
                  {ALL_KEYS.filter(k => k.includes('Minor')).map(k => <option key={k} value={k}>{abbr(k)}</option>)}
                </optgroup>
              </select>
              {filters.key && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {['exact', 'relative', 'related'].map(mode => (
                    <button key={mode} onClick={() => set('keyMode', mode)} style={chipStyle(filters.keyMode === mode)}>
                      {mode === 'exact' ? 'Exact' : mode === 'relative' ? 'Relative ↔' : 'Related ~'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grid dropdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div><div style={sectionLabel}>Instrument</div>
              <select value={filters.instrument || ''} onChange={e => set('instrument', e.target.value)} style={selectStyle}>
                <option value="">Any</option>{INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div><div style={sectionLabel}>Tuning</div>
              <select value={filters.tuning || ''} onChange={e => set('tuning', e.target.value)} style={selectStyle}>
                <option value="">Any</option>{TUNINGS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><div style={sectionLabel}>Genre</div>
              <select value={filters.genre || ''} onChange={e => set('genre', e.target.value)} style={selectStyle}>
                <option value="">Any</option>{GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div><div style={sectionLabel}>Time Signature</div>
              <select value={filters.timeSignature || ''} onChange={e => set('timeSignature', e.target.value)} style={selectStyle}>
                <option value="">Any</option>{TIME_SIGNATURES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><div style={sectionLabel}>Quality</div>
              <select value={filters.quality || ''} onChange={e => set('quality', e.target.value)} style={selectStyle}>
                <option value="">Any</option>
                <option value="__unrated__">Unrated</option>
                {QUALITY_FLAGS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div><div style={sectionLabel}>Capo</div>
              <select value={filters.capo || ''} onChange={e => set('capo', e.target.value)} style={selectStyle}>
                <option value="">Any</option>
                <option value="__none__">No capo</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={String(n)}>Fret {n}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Needs Lyrics */}
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" id="filterNeedsLyrics" checked={filters.needsLyrics || false}
              onChange={e => set('needsLyrics', e.target.checked)}
              style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
            <label htmlFor="filterNeedsLyrics" style={{ fontSize: '13px', color: '#555', cursor: 'pointer' }}>
              Needs lyrics only
            </label>
          </div>

          {/* Mood */}
          <div style={{ marginBottom: '12px' }}>
            <div style={sectionLabel}>Mood</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {MOODS.map(mood => (
                <button key={mood} onClick={() => toggleMood(mood)} style={chipStyle((filters.moods || []).includes(mood))}>
                  {mood}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {availableTags && availableTags.length > 0 && (
            <div>
              <div style={sectionLabel}>Tags</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {availableTags.map(tag => (
                  <button key={tag} onClick={() => toggleTag(tag)} style={chipStyle((filters.tags || []).includes(tag))}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FilterBar;
