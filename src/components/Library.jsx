import { useState, useEffect, useRef } from 'react';
import { fetchClips, getAudioUrl, trashFile, renameFile } from './DriveLibrary';
import { loadMetadata, loadAllMetadata, saveMetadata } from './MetadataService';
import MetadataEditor from './MetadataEditor';
import { analyzeAudio } from './AudioAnalyzer';
import FilterBar from './FilterBar';
import { keyMatches } from './KeyUtils';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'alpha', label: 'A → Z' },
  { value: 'key', label: 'By key' },
  { value: 'bpm', label: 'By BPM' },
];

const INSTRUMENTS = ['Guitar', 'Bass', 'Drums', 'Speech', 'Singing', 'Keyboard/Piano', 'Combination', 'Other'];
const TUNINGS = ['E Standard', 'Half-Step Down', 'Drop D', 'D Standard', 'Drop C#', 'Open G', 'Open E', 'DADGAD', 'Other'];
const ALL_KEYS = [
  'A Major', 'A# Major', 'B Major', 'C Major', 'C# Major', 'D Major',
  'D# Major', 'E Major', 'F Major', 'F# Major', 'G Major', 'G# Major',
  'A Minor', 'A# Minor', 'B Minor', 'C Minor', 'C# Minor', 'D Minor',
  'D# Minor', 'E Minor', 'F Minor', 'F# Minor', 'G Minor', 'G# Minor',
];
const QUALITY_FLAGS = ['Keeper', 'Rough idea', 'Needs work'];

function BulkEditor({ count, onApply, onCancel }) {
  const [fields, setFields] = useState({});
  const set = (k, v) => setFields(prev => ({ ...prev, [k]: v }));
  const unset = (k) => setFields(prev => { const n = { ...prev }; delete n[k]; return n; });

  const selectStyle = {
    padding: '6px 8px', fontSize: '13px', borderRadius: '6px',
    border: '1px solid #ccc', backgroundColor: 'white', color: '#222', width: '100%',
  };

  return (
    <div style={{ backgroundColor: '#fffbf0', border: '1px solid #f0c040', borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
      <p style={{ fontSize: '13px', fontWeight: '600', color: '#7a5000', margin: '0 0 12px' }}>
        Edit {count} selected clip{count !== 1 ? 's' : ''} — only filled fields will be updated:
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Key</label>
          <select style={selectStyle} value={fields.key || ''} onChange={e => e.target.value ? set('key', e.target.value) : unset('key')}>
            <option value="">— No change —</option>
            {ALL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Instrument</label>
          <select style={selectStyle} value={fields.instrument || ''} onChange={e => e.target.value ? set('instrument', e.target.value) : unset('instrument')}>
            <option value="">— No change —</option>
            {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Tuning</label>
          <select style={selectStyle} value={fields.tuning || ''} onChange={e => e.target.value ? set('tuning', e.target.value) : unset('tuning')}>
            <option value="">— No change —</option>
            {TUNINGS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Quality</label>
          <select style={selectStyle} value={fields.quality || ''} onChange={e => e.target.value ? set('quality', e.target.value) : unset('quality')}>
            <option value="">— No change —</option>
            {QUALITY_FLAGS.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => onApply(fields)}
          disabled={Object.keys(fields).length === 0}
          style={{ padding: '7px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
        >
          Apply to {count} clip{count !== 1 ? 's' : ''}
        </button>
        <button
          onClick={onCancel}
          style={{ padding: '7px 16px', backgroundColor: 'transparent', color: '#555', border: '1px solid #ccc', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function RecentlyAdded({ clips, metadataMap, playingId, onPlay, formatDate }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: '16px', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 14px', backgroundColor: '#f0f7ff', cursor: 'pointer', userSelect: 'none',
        borderBottom: open ? '1px solid #e0e0e0' : 'none',
      }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a3d8b' }}>Recently Added</span>
        <span style={{ fontSize: '12px', color: '#888' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ backgroundColor: 'white' }}>
          {clips.map(clip => {
            const meta = metadataMap[clip.id];
            return (
              <div key={clip.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 14px', borderBottom: '1px solid #f0f0f0',
              }}>
                <button onClick={() => onPlay(clip)} style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: playingId === clip.id ? '#cc0000' : '#1a73e8',
                  color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px',
                }}>
                  {playingId === clip.id ? '■' : '▶'}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '500', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {clip.name.replace(/\.(webm|m4a|ogg|audio)$/, '')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    {formatDate(clip.createdTime)}
                    {meta?.key ? ` · ${meta.key}` : ''}
                    {meta?.bpm ? ` · ${meta.bpm} BPM` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Library({ accessToken, initialKeyFilter, onFilterConsumed }) {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [audioUrls, setAudioUrls] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [metadataMap, setMetadataMap] = useState({});
  const [durationMap, setDurationMap] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analyzeFailed, setAnalyzeFailed] = useState({});
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [analysisCandidates, setAnalysisCandidates] = useState({});
  const [filters, setFilters] = useState({
    key: '', keyMode: 'exact', instrument: '', quality: '',
    timeSignature: '', tuning: '', genre: '', capo: '', tags: [], moods: [], needsLyrics: false, favorite: false,
  });
  const [sortBy, setSortBy] = useState('newest');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (accessToken) loadClips();
  }, [accessToken]);

  useEffect(() => {
    if (initialKeyFilter) {
      setFilters(prev => ({ ...prev, key: initialKeyFilter, keyMode: 'exact' }));
      if (onFilterConsumed) onFilterConsumed();
    }
  }, [initialKeyFilter]);

  const loadClips = async () => {
    setLoading(true);
    try {
      const results = await fetchClips(accessToken);
      setClips(results);
      const metadataMap = await loadAllMetadata(accessToken, results);
      setMetadataMap(metadataMap);
    } catch (err) {
      console.error('Failed to load clips:', err);
    }
    setLoading(false);
  };

  const handlePlay = async (clip) => {
    if (playingId === clip.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    let url = audioUrls[clip.id];
    if (!url) {
      url = await getAudioUrl(accessToken, clip.id);
      setAudioUrls(prev => ({ ...prev, [clip.id]: url }));
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(url);
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;
    audio.addEventListener('loadedmetadata', () => {
      setDurationMap(prev => ({ ...prev, [clip.id]: audio.duration }));
    });
    audio.play();
    setPlayingId(clip.id);
    audio.onended = () => setPlayingId(null);
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) audioRef.current.playbackRate = speed;
  };

  const handleDownload = async (clip) => {
    let url = audioUrls[clip.id];
    if (!url) {
      url = await getAudioUrl(accessToken, clip.id);
      setAudioUrls(prev => ({ ...prev, [clip.id]: url }));
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = clip.name;
    a.click();
  };

  const handleExpand = async (clip) => {
    if (expandedId === clip.id) { setExpandedId(null); return; }
    setExpandedId(clip.id);
    if (!metadataMap[clip.id]) {
      const meta = await loadMetadata(accessToken, clip.id, clip.name);
      setMetadataMap(prev => ({ ...prev, [clip.id]: meta }));
    }
  };

  const handleMetadataChange = (clipId, newMetadata) => {
    setMetadataMap(prev => ({ ...prev, [clipId]: newMetadata }));
  };

  const handleSaveMetadata = async (clip) => {
    setSavingId(clip.id);
    try {
      await saveMetadata(accessToken, clip.id, clip.name, metadataMap[clip.id]);
    } catch (err) {
      alert('Failed to save metadata.');
    }
    setSavingId(null);
  };

  const handleAnalyze = async (clip) => {
    setAnalyzingId(clip.id);
    setAnalysisCandidates(prev => ({ ...prev, [clip.id]: null }));
    setAnalyzeFailed(prev => ({ ...prev, [clip.id]: null }));

    // Clips analyzed at record time already have candidates stored in their
    // sidecar — reuse those instantly instead of re-decoding the file
    // (which iOS Safari cannot do for its own MediaRecorder output).
    const storedCandidates = metadataMap[clip.id]?.candidates;
    if (storedCandidates?.length > 0) {
      setAnalysisCandidates(prev => ({ ...prev, [clip.id]: storedCandidates }));
      setAnalyzingId(null);
      return;
    }

    try {
      let url = audioUrls[clip.id];
      if (!url) {
        url = await getAudioUrl(accessToken, clip.id);
        setAudioUrls(prev => ({ ...prev, [clip.id]: url }));
      }
      const res = await fetch(url);
      const blob = await res.blob();
      const result = await analyzeAudio(blob);
      if (result) {
        setAnalysisCandidates(prev => ({ ...prev, [clip.id]: result.candidates }));
        setMetadataMap(prev => ({
          ...prev,
          [clip.id]: { ...prev[clip.id], key: result.key, bpm: result.bpm?.toString() || prev[clip.id]?.bpm || '' }
        }));
      } else {
        setAnalyzeFailed(prev => ({ ...prev, [clip.id]: 'Decoder returned no result.' }));
      }
    } catch (err) {
      console.error('Analysis failed:', err);
      setAnalyzeFailed(prev => ({ ...prev, [clip.id]: `${err?.name || 'Error'}: ${err?.message || 'unknown'}` }));
    }
    setAnalyzingId(null);
  };

  const baseName = (name) => name.replace(/\.(webm|ogg|m4a|mp4|audio|aac)$/i, '');
  const extOf = (name) => {
    const m = name.match(/\.(webm|ogg|m4a|mp4|audio|aac)$/i);
    return m ? m[0] : '';
  };

  const startRename = (clip) => {
    setRenamingId(clip.id);
    setRenameValue(baseName(clip.name));
  };

  const commitRename = async (clip) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === baseName(clip.name)) { setRenamingId(null); return; }
    setBusyId(clip.id);
    try {
      const newAudioName = trimmed + extOf(clip.name);
      await renameFile(accessToken, clip.id, newAudioName);
      // Keep the metadata sidecar's name in sync so it stays paired
      const sidecarId = metadataMap[clip.id]?._sidecarId;
      if (sidecarId) {
        await renameFile(accessToken, sidecarId, trimmed + '.json');
      }
      setClips(prev => prev.map(c => c.id === clip.id ? { ...c, name: newAudioName } : c));
      setRenamingId(null);
    } catch (err) {
      console.error('Rename failed:', err);
      alert('Rename failed: ' + err.message);
    }
    setBusyId(null);
  };

  const handleDelete = async (clip) => {
    setBusyId(clip.id);
    try {
      await trashFile(accessToken, clip.id);
      const sidecarId = metadataMap[clip.id]?._sidecarId;
      if (sidecarId) {
        await trashFile(accessToken, sidecarId).catch(e => console.warn('Sidecar delete failed:', e));
      }
      setClips(prev => prev.filter(c => c.id !== clip.id));
      setConfirmDeleteId(null);
      if (expandedId === clip.id) setExpandedId(null);
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Delete failed: ' + err.message);
    }
    setBusyId(null);
  };

  const toggleFavorite = async (clip) => {
    const current = metadataMap[clip.id] || {};
    const updated = { ...current, favorite: !current.favorite };
    setMetadataMap(prev => ({ ...prev, [clip.id]: updated }));
    try {
      await saveMetadata(accessToken, clip.id, clip.name, updated);
    } catch (err) {
      console.error('Favorite save failed:', err);
      setMetadataMap(prev => ({ ...prev, [clip.id]: current }));
    }
  };

  const handleExport = () => {
    const rows = clips.map(c => {
      const m = metadataMap[c.id] || {};
      return {
        name: baseName(c.name),
        dateRecorded: c.createdTime || '',
        key: m.key || '',
        bpm: m.bpm || '',
        timeSignature: m.timeSignature || '',
        instrument: m.instrument || '',
        tuning: m.tuning || '',
        genre: m.genre || '',
        capo: m.capo || '',
        quality: m.quality || '',
        favorite: m.favorite ? 'yes' : '',
        needsLyrics: m.needsLyrics ? 'yes' : '',
        moods: (m.moods || []).join('; '),
        tags: (m.tags || []).join('; '),
        notes: (m.notes || '').replace(/\r?\n/g, ' '),
      };
    });

    const headers = Object.keys(rows[0] || { name: '' });
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
    ].join('\n');

    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riff-catalog-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const toggleSelect = (clipId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(clipId) ? next.delete(clipId) : next.add(clipId);
      return next;
    });
  };

  const selectAll = (clipsToSelect) => setSelectedIds(new Set(clipsToSelect.map(c => c.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const applyBulkMetadata = async (fields) => {
    const snapshot = {};
    for (const clipId of selectedIds) {
      snapshot[clipId] = { ...metadataMap[clipId] };
    }
    for (const clipId of selectedIds) {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) continue;
      const updated = { ...metadataMap[clipId], ...fields };
      setMetadataMap(prev => ({ ...prev, [clipId]: updated }));
      await saveMetadata(accessToken, clipId, clip.name, updated);
    }
    setSelectedIds(new Set());
    setBulkOpen(false);
    const timeoutId = setTimeout(() => setUndoSnapshot(null), 10000);
    setUndoSnapshot({ snapshot, timeoutId });
  };

  const handleUndo = async () => {
    if (!undoSnapshot) return;
    clearTimeout(undoSnapshot.timeoutId);
    for (const [clipId, prevMeta] of Object.entries(undoSnapshot.snapshot)) {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) continue;
      setMetadataMap(prev => ({ ...prev, [clipId]: prevMeta }));
      await saveMetadata(accessToken, clipId, clip.name, prevMeta);
    }
    setUndoSnapshot(null);
  };

  const availableTags = [...new Set(
    Object.values(metadataMap).flatMap(m => m?.tags || [])
  )].sort();

  const filteredClips = clips.filter(clip => {
    const meta = metadataMap[clip.id];
    if (!meta) return true;
    if (filters.key && !keyMatches(meta.key, filters.key, filters.keyMode || 'exact')) return false;
    if (filters.instrument && (meta.instrument || '') !== filters.instrument) return false;
    if (filters.tuning && (meta.tuning || '') !== filters.tuning) return false;
    if (filters.genre && (meta.genre || '') !== filters.genre) return false;
    if (filters.timeSignature && (meta.timeSignature || '') !== filters.timeSignature) return false;
    if (filters.capo) {
      if (filters.capo === '__none__') { if (meta.capo) return false; }
      else { if (String(meta.capo) !== filters.capo) return false; }
    }
    if (filters.quality) {
      if (filters.quality === '__unrated__') { if (meta.quality) return false; }
      else { if (meta.quality !== filters.quality) return false; }
    }
    if (filters.needsLyrics && !meta.needsLyrics) return false;
    if (filters.favorite && !meta.favorite) return false;
    if (filters.moods?.length > 0) {
      if (!filters.moods.every(m => (meta.moods || []).includes(m))) return false;
    }
    if (filters.tags?.length > 0) {
      if (!filters.tags.every(t => (meta.tags || []).includes(t))) return false;
    }
    return true;
  });

  const sortedClips = [...filteredClips].sort((a, b) => {
    const metaA = metadataMap[a.id];
    const metaB = metadataMap[b.id];
    if (sortBy === 'newest') return new Date(b.createdTime) - new Date(a.createdTime);
    if (sortBy === 'oldest') return new Date(a.createdTime) - new Date(b.createdTime);
    if (sortBy === 'alpha') return a.name.localeCompare(b.name);
    if (sortBy === 'key') return (metaA?.key || 'zzz').localeCompare(metaB?.key || 'zzz');
    if (sortBy === 'bpm') return (parseInt(metaA?.bpm) || 0) - (parseInt(metaB?.bpm) || 0);
    return 0;
  });

  const recentClips = [...clips]
    .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
    .slice(0, 5);

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatSize = (bytes) => {
    if (!bytes) return '';
    const kb = parseInt(bytes) / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
  };
  const formatDuration = (secs) => {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const iconBtnStyle = {
    background: 'none', border: '1px solid #ddd', borderRadius: '6px',
    padding: '4px 8px', cursor: 'pointer', fontSize: '16px', color: '#444', flexShrink: 0, lineHeight: 1,
  };

  const speedBtnStyle = (active) => ({
    padding: '3px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer',
    border: active ? '2px solid #1a73e8' : '1px solid #ccc',
    backgroundColor: active ? '#1a73e8' : 'white',
    color: active ? 'white' : '#555',
  });

  if (loading) return <p>Loading library...</p>;

  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ margin: 0 }}>
          Library ({sortedClips.length}{sortedClips.length !== clips.length ? ` of ${clips.length}` : ''})
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: 'white', color: '#222' }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={loadClips} style={{ padding: '6px 12px', cursor: 'pointer' }}>Refresh</button>
        </div>
      </div>

      {recentClips.length > 0 && (
        <RecentlyAdded
          clips={recentClips}
          metadataMap={metadataMap}
          playingId={playingId}
          onPlay={handlePlay}
          formatDate={formatDate}
        />
      )}

      {playingId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '12px', color: '#555' }}>
          <span>Speed:</span>
          {[0.5, 0.75, 1].map(s => (
            <button key={s} onClick={() => handleSpeedChange(s)} style={speedBtnStyle(playbackSpeed === s)}>
              {s === 1 ? '1×' : `${s}×`}
            </button>
          ))}
        </div>
      )}

      <FilterBar filters={filters} onChange={setFilters} availableTags={availableTags} />

      {clips.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <button onClick={handleExport}
            style={{
              padding: '6px 14px', backgroundColor: 'transparent', color: '#888',
              border: '1px solid #666', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
            }}>
            ⬇ Export library (CSV)
          </button>
        </div>
      )}

      {undoSnapshot && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: '#e8f5e2', border: '1px solid #b5d9a5', borderRadius: '8px',
          padding: '10px 14px', marginBottom: '10px',
        }}>
          <span style={{ fontSize: '13px', color: '#2a6b17' }}>✅ Bulk edit applied.</span>
          <button onClick={handleUndo}
            style={{ padding: '5px 14px', backgroundColor: '#2a6b17', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
            Undo
          </button>
        </div>
      )}

      {sortedClips.length === 0 && <p style={{ color: '#888' }}>No clips match the current filters.</p>}

      {sortedClips.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', fontSize: '13px', color: '#555' }}>
          <input type="checkbox"
            checked={selectedIds.size === sortedClips.length && sortedClips.length > 0}
            onChange={e => e.target.checked ? selectAll(sortedClips) : deselectAll()}
            style={{ width: '14px', height: '14px', cursor: 'pointer' }}
          />
          <span>{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}</span>
          {selectedIds.size > 0 && (
            <button onClick={() => setBulkOpen(true)}
              style={{ padding: '4px 12px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
              Edit selected
            </button>
          )}
          {selectedIds.size > 0 && (
            <button onClick={deselectAll}
              style={{ background: 'none', border: 'none', color: '#888', fontSize: '12px', cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>
      )}

      {bulkOpen && selectedIds.size > 0 && (
        <BulkEditor
          count={selectedIds.size}
          onApply={applyBulkMetadata}
          onCancel={() => setBulkOpen(false)}
        />
      )}

      {sortedClips.map(clip => (
        <div key={clip.id} style={{
          marginBottom: '8px', border: '1px solid #ddd', borderRadius: '8px',
          backgroundColor: playingId === clip.id ? '#f0f7ff' : '#fafafa', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px' }}>
            <input type="checkbox"
              checked={selectedIds.has(clip.id)}
              onChange={() => toggleSelect(clip.id)}
              onClick={e => e.stopPropagation()}
              style={{ width: '14px', height: '14px', cursor: 'pointer', flexShrink: 0 }}
            />
            <button onClick={() => handlePlay(clip)} style={{
              width: '36px', height: '36px', borderRadius: '50%',
              backgroundColor: playingId === clip.id ? '#cc0000' : '#1a73e8',
              color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px', flexShrink: 0
            }}>
              {playingId === clip.id ? '■' : '▶'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleFavorite(clip); }}
              title={metadataMap[clip.id]?.favorite ? 'Unstar' : 'Star'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                fontSize: '18px', padding: '0 2px', lineHeight: 1,
                color: metadataMap[clip.id]?.favorite ? '#f5b301' : '#555',
              }}>
              {metadataMap[clip.id]?.favorite ? '★' : '☆'}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              {renamingId === clip.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(clip);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={() => commitRename(clip)}
                  disabled={busyId === clip.id}
                  style={{
                    width: '100%', padding: '6px 8px', fontSize: '14px',
                    borderRadius: '4px', border: '1px solid #1a73e8', boxSizing: 'border-box',
                  }}
                />
              ) : (
                <div style={{ cursor: 'pointer' }} onClick={() => handleExpand(clip)}>
                  {/* Line 1 — name */}
                  <div style={{ fontWeight: '500', wordBreak: 'break-word', lineHeight: '1.3' }}>
                    {baseName(clip.name)}
                  </div>

                  {/* Line 2 — key + tempo (each kept whole on one line) */}
                  {(metadataMap[clip.id]?.key || metadataMap[clip.id]?.bpm) && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '0 8px' }}>
                      {metadataMap[clip.id]?.key && (
                        <span style={{ whiteSpace: 'nowrap', fontWeight: '600' }}>
                          {metadataMap[clip.id].key}
                        </span>
                      )}
                      {metadataMap[clip.id]?.bpm && (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {metadataMap[clip.id].bpm} BPM
                        </span>
                      )}
                    </div>
                  )}

                  {/* Line 3 — date + duration */}
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '0 8px' }}>
                    <span style={{ whiteSpace: 'nowrap' }}>{formatDate(clip.createdTime)}</span>
                    {durationMap[clip.id] && (
                      <span style={{ whiteSpace: 'nowrap' }}>{formatDuration(durationMap[clip.id])}</span>
                    )}
                    {metadataMap[clip.id]?.needsLyrics && (
                      <span style={{ whiteSpace: 'nowrap' }}>📝 needs lyrics</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); startRename(clip); }} style={iconBtnStyle} title="Rename">✎</button>
            <button onClick={() => handleExpand(clip)} style={iconBtnStyle}>
              {expandedId === clip.id ? '▲' : '▼'}
            </button>
          </div>

          {/* Secondary actions on their own line so the clip name gets full width */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: '8px',
            padding: '0 12px 10px', marginTop: '-4px',
          }}>
            <button onClick={() => handleDownload(clip)} style={iconBtnStyle} title="Download">⬇</button>
            <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(clip.id); }}
              style={{ ...iconBtnStyle, color: '#c00' }} title="Delete">🗑</button>
          </div>

          {confirmDeleteId === clip.id && (
            <div style={{
              padding: '10px 12px', backgroundColor: '#3a1414',
              borderTop: '1px solid #5a2020', display: 'flex',
              alignItems: 'center', gap: '10px', flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '13px', color: '#ffb4b4', flex: 1, minWidth: '160px' }}>
                Move “{baseName(clip.name)}” to Drive trash?
              </span>
              <button onClick={() => handleDelete(clip)} disabled={busyId === clip.id}
                style={{ padding: '6px 14px', backgroundColor: '#cc0000', color: 'white',
                  border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
                {busyId === clip.id ? 'Deleting…' : 'Delete'}
              </button>
              <button onClick={() => setConfirmDeleteId(null)}
                style={{ padding: '6px 14px', backgroundColor: 'transparent', color: '#ccc',
                  border: '1px solid #666', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          )}

          {expandedId === clip.id && metadataMap[clip.id] && (
            <div style={{ padding: '0 12px 12px' }}>
              <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px' }}>
                {clip.size ? formatSize(clip.size) : ''}
                {clip.size && durationMap[clip.id] ? ' · ' : ''}
                {durationMap[clip.id] ? formatDuration(durationMap[clip.id]) : ''}
              </div>
              <MetadataEditor
                metadata={metadataMap[clip.id]}
                onChange={(newMeta) => handleMetadataChange(clip.id, newMeta)}
                onAnalyze={() => handleAnalyze(clip)}
                analyzing={analyzingId === clip.id}
                keyCandidates={analysisCandidates[clip.id] || metadataMap[clip.id]?.candidates || null}
                analyzeError={analyzeFailed[clip.id] ? `Analysis failed — ${analyzeFailed[clip.id]}` : null}
              />
              <button onClick={() => handleSaveMetadata(clip)} disabled={savingId === clip.id}
                style={{ marginTop: '10px', padding: '8px 20px', backgroundColor: '#1a73e8', color: 'white',
                  border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>
                {savingId === clip.id ? 'Saving...' : 'Save Metadata'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default Library;
