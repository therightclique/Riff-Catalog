import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchScreenshot } from './Screenshots';

// Owner-only dashboard. The numbers come from the owner's "Riff Catalog Usage" spreadsheet through
// the log-usage function, which only answers the email set in the OWNER_EMAIL setting on Netlify.
// Nothing here is cached: every open reads the sheets fresh.

const ENDPOINT = '/.netlify/functions/log-usage';
const BLUE = '#1a73e8';

const card = { backgroundColor: 'var(--rc-card)', border: '1px solid var(--rc-line)', borderRadius: '12px', padding: '14px', marginBottom: '14px', textAlign: 'left', color: 'var(--rc-ink)' };
const h = { fontSize: '15px', fontWeight: '700', margin: '0 0 10px' };
const sub = { fontSize: '12px', color: 'var(--rc-ink2)' };

const num = (v) => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const toObjects = (rows) => {
  if (!rows || rows.length < 2) return [];
  const head = rows[0];
  return rows.slice(1).filter(r => r && r.length && String(r[0] || '').trim()).map(r => Object.fromEntries(head.map((k, i) => [k, r[i] ?? ''])));
};
const ptMs = (s) => { const t = Date.parse(String(s || '').replace(' ', 'T') + 'Z'); return Number.isFinite(t) ? t : NaN; };
const ptNowMs = () => ptMs(new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'medium' }).format(new Date()));
const tally = (list, fn) => { const m = new Map(); for (const x of list) { const k = fn(x); if (k) m.set(k, (m.get(k) || 0) + 1); } return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value); };
// "402x874@3" (CSS size @ pixel ratio) -> real pixels, e.g. "1206\u00d72622 px". Falls back to the original text.
const realPx = (v) => {
  const m = /^(\d{2,5})x(\d{2,5})@(\d+(?:\.\d+)?)$/.exec(String(v || '').trim());
  if (!m) return String(v || '').trim();
  const r = Number(m[3]);
  return `${Math.round(m[1] * r)}\u00d7${Math.round(m[2] * r)} px`;
};
const sumCol = (list, col) => list.reduce((a, r) => a + num(r[col]), 0);

function Tile({ label, value, hint }) {
  return (
    <div style={{ flex: '1 1 30%', minWidth: '96px', backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-line)', borderRadius: '10px', padding: '10px' }}>
      <div style={{ fontSize: '22px', fontWeight: '700', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--rc-ink2)', marginTop: '3px' }}>{label}</div>
      {hint && <div style={{ fontSize: '11px', color: 'var(--rc-ink2)' }}>{hint}</div>}
    </div>
  );
}

// One-series horizontal bars; the label and the count sit in text colors, the bar carries the data.
function Bars({ items, max, total, empty = 'Nothing yet.' }) {
  const shown = items.slice(0, max || 8);
  if (!shown.length) return <div style={sub}>{empty}</div>;
  const top = Math.max(...shown.map(i => i.value), 1);
  return (
    <div>
      {shown.map(i => (
        <div key={i.label} title={`${i.label}: ${i.value}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '13px' }}>
          <div style={{ width: '38%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.label}</div>
          <div style={{ flex: 1, height: '10px', backgroundColor: 'var(--rc-line)', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(2, (i.value / top) * 100)}%`, height: '100%', backgroundColor: BLUE, borderRadius: '5px' }} />
          </div>
          <div style={{ width: '48px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i.value}{total ? <span style={sub}> /{total}</span> : null}</div>
        </div>
      ))}
    </div>
  );
}

function Line({ points }) {
  if (points.length < 2) return <div style={sub}>Needs at least two days of history.</div>;
  const W = 300, H = 90, pad = 4;
  const maxV = Math.max(...points.map(p => p.value), 1);
  const x = (i) => pad + (i / (points.length - 1)) * (W - 2 * pad);
  const y = (v) => H - pad - (v / maxV) * (H - 2 * pad);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="People active per day" style={{ display: 'block' }}>
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="var(--rc-line)" strokeWidth="1" />
        <path d={d} fill="none" stroke={BLUE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={p.label} cx={x(i)} cy={y(p.value)} r="6" fill="transparent"><title>{`${p.label}: ${p.value} active`}</title></circle>
        ))}
        {points.length <= 45 && points.map((p, i) => <circle key={'d' + p.label} cx={x(i)} cy={y(p.value)} r="2.5" fill={BLUE} stroke="var(--rc-card)" strokeWidth="1.5" />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...sub }}><span>{points[0].label}</span><span>peak {maxV}</span><span>{points[points.length - 1].label}</span></div>
    </div>
  );
}

const MILESTONES = [['First recording (PT)', 'Made a recording'], ['First Drive save (PT)', 'Saved to Drive'], ['First Library open (PT)', 'Opened Library'], ['First Jam play (PT)', 'Played Jam'],
  ['First Key Finder use (PT)', 'Used Key Finder'], ['First Practice use (PT)', 'Used Practice'], ['First Randomizer use (PT)', 'Used Randomizer'], ['First idea saved (PT)', 'Saved an idea'], ['First feedback sent (PT)', 'Sent feedback']];
const FEATURES = [['Jam plays', 'Jam plays'], ['Practice picks', 'Practice picks'], ['Key Finder lookups', 'Key Finder lookups'], ['Wheel spins', 'Wheel spins'], ['Surprise me uses', 'Surprise me'], ['Ideas saved (saves)', 'Ideas saved'], ['Library filter uses', 'Library filters'], ['Library sort changes', 'Library sorts'], ['Clip plays', 'Clip plays']];

const isNewStatus = (r) => { const t = String(r['Status'] ?? '').trim().toLowerCase(); return t === '' || t === 'new'; };

// One support request. Owner view shows who sent it and a Mark read button; a person's own view shows just their message.
// The screenshots attached to a support request. The owner taps to load them (nothing is fetched until then);
// a person looking at their own request just sees how many they attached.
function Screenshots({ keys, accessToken, owner }) {
  const [st, setSt] = useState({ kind: 'idle', urls: [] });
  const urlsRef = useRef([]);
  useEffect(() => () => { urlsRef.current.forEach(u => u && URL.revokeObjectURL(u)); }, []);
  if (!keys.length) return null;
  if (!owner) return <div style={sub}>{'\u{1F4CE}'} {keys.length} screenshot{keys.length === 1 ? '' : 's'} attached</div>;
  const load = async () => {
    setSt({ kind: 'loading', urls: [] });
    const urls = await Promise.all(keys.map(k => fetchScreenshot(k, accessToken)));
    urlsRef.current = urls;
    setSt({ kind: 'ready', urls });
  };
  if (st.kind === 'idle' || st.kind === 'loading') {
    return <button disabled={st.kind === 'loading'} onClick={load} style={{ marginTop: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', borderRadius: '8px', border: '1px solid var(--rc-line)', cursor: 'pointer', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)' }}>{st.kind === 'loading' ? 'Loading…' : `View ${keys.length} screenshot${keys.length === 1 ? '' : 's'}`}</button>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
      {st.urls.map((u, i) => u
        ? <a key={i} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt={`Screenshot ${i + 1}`} style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '8px', border: '1px solid var(--rc-line)', display: 'block' }} /></a>
        : <div key={i} style={sub}>Screenshot {i + 1} is no longer available (pictures are removed after 60 days).</div>)}
    </div>
  );
}

// The tags the owner can put on a support request. The same list is checked again on the server.
const SUPPORT_TAGS = ['Bug', 'Feature request', 'Question', 'In progress', 'On hold', 'Needs more info', 'Resolved', 'Do not fix', 'Duplicate'];
const TAG_DOT = { 'Bug': '#d93025', 'Feature request': '#1a73e8', 'Question': '#8e24aa', 'In progress': '#f9ab00', 'On hold': '#e8710a', 'Needs more info': '#12a4af', 'Resolved': '#1e8e3e', 'Do not fix': '#80868b', 'Duplicate': '#80868b' };
const tagsOf = (r) => String(r['Tags'] || '').split(',').map(x => x.trim()).filter(x => SUPPORT_TAGS.includes(x));
const isArchivedRow = (r) => String(r['Archived'] || '').trim().toLowerCase() === 'yes';
const withTags = (r, list) => ({ ...r, Tags: SUPPORT_TAGS.filter(t => list.includes(t)).join(',') });
const smallBtn = { padding: '6px 12px', fontSize: '12px', fontWeight: '600', borderRadius: '8px', border: '1px solid var(--rc-line)', cursor: 'pointer', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)' };

// A tag is always a word with a small colored dot, so it never depends on color alone.
function TagChip({ tag, on, onClick, count, pressed }) {
  const inner = (<><span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: TAG_DOT[tag] || '#80868b', flex: '0 0 auto' }} />{tag}{count !== undefined && <span style={{ color: 'var(--rc-ink2)', fontWeight: '500' }}>{count}</span>}</>);
  const base = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 9px', fontSize: '12px', fontWeight: '600', borderRadius: '999px', border: `1px solid ${on ? 'var(--rc-ink)' : 'var(--rc-line)'}`, backgroundColor: on ? 'var(--rc-surface)' : 'transparent', color: 'var(--rc-ink)', lineHeight: 1.4 };
  if (!onClick) return <span style={base}>{inner}</span>;
  return <button type="button" onClick={onClick} aria-pressed={pressed ?? on} style={{ ...base, cursor: 'pointer', fontFamily: 'inherit', padding: '5px 10px' }}>{inner}</button>;
}

// One support request. The owner sees who sent it, can tag and archive it, and mark it read. A person's own view shows
// their message and the tags the owner gave it, but can't change them.
function SupportItem({ r, i, owner, onPick, onRead, busy, accessToken, onTags, onArchive, searchHit }) {
  const unread = isNewStatus(r);
  const shotKeys = String(r['Screenshots'] || '').split(',').map(x => x.trim()).filter(Boolean);
  const [editing, setEditing] = useState(false);
  const tags = tagsOf(r);
  const archived = isArchivedRow(r);
  return (
    <div style={{ borderTop: i ? '1px solid var(--rc-line)' : 'none', paddingTop: i ? '10px' : 0, marginTop: i ? '10px' : 0, fontSize: '13px', lineHeight: 1.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {owner && unread && <span style={{ backgroundColor: '#d93025', color: 'white', fontSize: '11px', fontWeight: '700', padding: '1px 7px', borderRadius: '9px' }}>NEW</span>}
        {owner && archived && <span style={{ border: '1px solid var(--rc-line)', fontSize: '11px', fontWeight: '700', padding: '1px 7px', borderRadius: '9px', color: 'var(--rc-ink2)' }}>ARCHIVED</span>}
        {!owner && <span style={{ ...sub, fontWeight: '600' }}>{unread ? 'Waiting' : String(r['Status'] || 'Read')}</span>}
        <span style={sub}>
          {String(r['Date (PT)']).slice(0, 16)}
          {owner && <> · <button onClick={() => onPick(String(r['Email']))} style={{ background: 'none', border: 'none', padding: 0, color: BLUE, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>{r['Email']}</button></>}
          {r['App version'] ? ` · v${r['App version']}` : ''}{r['Device'] ? ` · ${r['Device']} ${r['OS version'] || ''}` : ''}{owner && r['Country'] ? ` · ${r['Country']} ${r['Region'] || ''}` : ''}
        </span>
      </div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '5px 0 2px' }} aria-label={owner ? 'Tags' : 'Tags added by the app’s owner'}>
          {tags.map(t => <TagChip key={t} tag={t} />)}
        </div>
      )}
      <div style={{ whiteSpace: 'pre-wrap', margin: '3px 0' }}>{r['Message']}</div>
      {String(r['Recent problems'] || '').trim() && <div style={{ fontFamily: '"Courier New", monospace', fontSize: '11px', whiteSpace: 'pre-wrap' }}>{r['Recent problems']}</div>}
      <Screenshots keys={shotKeys} accessToken={accessToken} owner={owner} />
      {owner && editing && onTags && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0 2px' }} role="group" aria-label="Choose tags">
          {SUPPORT_TAGS.map(t => <TagChip key={t} tag={t} on={tags.includes(t)} onClick={() => onTags(String(r['ID']), tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t])} />)}
        </div>
      )}
      {owner && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
          {unread && onRead && <button disabled={busy} onClick={() => onRead([String(r['ID'])], false)} style={smallBtn}>Mark read</button>}
          {onTags && <button type="button" onClick={() => setEditing(v => !v)} aria-expanded={editing} style={smallBtn}>{editing ? 'Done tagging' : (tags.length ? 'Edit tags' : 'Add tags')}</button>}
          {onArchive && <button type="button" onClick={() => onArchive(String(r['ID']), !archived)} style={smallBtn}>{archived ? 'Unarchive' : 'Archive'}</button>}
        </div>
      )}
    </div>
  );
}

// Tag filter row: tap tags to show only requests carrying any of them. Counts are for the requests being filtered.
function TagFilter({ rows, picked, setPicked }) {
  const counts = useMemo(() => {
    const c = new Map(); let untagged = 0;
    for (const r of rows) { const t = tagsOf(r); if (!t.length) untagged++; t.forEach(x => c.set(x, (c.get(x) || 0) + 1)); }
    return { c, untagged };
  }, [rows]);
  const toggle = (k) => setPicked(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const shown = SUPPORT_TAGS;   // always listed, so the filter is there even before anything is tagged
  return (
    <div style={{ margin: '0 0 10px' }}>
      <div style={{ ...sub, marginBottom: '5px' }}>Filter by tag{picked.size ? ' (showing requests with any picked tag)' : ''}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <button type="button" onClick={() => setPicked(new Set())} aria-pressed={picked.size === 0} style={{ padding: '5px 10px', fontSize: '12px', fontWeight: '600', borderRadius: '999px', border: `1px solid ${picked.size === 0 ? 'var(--rc-ink)' : 'var(--rc-line)'}`, backgroundColor: picked.size === 0 ? 'var(--rc-surface)' : 'transparent', color: 'var(--rc-ink)', cursor: 'pointer', fontFamily: 'inherit' }}>All</button>
        {shown.map(t => <TagChip key={t} tag={t} on={picked.has(t)} count={counts.c.get(t) || 0} onClick={() => toggle(t)} />)}
        {(
          <button type="button" onClick={() => toggle('__none')} aria-pressed={picked.has('__none')} style={{ padding: '5px 10px', fontSize: '12px', fontWeight: '600', borderRadius: '999px', border: `1px solid ${picked.has('__none') ? 'var(--rc-ink)' : 'var(--rc-line)'}`, backgroundColor: picked.has('__none') ? 'var(--rc-surface)' : 'transparent', color: 'var(--rc-ink)', cursor: 'pointer', fontFamily: 'inherit' }}>Untagged <span style={{ color: 'var(--rc-ink2)', fontWeight: '500' }}>{counts.untagged}</span></button>
        )}
      </div>
    </div>
  );
}
const passesTags = (r, picked) => {
  if (!picked.size) return true;
  const t = tagsOf(r);
  if (!t.length) return picked.has('__none');
  return t.some(x => picked.has(x));
};

// "View all support requests": every request ever sent, archived or not. Searching and the period filter work in the
// browser on the loaded list, so results update with every letter typed.
const PERIODS = [['all', 'All time'], ['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last month'], ['90', 'Last 90 days'], ['365', 'Last year']];
const SEARCH_MIN = 2;
export function periodStartMs(period, nowMs) {
  if (period === 'today') return ptMs(`${new Date(nowMs).toISOString().slice(0, 10)} 00:00:00`);
  const days = Number(period);
  return Number.isFinite(days) && days > 0 ? nowMs - days * 86400000 : -Infinity;
}
export function matchesSearch(r, q) {
  const needle = String(q || '').trim().toLowerCase();
  if (needle.length < SEARCH_MIN) return true;
  const hay = [r['Email'], r['Message'], r['ID'], r['Tags'], r['Status'], r['Device'], r['OS version'], r['App version'], r['Country'], r['Region'], r['Recent problems']].join('\n').toLowerCase();
  return hay.includes(needle);
}
function SupportArchive({ accessToken, over, onTags, onArchive, onRead, readIds, readAll, busy, onPick, onBack }) {
  const [st, setSt] = useState({ kind: 'loading', rows: [], total: 0 });
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState('all');
  const [picked, setPicked] = useState(() => new Set());
  const [newestFirst, setNewestFirst] = useState(true);
  const [showArchived, setShowArchived] = useState(false);   // archived requests stay hidden unless this is ticked
  const [limit, setLimit] = useState(50);
  const [tryN, setTryN] = useState(0);
  useEffect(() => {
    let live = true;
    setSt(prev => ({ ...prev, kind: 'loading' }));
    (async () => {
      try {
        const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'supportall', accessToken }) });
        if (!live) return;
        if (!res.ok) { setSt({ kind: res.status === 503 ? 'busy' : 'error', rows: [], total: 0 }); return; }
        const j = await res.json();
        const rows = (j.rows || []).map(r => Object.fromEntries(j.columns.map((c, k) => [c, r[k] ?? ''])))
          .map((r, k) => [r, k]).sort((a, b) => String(a[0]['Date (PT)']).localeCompare(String(b[0]['Date (PT)'])) || a[1] - b[1]).map(x => x[0]);   // oldest first, by the date sent
        if (live) setSt({ kind: 'ready', rows, total: j.total ?? rows.length });
      } catch { if (live) setSt({ kind: 'error', rows: [], total: 0 }); }
    })();
    return () => { live = false; };
  }, [accessToken, tryN]);
  // Changes made on this page or on the main page apply on top of what was loaded.
  const rows = useMemo(() => st.rows.map(r => {
    const o = over[String(r['ID'])];
    let x = r;
    if (o && o.tags !== undefined) x = { ...x, Tags: o.tags };
    if (o && o.archived !== undefined) x = { ...x, Archived: o.archived ? 'Yes' : '' };
    if (isNewStatus(x) && (readAll || readIds.has(String(r['ID'])) || (o && o.archived))) x = { ...x, Status: 'Read' };
    return x;
  }), [st.rows, over, readIds, readAll]);
  const original = useMemo(() => new Map(st.rows.map(r => [String(r['ID']), r])), [st.rows]);
  const nowMs = ptNowMs();
  const inPeriod = useMemo(() => { const from = periodStartMs(period, nowMs); return rows.filter(r => { const t = ptMs(r['Date (PT)']); return from === -Infinity || (Number.isFinite(t) && t >= from); }); }, [rows, period, nowMs]);
  const visible = useMemo(() => (showArchived ? inPeriod : inPeriod.filter(r => !isArchivedRow(r))), [inPeriod, showArchived]);
  const searched = useMemo(() => visible.filter(r => matchesSearch(r, q)), [visible, q]);
  const list = useMemo(() => { const f = searched.filter(r => passesTags(r, picked)); return newestFirst ? [...f].reverse() : f; }, [searched, picked, newestFirst]);
  const searching = q.trim().length >= SEARCH_MIN;
  useEffect(() => { setLimit(50); }, [q, period, picked, newestFirst, showArchived]);
  const archivedTotal = rows.filter(isArchivedRow).length;
  const pool = showArchived ? rows.length : rows.length - archivedTotal;
  const field = { padding: '9px 10px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--rc-line)', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)', fontFamily: 'inherit', boxSizing: 'border-box' };
  return (
    <>
      <button onClick={onBack} style={{ padding: '8px 14px', marginBottom: '12px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', border: '1px solid var(--rc-line)', cursor: 'pointer', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)' }}>{'←'} Back to dashboard</button>
      <div style={card}>
        <h3 style={h}>All support requests{st.kind === 'ready' ? ` (${rows.length}${st.total > rows.length ? ` of ${st.total}` : ''})` : ''}</h3>
        <div style={{ ...sub, marginBottom: '10px' }}>Every request ever sent. Tick Show archived to include the archived ones. Reply by email to the address shown.</div>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search email, message or tag" aria-label="Search support requests" autoComplete="off" spellCheck={false} style={{ ...field, width: '100%', marginBottom: '4px' }} />
        <div style={{ ...sub, minHeight: '16px', marginBottom: '8px' }} aria-live="polite">{q.trim().length === 1 ? `Type at least ${SEARCH_MIN} letters to search.` : (searching ? 'Searching all requests as you type.' : '')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          <label style={{ ...sub, display: 'flex', alignItems: 'center', gap: '6px' }}>Sent
            <select value={period} onChange={e => setPeriod(e.target.value)} aria-label="When the request was sent" style={field}>{PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label style={{ ...sub, display: 'flex', alignItems: 'center', gap: '6px' }}>Order
            <select value={newestFirst ? 'new' : 'old'} onChange={e => setNewestFirst(e.target.value === 'new')} aria-label="Order" style={field}>
              <option value="new">Newest first</option><option value="old">Oldest first (order sent)</option>
            </select>
          </label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', margin: '0 0 12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} style={{ width: '18px', height: '18px' }} />
          Show archived{archivedTotal ? ` (${archivedTotal})` : ''}
        </label>
        <TagFilter rows={searched} picked={picked} setPicked={setPicked} />
        {st.kind === 'loading' && <div style={sub}>Loading every support request{'…'}</div>}
        {(st.kind === 'error' || st.kind === 'busy') && (
          <div role="alert" style={{ fontSize: '13px', color: '#d93025', fontWeight: '600' }}>
            {st.kind === 'busy' ? 'The spreadsheet is busy right now.' : 'Couldn’t load the support requests.'} <button onClick={() => setTryN(n => n + 1)} style={{ ...smallBtn, marginLeft: '6px' }}>Try again</button>
          </div>
        )}
        {st.kind === 'ready' && (
          <>
            <div style={{ ...sub, marginBottom: '8px' }} aria-live="polite">{list.length === pool ? `Showing all ${pool}` : `${list.length} of ${pool} match`}{!showArchived && archivedTotal > 0 ? ` \u00B7 ${archivedTotal} archived hidden` : ''}</div>
            {rows.length === 0 && <div style={sub}>None yet.</div>}
            {rows.length > 0 && list.length === 0 && <div style={sub}>No requests match. Try a different search, period or tag.</div>}
            {list.slice(0, limit).map((r, i) => (
              <SupportItem key={String(r['ID'])} r={r} i={i} owner onPick={onPick} onRead={onRead} busy={busy} accessToken={accessToken} onTags={(id, t) => onTags(id, t, original.get(id))} onArchive={(id, a) => onArchive(id, a, original.get(id))} />
            ))}
            {list.length > limit && <button onClick={() => setLimit(n => n + 50)} style={{ ...smallBtn, marginTop: '12px' }}>Show 50 more ({list.length - limit} left)</button>}
          </>
        )}
      </div>
    </>
  );
}

// The people shown on one page of the People list come from the server 25 at a time, so the page never loads everyone.
function PeopleList({ accessToken, total, onPick }) {
  const [page, setPage] = useState(0);
  const [st, setSt] = useState({ kind: 'loading', msg: '', data: null });
  useEffect(() => {
    let live = true;
    setSt(prev => ({ ...prev, kind: 'loading', msg: '' }));
    (async () => {
      try {
        const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'people', accessToken, page }) });
        if (!live) return;
        if (res.status === 503) { setSt(prev => ({ ...prev, kind: 'error', msg: 'The spreadsheet is busy right now. Try again in a minute.' })); return; }
        if (!res.ok) { setSt(prev => ({ ...prev, kind: 'error', msg: 'Couldn\u2019t load this page of people.' })); return; }
        const j = await res.json();
        if (live) setSt({ kind: 'ready', msg: '', data: j });
      } catch { if (live) setSt(prev => ({ ...prev, kind: 'error', msg: 'Couldn\u2019t load this page of people.' })); }
    })();
    return () => { live = false; };
  }, [accessToken, page, total]);
  const d = st.data;
  const shownFrom = d && d.rows.length ? d.page * d.pageSize + 1 : 0;
  const pgBtn = (label, disabled, to) => (
    <button onClick={() => setPage(to)} disabled={disabled || st.kind === 'loading'} style={{ padding: '8px 10px', whiteSpace: 'nowrap', flex: '0 0 auto', fontSize: '13px', fontWeight: '600', borderRadius: '8px', border: '1px solid var(--rc-line)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)' }}>{label}</button>
  );
  return (
    <div style={card}>
      <h3 style={h}>People ({total})</h3>
      <div style={{ ...sub, marginBottom: '6px' }}>Tap an email to see that person’s dashboard</div>
      {st.kind === 'error' && <div role="alert" style={{ fontSize: '13px', color: '#d93025', fontWeight: '600', marginBottom: '8px' }}>{st.msg}</div>}
      {d && (
        <div style={{ overflowX: 'auto', opacity: st.kind === 'loading' ? 0.55 : 1 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '12px', width: '100%', minWidth: '560px' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--rc-ink2)' }}>
                {['Email', 'Last visit', 'Visits', 'Days', 'Clips', 'Device', 'Ver', 'Where'].map(c => <th key={c} style={{ padding: '4px 6px', borderBottom: '1px solid var(--rc-line)', fontWeight: '600' }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.rows.map(r => {
                const u = Object.fromEntries(d.columns.map((c, i) => [c, r[i]]));
                return (
                  <tr key={u['Email']}>
                    {[<button key="e" onClick={() => onPick(String(u['Email']))} style={{ background: 'none', border: 'none', padding: 0, color: BLUE, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>{u['Email']}</button>, String(u['Last login (PT)']).slice(5, 16), u['Sessions'], u['Days active'], u['Clip library size'], `${u['Device']} ${u['OS version']}`, u['App version'], `${u['Country']} ${u['Region']}`].map((c, i) => (
                      <td key={i} style={{ padding: '4px 6px', borderBottom: '1px solid var(--rc-line)', whiteSpace: 'nowrap' }}>{c}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!d && st.kind === 'loading' && <div style={sub}>Loading people…</div>}
      {d && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px' }}>
          {pgBtn('\u2190 Newer', d.page <= 0, d.page - 1)}
          <div style={{ ...sub, textAlign: 'center' }}>{shownFrom ? `${shownFrom}\u2013${shownFrom + d.rows.length - 1} of ${d.total}` : 'No one yet'}{` \u00B7 page ${d.page + 1} of ${d.pages}`}</div>
          {pgBtn('Older \u2192', d.page >= d.pages - 1, d.page + 1)}
        </div>
      )}
    </div>
  );
}

// Google lists a 100-user limit for new sign-ins on the project's Audience page. For this app's kind of permission
// (only the files it creates) Google says it doesn't apply, but it is watched anyway so it is never a surprise.
const SIGNIN_CAP = 100;
const CONSOLE_AUDIENCE = 'https://console.cloud.google.com/auth/audience?project=riff-catalog';

function OwnerView({ data, version, accessToken }) {
  const [picked, setPicked] = useState(null);   // an email the owner tapped in the People table
  const [one, setOne] = useState({ kind: 'idle', data: null });
  const [readIds, setReadIds] = useState(() => new Set());   // requests marked read during this visit
  const [readAll, setReadAll] = useState(false);
  const [readBusy, setReadBusy] = useState(false);
  const [readErr, setReadErr] = useState('');
  const [over, setOver] = useState({});   // tag / archive changes made during this visit, shown at once and saved in the background
  const [tagPick, setTagPick] = useState(() => new Set());
  const [archiveOpen, setArchiveOpen] = useState(false);
  const saveChain = useRef(Promise.resolve());
  const changeSupport = (id, patch, baseRow) => {
    const before = over[id];
    // Remember whether the request was archived when this visit began, and its row if it came from the "all requests" page.
    const base = before ? before.base : (baseRow ? isArchivedRow(baseRow) : false);
    const row = before?.row || baseRow;
    setOver(prev => ({ ...prev, [id]: { ...prev[id], ...patch, base, row } }));
    if (patch.archived) setReadIds(prev => new Set([...prev, id]));
    setReadErr('');
    const body = { kind: 'supportupdate', accessToken, id, ...(patch.tags !== undefined ? { tags: patch.tags.split(',').filter(Boolean) } : {}), ...(patch.archived !== undefined ? { archived: patch.archived } : {}) };
    saveChain.current = saveChain.current.then(async () => {
      try {
        const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('save');
        const j = await res.json();
        try { window.dispatchEvent(new CustomEvent('rc-support-unread', { detail: { unread: j.unread } })); } catch { /* ignore */ }
      } catch {
        setOver(prev => { const n = { ...prev }; if (before) n[id] = before; else delete n[id]; return n; });
        setReadErr('Couldn\u2019t save that change, so it was undone. Try again in a minute.');
      }
    });
  };
  const setTags = (id, list, baseRow) => changeSupport(id, { tags: SUPPORT_TAGS.filter(t => list.includes(t)).join(',') }, baseRow);
  const setArchived = (id, archived, baseRow) => changeSupport(id, { archived }, baseRow);
  const markRead = async (ids, all) => {
    setReadBusy(true); setReadErr('');
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'supportread', accessToken, ids, all }) });
      if (!res.ok) { setReadErr('Couldn\u2019t mark that as read. Try again in a minute.'); return; }
      const j = await res.json();
      if (all) setReadAll(true); else setReadIds(prev => new Set([...prev, ...ids]));
      try { window.dispatchEvent(new CustomEvent('rc-support-unread', { detail: { unread: j.unread } })); } catch { /* ignore */ }
    } catch { setReadErr('Couldn\u2019t mark that as read. Try again in a minute.'); } finally { setReadBusy(false); }
  };
  useEffect(() => {
    if (!picked) return undefined;
    let live = true;
    setOne({ kind: 'loading', data: null });
    (async () => {
      try {
        const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'person', accessToken, target: picked }) });
        if (!live) return;
        if (!res.ok) { setOne({ kind: 'error', data: null }); return; }
        setOne({ kind: 'ready', data: await res.json() });
      } catch { if (live) setOne({ kind: 'error', data: null }); }
    })();
    return () => { live = false; };
  }, [picked, accessToken]);
  const links = (data && data.sheetLinks) || {};
  const m = useMemo(() => {
    if (!data) return null;
    const users = toObjects(data.stats);
    const feedback = toObjects(data.feedback).reverse();
    const errors = toObjects(data.errors).reverse();
    const history = toObjects(data.history);
    const diags = toObjects(data.diagnostics).reverse();
    const now = ptNowMs();
    const within = (s, days) => { const t = ptMs(s); return Number.isFinite(t) && now - t <= days * 86400000; };
    const active7 = users.filter(u => within(u['Last login (PT)'], 7)).length;
    const active1 = users.filter(u => within(u['Last login (PT)'], 1)).length;
    const rated = feedback.map(f => num(f['Rating'])).filter(Boolean);
    const days = new Map();
    for (const r of history) { const d = String(r['Date (PT)']).slice(0, 10); if (!days.has(d)) days.set(d, new Set()); days.get(d).add(String(r['Email']).toLowerCase()); }
    const line = [...days].sort((a, b) => a[0].localeCompare(b[0])).slice(-30).map(([label, set]) => ({ label: label.slice(5), value: set.size }));
    const tabViews = Object.keys(users[0] || {}).filter(k => k.startsWith('Views: ')).map(k => ({ label: k.slice(7) === 'Feedback' ? 'Support' : k.slice(7), value: sumCol(users, k) })).filter(x => x.value).sort((a, b) => b.value - a.value);
    const upSec = sumCol(users, 'Upload seconds total'), upN = sumCol(users, 'Uploads timed');
    const listMs = users.map(u => num(u['Drive list ms (last)'])).filter(Boolean);
    const codes = tally(errors.filter(e => within(e['Date (PT)'], 30)), e => `${e['Area']} · ${e['Code']}`);
    const errCount = errors.filter(e => within(e['Date (PT)'], 7)).reduce((a, e) => a + (num(e['Times']) || 1), 0);
    // "Needs attention": plain sentences for the owner. Nothing here is a score; it's a prompt to go look.
    const verCmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
    const older = version ? users.filter(u => String(u['App version'] || '').trim() && verCmp(u['App version'], version) < 0) : [];
    const away = users.filter(u => { const t = ptMs(u['Last login (PT)']); return Number.isFinite(t) && now - t > 14 * 86400000; });
    const errIn = (from, to) => errors.filter(e => { const t = ptMs(e['Date (PT)']); return Number.isFinite(t) && now - t > from * 86400000 && now - t <= to * 86400000; }).reduce((a, e) => a + (num(e['Times']) || 1), 0);
    const errThis = errIn(-1, 7), errPrev = errIn(7, 14);
    const newFb = feedback.filter(f => within(f['Date (PT)'], 7));
    const lowFb = newFb.filter(f => num(f['Rating']) && num(f['Rating']) <= 2.5);
    const newDiag = diags.filter(d => within(d['Date (PT)'], 7));
    const names = (list) => list.slice(0, 3).map(u => u['Email']).join(', ') + (list.length > 3 ? ` and ${list.length - 3} more` : '');
    // New people per week and who comes back. Days used come from each person's daily history plus their first and last visit.
    const dayOf = (str) => Math.floor(Date.parse(`${String(str || '').slice(0, 10)}T00:00:00Z`) / 86400000);
    const usedDays = new Map();
    const addDay = (email, str) => { const n = dayOf(str); if (!email || !Number.isFinite(n)) return; if (!usedDays.has(email)) usedDays.set(email, new Set()); usedDays.get(email).add(n); };
    for (const r of history) addDay(String(r['Email']).toLowerCase(), r['Date (PT)']);
    for (const u of users) { addDay(String(u['Email']).toLowerCase(), u['First login (PT)']); addDay(String(u['Email']).toLowerCase(), u['Last login (PT)']); }
    const todayDay = Math.floor(now / 86400000);
    const iso = (n) => new Date(n * 86400000).toISOString().slice(5, 10);
    const newByWeek = [];
    for (let k = 7; k >= 0; k--) {
      const end = todayDay - 7 * k, start = end - 6;
      newByWeek.push({ label: `${iso(start)} \u2013 ${iso(end)}`, value: users.filter(u => { const f = dayOf(u['First login (PT)']); return f >= start && f <= end; }).length });
    }
    const firstOf = (u) => dayOf(u['First login (PT)']);
    const elig1 = users.filter(u => firstOf(u) <= todayDay - 1), elig7 = users.filter(u => firstOf(u) <= todayDay - 7);
    const back1 = elig1.filter(u => usedDays.get(String(u['Email']).toLowerCase())?.has(firstOf(u) + 1)).length;
    const back7 = elig7.filter(u => { const d = usedDays.get(String(u['Email']).toLowerCase()) || new Set(); for (let i = 1; i <= 7; i++) if (d.has(firstOf(u) + i)) return true; return false; }).length;
    const retention = { newByWeek, back1, elig1: elig1.length, back7, elig7: elig7.length };
    // A request un-archived on the "all requests" page comes back into the main list straight away.
    const have = new Set(toObjects(data.support).map(r => String(r['ID'])));
    const revived = Object.values(over).filter(o => o.archived === false && o.row && !have.has(String(o.row['ID']))).map(o => o.row);
    const support = [...toObjects(data.support), ...revived].sort((a, b) => String(a['Date (PT)']).localeCompare(String(b['Date (PT)']))).reverse()
      .map(r => { const o = over[String(r['ID'])]; return o ? { ...r, ...(o.tags !== undefined ? { Tags: o.tags } : {}), ...(o.archived !== undefined ? { Archived: o.archived ? 'Yes' : '' } : {}) } : r; })
      .filter(r => !isArchivedRow(r))
      .map(r => (readAll || readIds.has(String(r['ID']))) && isNewStatus(r) ? { ...r, Status: 'Read' } : r);
    const unreadSupport = support.filter(isNewStatus);
    const alerts = [];
    if (unreadSupport.length) alerts.push({ tab: 'Support', text: `${unreadSupport.length} unread support ${unreadSupport.length === 1 ? 'request' : 'requests'}` });
    const totalPeople = (data.totals && data.totals.people) || users.length;
    if (totalPeople >= SIGNIN_CAP) alerts.push({ href: CONSOLE_AUDIENCE, hrefText: 'Open Google\u2019s Audience page', text: `${totalPeople} people have signed in, which is at or past the 100-user limit Google lists. It shouldn\u2019t apply to this app\u2019s permission type, but check that new people can still sign in.` });
    else if (totalPeople >= Math.floor(SIGNIN_CAP * 0.8)) alerts.push({ href: CONSOLE_AUDIENCE, hrefText: 'Open Google\u2019s Audience page', text: `${totalPeople} of the 100 sign-ins Google lists as a limit. It shouldn\u2019t apply to this app\u2019s permission type, but check the Audience page before it matters.` });
    if (older.length) alerts.push({ tab: 'Stats', text: `${older.length} ${older.length === 1 ? 'person is' : 'people are'} on an older version than ${version}: ${names(older)}` });
    if (away.length) alerts.push({ tab: 'Stats', text: `${away.length} ${away.length === 1 ? 'person hasn\u2019t' : 'people haven\u2019t'} opened the app in over 14 days: ${names(away)}` });
    if (errThis >= 3 && errThis > errPrev) alerts.push({ tab: 'Errors', text: `Problems are up: ${errThis} in the last 7 days, ${errPrev} in the 7 days before` });
    if (newFb.length) alerts.push({ tab: 'Feedback', text: `${newFb.length} new feedback ${newFb.length === 1 ? 'entry' : 'entries'} in the last 7 days${lowFb.length ? `, ${lowFb.length} rated 2.5 or lower` : ''}` });
    if (newDiag.length) alerts.push({ tab: 'Diagnostics', text: `${newDiag.length} diagnostic ${newDiag.length === 1 ? 'report' : 'reports'} in the last 7 days` });
    return {
      alerts, support, unreadSupport, totalPeople, retention, users, feedback, errors, diags, active7, active1, line, tabViews, codes, errCount,
      avgRating: rated.length ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10 : null, ratedN: rated.length,
      clips: sumCol(users, 'Clip library size'), sessions: sumCol(users, 'Sessions'), minutes: Math.round(sumCol(users, 'Active minutes')),
      versions: tally(users, u => u['App version']), devices: tally(users, u => u['Device']), os: tally(users, u => u['OS version']), screens: tally(users, u => realPx(u['Screen'])),
      countries: tally(users, u => u['Country']), topTab: tally(users, u => u['Most used tab']),
      funnel: MILESTONES.map(([k, label]) => ({ label, value: users.filter(u => String(u[k] || '').trim()).length })),
      features: FEATURES.map(([k, label]) => ({ label, value: sumCol(users, k) })).filter(x => x.value).sort((a, b) => b.value - a.value),
      avgUpload: upN ? Math.round((upSec / upN) * 10) / 10 : null, avgList: listMs.length ? Math.round(listMs.reduce((a, b) => a + b, 0) / listMs.length) : null,
      failures: { upload: sumCol(users, 'Upload failures'), settings: sumCol(users, 'Settings save failures'), reauth: sumCol(users, 'Drive reconnects needed'), mic: sumCol(users, 'Mic denied') + sumCol(users, 'Mic errors (other)'), audio: sumCol(users, 'Audio blocked') },
      when: [['Morning', 'Recorded: morning'], ['Afternoon', 'Recorded: afternoon'], ['Evening', 'Recorded: evening'], ['Night', 'Recorded: night']].map(([label, k]) => ({ label, value: sumCol(users, k) })),
      lengths: [['Under 30 sec', 'Takes under 30s'], ['30 sec - 2 min', 'Takes 30s-2min'], ['2 - 5 min', 'Takes 2-5min'], ['Over 5 min', 'Takes over 5min']].map(([label, k]) => ({ label, value: sumCol(users, k) })),
      installed: [{ label: 'Installed app', value: sumCol(users, 'Sessions installed') }, { label: 'In a browser', value: sumCol(users, 'Sessions in browser') }],
    };
  }, [data, version, readIds, readAll, over]);
  const visibleSupport = m ? [...m.unreadSupport, ...m.support.filter(r => !isNewStatus(r))].filter(r => passesTags(r, tagPick)) : [];
  // Totals from the server, adjusted for archive changes made during this visit.
  const serverArchived = (data && data.totals && data.totals.supportArchived) || 0;
  const archivedCount = Math.max(0, serverArchived + Object.values(over).reduce((n, o) => (o.archived === undefined ? n : n + (o.archived ? 1 : 0) - (o.base ? 1 : 0)), 0));
  const totalSupport = (data && data.totals && data.totals.supportAll) || (m ? m.support.length : 0);
  if (archiveOpen && !picked) {
    return <SupportArchive accessToken={accessToken} over={over} onTags={setTags} onArchive={setArchived} onRead={markRead} readIds={readIds} readAll={readAll} busy={readBusy} onPick={setPicked} onBack={() => setArchiveOpen(false)} />;
  }
  if (picked) {
    return (
      <>
        <button onClick={() => setPicked(null)} style={{ padding: '8px 14px', marginBottom: '12px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', border: '1px solid var(--rc-line)', cursor: 'pointer', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)' }}>{'\u2190'} Back to everyone</button>
        {one.kind === 'loading' && <div style={{ ...card, ...sub }}>Loading {picked}…</div>}
        {one.kind === 'error' && <div role="alert" style={{ ...card, color: '#d93025', fontWeight: '600' }}>Couldn’t load that person right now. Go back and try again in a minute.</div>}
        {one.kind === 'ready' && <MyView data={one.data} who={picked} />}
      </>
    );
  }
  return (
      <>
          <div style={card}>
            <h3 style={h}>Needs attention</h3>
            {m.alerts.length === 0 && <div style={sub}>{'\u2713'} Nothing needs attention right now.</div>}
            {m.alerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', lineHeight: 1.5, marginBottom: '6px' }}>
                <span aria-label="Attention" style={{ flex: '0 0 auto', fontWeight: '700' }}>{'\u25B2'}</span>
                <span>{a.text}{a.href && <> <a href={a.href} target="_blank" rel="noopener noreferrer" style={{ color: BLUE, whiteSpace: 'nowrap' }}>{a.hrefText} {'\u2197'}</a></>}{links[a.tab] && <> <a href={links[a.tab]} target="_blank" rel="noopener noreferrer" style={{ color: BLUE, whiteSpace: 'nowrap' }}>Open {a.tab} sheet {'\u2197'}</a></>}</span>
              </div>
            ))}
            {links.Sheet && <div style={{ marginTop: '8px', fontSize: '13px' }}><a href={links.Sheet} target="_blank" rel="noopener noreferrer" style={{ color: BLUE, fontWeight: '600' }}>Open the spreadsheet {'\u2197'}</a></div>}
          </div>

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <h3 style={{ ...h, margin: 0 }}>Support requests{m.unreadSupport.length ? ` (${m.unreadSupport.length} unread)` : ''}</h3>
              {m.unreadSupport.length > 1 && <button disabled={readBusy} onClick={() => markRead([], true)} style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '600', borderRadius: '8px', border: '1px solid var(--rc-line)', cursor: 'pointer', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)' }}>Mark all read</button>}
            </div>
            {m.support.length === 0 && <div style={sub}>{archivedCount > 0 ? 'No open support requests. Archived ones are under View all support requests.' : 'None yet. People send these from Support in the menu. Reply to them by email.'}</div>}
            {m.support.length > 0 && <div style={{ ...sub, marginBottom: '8px' }}>Reply by email to the address shown. Unread first. Archive a request to hide it here.</div>}
            {m.support.length > 0 && <TagFilter rows={m.support} picked={tagPick} setPicked={setTagPick} />}
            {readErr && <div role="alert" style={{ fontSize: '13px', color: '#d93025', fontWeight: '600', marginBottom: '8px' }}>{readErr}</div>}
            {visibleSupport.length === 0 && m.support.length > 0 && <div style={sub}>No open requests have that tag.</div>}
            {visibleSupport.slice(0, 25).map((r, i) => (
              <SupportItem key={String(r['ID']) || i} r={r} i={i} owner onPick={setPicked} onRead={markRead} busy={readBusy} accessToken={accessToken} onTags={setTags} onArchive={setArchived} />
            ))}
            {visibleSupport.length > 25 && <div style={{ ...sub, marginTop: '10px' }}>Showing the newest 25 of {visibleSupport.length}. The rest are under View all support requests.</div>}
            <div style={{ marginTop: '10px', fontSize: '13px' }}>
              <button type="button" onClick={() => setArchiveOpen(true)} style={{ background: 'none', border: 'none', padding: 0, color: BLUE, cursor: 'pointer', fontSize: '13px', fontWeight: '600', textDecoration: 'underline' }}>View all support requests</button>
              <span style={sub}> {'\u00B7'} {totalSupport} in total{archivedCount ? `, ${archivedCount} archived` : ''}</span>
            </div>
            {links.Support && <div style={{ marginTop: '10px', fontSize: '13px' }}><a href={links.Support} target="_blank" rel="noopener noreferrer" style={{ color: BLUE }}>Open Support sheet {'\u2197'}</a></div>}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            <Tile label="People" value={m.totalPeople} />
            <Tile label="Active in 7 days" value={m.active7} hint={`${m.active1} in the last day`} />
            <Tile label="Avg rating" value={m.avgRating ?? '–'} hint={m.ratedN ? `${m.ratedN} rating${m.ratedN === 1 ? '' : 's'}` : 'none yet'} />
            <Tile label="Clips in libraries" value={m.clips} />
            <Tile label="Sessions" value={m.sessions} hint={`${m.minutes} min open`} />
            <Tile label="Problems (7 days)" value={m.errCount} />
          </div>
          {m.totalPeople > m.users.length && <div style={{ ...sub, margin: '-6px 0 14px', lineHeight: 1.5 }}>The charts below use the {m.users.length} most recently active people (of {m.totalPeople}). The People list at the bottom covers everyone.</div>}

          <div style={card}>
            <h3 style={h}>People active per day</h3>
            <Line points={m.line} />
          </div>

          <div style={card}>
            <h3 style={h}>New people and coming back</h3>
            <div style={{ ...sub, marginBottom: '6px' }}>New people per week (first visit)</div>
            <Bars items={m.retention.newByWeek} max={8} />
            <div style={{ ...sub, margin: '12px 0 6px' }}>Came back</div>
            <KV rows={[
              ['The next day', m.retention.elig1 ? `${m.retention.back1} of ${m.retention.elig1}` : 'not enough time yet'],
              ['Within a week', m.retention.elig7 ? `${m.retention.back7} of ${m.retention.elig7}` : 'not enough time yet'],
            ]} />
            <div style={{ ...sub, marginTop: '8px', lineHeight: 1.5 }}>Based on the days each person used the app. Days before the daily history existed can’t be counted, so early numbers read low.</div>
          </div>

          <div style={card}>
            <h3 style={h}>Where new people get to</h3>
            <div style={{ ...sub, marginBottom: '8px' }}>Number of people who have done each thing at least once</div>
            <Bars items={m.funnel} max={9} total={m.users.length} />
          </div>

          <div style={card}>
            <h3 style={h}>What people use</h3>
            <div style={{ ...sub, marginBottom: '6px' }}>Section opens, all people</div>
            <Bars items={m.tabViews} max={10} />
            <div style={{ ...sub, margin: '12px 0 6px' }}>Feature use, all people</div>
            <Bars items={m.features} max={9} />
            <div style={{ ...sub, margin: '12px 0 6px' }}>Most-used section, people</div>
            <Bars items={m.topTab} max={6} />
          </div>

          <div style={card}>
            <h3 style={h}>Who and what they use</h3>
            <div style={{ ...sub, marginBottom: '6px' }}>App version</div><Bars items={m.versions} max={6} />
            <div style={{ ...sub, margin: '12px 0 6px' }}>Device</div><Bars items={m.devices} max={6} />
            <div style={{ ...sub, margin: '12px 0 6px' }}>System version</div><Bars items={m.os} max={6} />
            <div style={{ ...sub, margin: '12px 0 6px' }}>Screen (real pixels)</div><Bars items={m.screens} max={6} />
            <div style={{ ...sub, margin: '12px 0 6px' }}>Country</div><Bars items={m.countries} max={6} />
            <div style={{ ...sub, margin: '12px 0 6px' }}>Visits: installed app or browser</div><Bars items={m.installed} max={2} />
          </div>

          <div style={card}>
            <h3 style={h}>Recording habits</h3>
            <div style={{ ...sub, marginBottom: '6px' }}>Time of day</div><Bars items={m.when} max={4} />
            <div style={{ ...sub, margin: '12px 0 6px' }}>Take length</div><Bars items={m.lengths} max={4} />
          </div>

          <div style={card}>
            <h3 style={h}>Speed and reliability</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              <Tile label="Avg upload" value={m.avgUpload != null ? `${m.avgUpload}s` : '–'} />
              <Tile label="Avg Drive list" value={m.avgList != null ? `${m.avgList} ms` : '–'} />
            </div>
            <Bars items={[
              { label: 'Upload failures', value: m.failures.upload }, { label: 'Settings save failures', value: m.failures.settings }, { label: 'Drive reconnects', value: m.failures.reauth },
              { label: 'Microphone problems', value: m.failures.mic }, { label: 'Sound could not start', value: m.failures.audio },
            ].filter(x => x.value)} max={5} empty="No failures recorded." />
          </div>

          <div style={card}>
            <h3 style={h}>Problems, last 30 days</h3>
            <Bars items={m.codes} max={8} empty="No problems logged." />
            {m.errors.length > 0 && (
              <div style={{ marginTop: '12px', fontSize: '12px', lineHeight: 1.5 }}>
                <div style={{ ...sub, marginBottom: '4px' }}>Latest</div>
                {m.errors.slice(0, 10).map((e, i) => (
                  <div key={i} style={{ fontFamily: '"Courier New", monospace', fontSize: '11px', marginBottom: '3px' }}>
                    {String(e['Date (PT)']).slice(5, 16)} · {e['Email']} · v{e['App version']} · {e['Area']} · {e['Code']}{e['Screen'] ? ` · ${e['Screen']}` : ''}{num(e['Times']) > 1 ? ` ×${e['Times']}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <h3 style={h}>Feedback ({m.feedback.length})</h3>
            {m.feedback.length === 0 && <div style={sub}>None yet.</div>}
            {m.feedback.slice(0, 20).map((f, i) => (
              <div key={i} style={{ borderTop: i ? '1px solid var(--rc-line)' : 'none', paddingTop: i ? '10px' : 0, marginTop: i ? '10px' : 0, fontSize: '13px', lineHeight: 1.5 }}>
                <div><strong>{f['Rating']} / 5</strong> <span style={sub}>· {f['Email']} · {String(f['Date (PT)']).slice(0, 16)} · v{f['App version']} · {f['Country']} {f['Region']}</span></div>
                {[['Useful', f['Liked']], ['Dislikes', f['Disliked']], ['Ideas', f['Feature ideas']], ['Other', f['Feedback']]].filter(([, v]) => String(v || '').trim()).map(([k, v]) => (
                  <div key={k} style={{ whiteSpace: 'pre-wrap' }}><span style={sub}>{k}: </span>{v}</div>
                ))}
              </div>
            ))}
          </div>

          <div style={card}>
            <h3 style={h}>Diagnostic reports ({m.diags.length})</h3>
            {m.diags.length === 0 && <div style={sub}>None yet.</div>}
            {m.diags.slice(0, 10).map((d, i) => (
              <div key={i} style={{ borderTop: i ? '1px solid var(--rc-line)' : 'none', paddingTop: i ? '10px' : 0, marginTop: i ? '10px' : 0, fontSize: '13px', lineHeight: 1.5 }}>
                <div style={sub}>{String(d['Date (PT)']).slice(0, 16)} · {d['Email']} · v{d['App version']} · {d['Device']} {d['OS version']} · {d['Browser']} · online {d['Online']} · {d['Offline clips waiting'] || 0} waiting</div>
                {String(d['Note'] || '').trim() && <div style={{ whiteSpace: 'pre-wrap' }}>{d['Note']}</div>}
                {String(d['Recent problems'] || '').trim() && <div style={{ fontFamily: '"Courier New", monospace', fontSize: '11px', whiteSpace: 'pre-wrap', marginTop: '3px' }}>{d['Recent problems']}</div>}
              </div>
            ))}
          </div>

          <PeopleList accessToken={accessToken} total={m.totalPeople} onPick={setPicked} />

          <TestersCard accessToken={accessToken} />
      </>
  );
}


// Owner only: who sees the Testing section in the menu. The owner always does; everyone else only while listed here.
function TestersCard({ accessToken }) {
  const [list, setList] = useState(null);   // null = loading
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const post = async (body) => {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken, ...body }) });
    let j = null; try { j = await res.json(); } catch { /* no body */ }
    return { res, j };
  };
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { res, j } = await post({ kind: 'testers' });
        if (!live) return;
        if (res.ok && Array.isArray(j?.testers)) setList(j.testers); else { setList([]); setMsg('Couldn\u2019t load the tester list.'); }
      } catch { if (live) { setList([]); setMsg('Couldn\u2019t load the tester list.'); } }
    })();
    return () => { live = false; };
  }, [accessToken]);
  const change = async (addr, on) => {
    setBusy(true); setMsg('');
    try {
      const { res, j } = await post({ kind: 'testerset', email: addr, on });
      if (res.ok && Array.isArray(j?.testers)) { setList(j.testers); if (on) setEmail(''); setMsg(j.changed ? (on ? 'Added.' : 'Removed.') : (on ? 'Already on the list.' : 'Wasn\u2019t on the list.')); }
      else if (res.status === 400) setMsg('That doesn\u2019t look like an email address.');
      else if (res.status === 422) setMsg('The list is full (200 people). Remove someone first.');
      else setMsg('Couldn\u2019t save that. Please try again.');
    } catch { setMsg('Couldn\u2019t save that. Please try again.'); }
    setBusy(false);
  };
  return (
    <div style={card}>
      <h3 style={h}>🧪 Testers</h3>
      <div style={{ ...sub, marginBottom: '10px' }}>People listed here see a Testing item in their menu (use the Google account email they sign in with). It appears the next time they open the app. You always see it.</div>
      <form onSubmit={e => { e.preventDefault(); if (email.trim() && !busy) change(email, true); }} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@gmail.com" aria-label="Tester email"
          style={{ flex: 1, minWidth: 0, padding: '8px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--rc-line)', background: 'var(--rc-card)', color: 'var(--rc-ink)' }} />
        <button type="submit" disabled={busy || !email.trim()} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: BLUE, color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Add</button>
      </form>
      {msg && <div style={{ ...sub, marginBottom: '8px' }} role="status">{msg}</div>}
      {list === null ? <div style={sub}>Loading…</div> : list.length === 0 ? <div style={sub}>No testers yet.</div> : list.map(t => (
        <div key={t.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid var(--rc-line)', padding: '8px 0', fontSize: '13px' }}>
          <span style={{ overflowWrap: 'anywhere' }}>{t.email}</span>
          <button onClick={() => change(t.email, false)} disabled={busy} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--rc-line)', background: 'none', color: 'var(--rc-ink)', fontSize: '12px', cursor: 'pointer' }}>Remove</button>
        </div>
      ))}
    </div>
  );
}

const MS_LABELS = [['First recording (PT)', 'Made a recording'], ['First Drive save (PT)', 'Saved to Drive'], ['First Library open (PT)', 'Opened the Library'], ['First Jam play (PT)', 'Played Jam'],
  ['First Key Finder use (PT)', 'Used Key Finder'], ['First Practice use (PT)', 'Used Practice'], ['First Randomizer use (PT)', 'Used the Randomizer'], ['First idea saved (PT)', 'Saved an idea'], ['First feedback sent (PT)', 'Sent feedback']];

const NOTE_COLOR_KEYS = [['Root', 'Root note color'], ['3rd', '3rd note color'], ['5th', '5th note color'], ['Other', 'Other note color']];

function KV({ rows }) {
  return (
    <div style={{ fontSize: '13px', lineHeight: 1.7 }}>
      {rows.filter(([, v]) => String(v ?? '').trim()).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid var(--rc-line)' }}>
          <span style={{ color: 'var(--rc-ink2)' }}>{k}</span><span style={{ textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// 30 small squares, today on the right; filled = you used the app that day (from your own daily history).
function DaysStrip({ days }) {
  const todayMs = ptNowMs();
  const cells = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayMs - i * 86400000).toISOString().slice(0, 10);
    cells.push({ d, on: days.has(d) });
  }
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: '4px' }}>
        {cells.map(c => <div key={c.d} title={`${c.d}${c.on ? ': used the app' : ''}`} style={{ aspectRatio: '1', borderRadius: '4px', backgroundColor: c.on ? BLUE : 'var(--rc-line)' }} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...sub, marginTop: '4px' }}><span>30 days ago</span><span>today</span></div>
    </div>
  );
}

const tidy = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => String(v ?? '').trim() !== ''));

// Saves the person's own numbers as a file. Built only from the rows already on screen (their own).
async function saveMyData(data) {
  const out = {
    about: 'The numbers Riff Catalog keeps about you. Your recordings, lyrics and clip names are never part of this.',
    exported: new Date().toISOString(),
    summary: tidy(toObjects(data.stats)[0] || {}),
    daysUsed: toObjects(data.history).map(r => String(r['Date (PT)']).slice(0, 10)),
    feedbackSent: toObjects(data.feedback).map(tidy),
    problemLog: toObjects(data.errors).map(tidy),
    diagnosticReportsSent: toObjects(data.diagnostics).map(tidy),
    supportRequestsSent: toObjects(data.support).map(tidy),
  };
  const file = new File([JSON.stringify(out, null, 2)], 'riff-catalog-my-data.json', { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'My Riff Catalog data' }); return 'Ready to save or send from the share sheet.'; }
  } catch (e) { if (e && e.name === 'AbortError') return ''; /* otherwise fall through to a normal download */ }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'Downloaded riff-catalog-my-data.json';
}

// Only ever fed the signed-in person's own rows (the server filters before sending).
function MyView({ data, who }) {
  const [showAllSupport, setShowAllSupport] = useState(false);
  const m = useMemo(() => {
    const u = toObjects(data.stats)[0] || null;
    const days = new Set(toObjects(data.history).map(r => String(r['Date (PT)']).slice(0, 10)));
    if (u && String(u['Last login (PT)'] || '').trim()) days.add(String(u['Last login (PT)']).slice(0, 10));
    return {
      support: toObjects(data.support).reverse(), u, days, feedback: toObjects(data.feedback).reverse(), errors: toObjects(data.errors).reverse(), diags: toObjects(data.diagnostics).reverse(),
      tabViews: u ? Object.keys(u).filter(k => k.startsWith('Views: ')).map(k => ({ label: k.slice(7), value: num(u[k]) })).filter(x => x.value).sort((a, b) => b.value - a.value) : [],
      features: u ? FEATURES.map(([k, label]) => ({ label, value: num(u[k]) })).filter(x => x.value).sort((a, b) => b.value - a.value) : [],
      when: u ? [['Morning', 'Recorded: morning'], ['Afternoon', 'Recorded: afternoon'], ['Evening', 'Recorded: evening'], ['Night', 'Recorded: night']].map(([label, k]) => ({ label, value: num(u[k]) })) : [],
      lengths: u ? [['Under 30 sec', 'Takes under 30s'], ['30 sec - 2 min', 'Takes 30s-2min'], ['2 - 5 min', 'Takes 2-5min'], ['Over 5 min', 'Takes over 5min']].map(([label, k]) => ({ label, value: num(u[k]) })) : [],
      codes: tally(toObjects(data.errors), e => `${e['Area']} · ${e['Code']}`),
    };
  }, [data]);
  const [saveMsg, setSaveMsg] = useState('');
  const u = m.u;
  if (!u) return <div style={{ ...card, ...sub }}>No numbers have been recorded for you yet. Open the app a couple of times, then check back here.</div>;
  const done = MS_LABELS.filter(([k]) => String(u[k] || '').trim());
  return (
    <>
      <div style={{ ...card, ...sub, lineHeight: 1.5 }}>{who
        ? <>Owner view of <strong style={{ color: 'var(--rc-ink)' }}>{who}</strong>, as they see it on their own Dashboard.</>
        : <>This page shows only the numbers kept about <strong style={{ color: 'var(--rc-ink)' }}>you</strong>. Nobody else’s numbers are ever shown here.</>}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
        <Tile label="Visits" value={num(u['Sessions'])} hint={`first on ${String(u['First login (PT)']).slice(0, 10)}`} />
        <Tile label="Days you used it" value={num(u['Days active']) || m.days.size} />
        <Tile label="Clips in your library" value={num(u['Clip library size'])} />
        <Tile label="Minutes open" value={Math.round(num(u['Active minutes']))} />
        <Tile label="Ideas saved" value={num(u['Song ideas saved'])} />
        <Tile label="Custom beats" value={num(u['Custom drum beats'])} />
      </div>

      <div style={card}>
        <h3 style={h}>The last 30 days</h3>
        <DaysStrip days={m.days} />
      </div>

      <div style={card}>
        <h3 style={h}>Your firsts ({done.length} of {MS_LABELS.length})</h3>
        {MS_LABELS.map(([k, label]) => {
          const when = String(u[k] || '').trim();
          return (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', lineHeight: 1.8, borderBottom: '1px solid var(--rc-line)' }}>
              <span>{when ? '✓ ' : '○ '}{label}</span><span style={sub}>{when ? when.slice(0, 10) : 'not yet'}</span>
            </div>
          );
        })}
      </div>

      <div style={card}>
        <h3 style={h}>What you use</h3>
        <div style={{ ...sub, marginBottom: '6px' }}>Section opens</div>
        <Bars items={m.tabViews} max={10} />
        <div style={{ ...sub, margin: '12px 0 6px' }}>Feature use</div>
        <Bars items={m.features} max={9} />
      </div>

      <div style={card}>
        <h3 style={h}>How you record</h3>
        <div style={{ ...sub, marginBottom: '6px' }}>Time of day</div><Bars items={m.when} max={4} />
        <div style={{ ...sub, margin: '12px 0 6px' }}>Take length</div><Bars items={m.lengths} max={4} />
      </div>

      <div style={card}>
        <h3 style={h}>Speed and problems</h3>
        <KV rows={[
          ['Average upload', num(u['Avg upload (sec)']) ? `${u['Avg upload (sec)']} s` : ''], ['Drive listing (last)', num(u['Drive list ms (last)']) ? `${u['Drive list ms (last)']} ms` : ''],
          ['Upload failures', num(u['Upload failures']) || ''], ['Settings save failures', num(u['Settings save failures']) || ''], ['Drive reconnects needed', num(u['Drive reconnects needed']) || ''],
          ['Microphone problems', (num(u['Mic denied']) + num(u['Mic errors (other)'])) || ''], ['Sound could not start', num(u['Audio blocked']) || ''], ['Recordings waiting on this device', num(u['Offline clips waiting']) || ''],
        ]} />
        <div style={{ ...sub, margin: '12px 0 6px' }}>Problem log</div>
        <Bars items={m.codes} max={6} empty="No problems logged for you." />
      </div>

      {NOTE_COLOR_KEYS.some(([, col]) => /^#[0-9a-f]{6}$/i.test(String(u[col] || ''))) && (
        <div style={card}>
          <h3 style={h}>{who ? 'Their note colors' : 'Your note colors'}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {NOTE_COLOR_KEYS.map(([label, col]) => {
              const hex = String(u[col] || '');
              const ok = /^#[0-9a-f]{6}$/i.test(hex);
              return (
                <div key={col} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                  <div aria-label={ok ? `${label} note color ${hex}` : `${label}: not set`} style={{ height: '48px', borderRadius: '8px', border: '1px solid var(--rc-line)', backgroundColor: ok ? hex : 'transparent' }} />
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--rc-ink2)' }}>{ok ? hex.toUpperCase() : 'not set'}</div>
                </div>
              );
            })}
          </div>
          <div style={{ ...sub, marginTop: '8px' }}>{u['Custom note colors'] === 'Yes' ? 'Using custom colors.' : u['Custom note colors'] === 'No' ? 'Using the default colors.' : ''}</div>
        </div>
      )}

      <div style={card}>
        <h3 style={h}>Your device</h3>
        <KV rows={[['Device', u['Device model'] || u['Device']], ['System', u['OS version']], ['Browser', u['Browser']], ['Screen', u['Screen'] ? `${realPx(u['Screen'])} (${u['Screen']})` : ''], ['Installed app', u['Installed app']],
          ['App version', u['App version']], ['Previous version', u['Previous version']], ['Time zone', u['Time zone']], ['Language', u['Language']], ['Where (from your connection)', `${u['Country']} ${u['Region']}`.trim()],
          ['Storage used by the app', num(u['Device storage used (MB)']) ? `${u['Device storage used (MB)']} MB` : ''], ['Last visit', u['Last login (PT)']]]} />
      </div>

      <div style={card}>
        <h3 style={h}>Feedback you sent ({m.feedback.length})</h3>
        {m.feedback.length === 0 && <div style={sub}>None yet. The Support section in the menu is where to send it.</div>}
        {m.feedback.slice(0, 10).map((f, i) => (
          <div key={i} style={{ borderTop: i ? '1px solid var(--rc-line)' : 'none', paddingTop: i ? '10px' : 0, marginTop: i ? '10px' : 0, fontSize: '13px', lineHeight: 1.5 }}>
            <div><strong>{f['Rating']} / 5</strong> <span style={sub}>· {String(f['Date (PT)']).slice(0, 16)} · v{f['App version']}</span></div>
            {[['Useful', f['Liked']], ['Dislikes', f['Disliked']], ['Ideas', f['Feature ideas']], ['Other', f['Feedback']]].filter(([, v]) => String(v || '').trim()).map(([k, v]) => (
              <div key={k} style={{ whiteSpace: 'pre-wrap' }}><span style={sub}>{k}: </span>{v}</div>
            ))}
          </div>
        ))}
      </div>

      <div style={card}>
        <h3 style={h}>{who ? `Support requests they sent (${m.support.length})` : `Support requests you sent (${m.support.length})`}</h3>
        {m.support.length === 0 && <div style={sub}>None yet. Use Support in the menu to ask for help.</div>}
        {m.support.slice(0, showAllSupport ? m.support.length : 10).map((r, i) => <SupportItem key={String(r['ID']) || i} r={r} i={i} />)}
        {m.support.length > 10 && !showAllSupport && <button onClick={() => setShowAllSupport(true)} style={{ ...smallBtn, marginTop: '10px' }}>Show all {m.support.length}</button>}
        {!who && m.support.some(r => tagsOf(r).length > 0) && <div style={{ ...sub, marginTop: '10px' }}>Tags are added by the app{'\u2019'}s owner to show where your request stands.</div>}
      </div>

      <div style={card}>
        <h3 style={h}>Diagnostic reports you sent ({m.diags.length})</h3>
        {m.diags.length === 0 && <div style={sub}>None yet. You can send one from Support › Debug.</div>}
        {m.diags.slice(0, 5).map((d, i) => (
          <div key={i} style={{ borderTop: i ? '1px solid var(--rc-line)' : 'none', paddingTop: i ? '10px' : 0, marginTop: i ? '10px' : 0, fontSize: '13px', lineHeight: 1.5 }}>
            <div style={sub}>{String(d['Date (PT)']).slice(0, 16)} · v{d['App version']} · {d['Device']} {d['OS version']}</div>
            {String(d['Note'] || '').trim() && <div style={{ whiteSpace: 'pre-wrap' }}>{d['Note']}</div>}
            {String(d['Recent problems'] || '').trim() && <div style={{ fontFamily: '"Courier New", monospace', fontSize: '11px', whiteSpace: 'pre-wrap', marginTop: '3px' }}>{d['Recent problems']}</div>}
          </div>
        ))}
      </div>

      {!who && (
      <div style={card}>
        <h3 style={h}>Your data</h3>
        <p style={{ ...sub, margin: '0 0 10px', lineHeight: 1.5 }}>Save everything shown on this page as a file. It contains only your own numbers, never your recordings, lyrics or clip names.</p>
        <button onClick={async () => setSaveMsg(await saveMyData(data))} style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: '600', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: BLUE, color: 'white' }}>Download my data</button>
        <div role="status" aria-live="polite" style={{ marginTop: '8px', fontSize: '13px', fontWeight: '600', color: '#1e8e3e', minHeight: '18px' }}>{saveMsg}</div>
      </div>
      )}
    </>
  );
}

export default function Dashboard({ accessToken, isOwner, version }) {
  const [pref, setPref] = useState(() => { try { return localStorage.getItem('rc_dash_mode') === 'me' ? 'me' : 'all'; } catch { return 'all'; } });
  const mode = isOwner ? pref : 'me';
  const [state, setState] = useState({ kind: 'loading', msg: '' });   // loading | ready | error
  const [data, setData] = useState(null);
  const pick = (v) => { setPref(v); try { localStorage.setItem('rc_dash_mode', v); } catch { /* ignore */ } };

  const load = async () => {
    if (!accessToken) { setState({ kind: 'error', msg: 'Connect to Google Drive first (tap the Drive banner at the top), then open this page again.' }); return; }
    setState({ kind: 'loading', msg: '' });
    const asked = mode;
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: asked === 'all' ? 'dashboard' : 'mydata', accessToken }) });
      if (res.status === 403) { setState({ kind: 'error', msg: 'The owner view is only for the app’s owner. If that’s you, check the OWNER_EMAIL setting in Netlify.' }); return; }
      if (res.status === 503) { setState({ kind: 'error', msg: 'The spreadsheet is busy right now (Google limits how fast it can be read). Please try again in a minute.' }); return; }
      if (!res.ok) { setState({ kind: 'error', msg: 'Couldn’t load the numbers right now. Please try again.' }); return; }
      setData({ ...(await res.json()), mode: asked });
      setState({ kind: 'ready', msg: '' });
    } catch { setState({ kind: 'error', msg: 'Couldn’t load the numbers right now. Please try again.' }); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [accessToken, mode]);

  const seg = (id, label) => (
    <button key={id} role="tab" aria-selected={mode === id} onClick={() => pick(id)}
      style={{ flex: 1, padding: '9px 6px', fontSize: '13px', fontWeight: '600', borderRadius: '10px', cursor: 'pointer',
        border: `2px solid ${mode === id ? BLUE : 'var(--rc-line)'}`, backgroundColor: mode === id ? 'var(--rc-sel)' : 'var(--rc-surface)', color: mode === id ? BLUE : 'var(--rc-ink)' }}>{label}</button>
  );
  const shown = data && data.mode === mode ? data : null;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {isOwner && <div role="tablist" style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>{seg('all', 'Owner')}{seg('me', 'My account')}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 12px' }}>
        <div style={sub}>{shown?.generated ? `Updated ${shown.generated} PT` : ' '}</div>
        <button onClick={load} disabled={state.kind === 'loading'} style={{ padding: '8px 14px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', border: '1px solid var(--rc-line)', cursor: 'pointer', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)' }}>
          {state.kind === 'loading' ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {state.kind === 'error' && <div role="alert" style={{ ...card, color: '#d93025', fontWeight: '600' }}>{state.msg}</div>}
      {state.kind === 'loading' && !shown && <div style={{ ...card, ...sub }}>Reading your numbers…</div>}

      {shown && state.kind !== 'error' && (mode === 'all' ? <OwnerView data={shown} version={version} accessToken={accessToken} /> : <MyView data={shown} />)}
    </div>
  );
}
