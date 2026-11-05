import { useEffect, useMemo, useState } from 'react';

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

export default function Dashboard({ accessToken }) {
  const [state, setState] = useState({ kind: 'loading', msg: '' });   // loading | ready | error
  const [data, setData] = useState(null);

  const load = async () => {
    if (!accessToken) { setState({ kind: 'error', msg: 'Connect to Google Drive first (tap the Drive banner at the top), then open this page again.' }); return; }
    setState({ kind: 'loading', msg: '' });
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'dashboard', accessToken }) });
      if (res.status === 403) { setState({ kind: 'error', msg: 'This page is only for the app’s owner. If that’s you, check the OWNER_EMAIL setting in Netlify.' }); return; }
      if (!res.ok) { setState({ kind: 'error', msg: 'Couldn’t load the numbers right now. Please try again.' }); return; }
      setData(await res.json());
      setState({ kind: 'ready', msg: '' });
    } catch { setState({ kind: 'error', msg: 'Couldn’t load the numbers right now. Please try again.' }); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [accessToken]);

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
    const tabViews = Object.keys(users[0] || {}).filter(k => k.startsWith('Views: ')).map(k => ({ label: k.slice(7), value: sumCol(users, k) })).filter(x => x.value).sort((a, b) => b.value - a.value);
    const upSec = sumCol(users, 'Upload seconds total'), upN = sumCol(users, 'Uploads timed');
    const listMs = users.map(u => num(u['Drive list ms (last)'])).filter(Boolean);
    const codes = tally(errors.filter(e => within(e['Date (PT)'], 30)), e => `${e['Area']} · ${e['Code']}`);
    const errCount = errors.filter(e => within(e['Date (PT)'], 7)).reduce((a, e) => a + (num(e['Times']) || 1), 0);
    return {
      users, feedback, errors, diags, active7, active1, line, tabViews, codes, errCount,
      avgRating: rated.length ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10 : null, ratedN: rated.length,
      clips: sumCol(users, 'Clip library size'), sessions: sumCol(users, 'Sessions'), minutes: Math.round(sumCol(users, 'Active minutes')),
      versions: tally(users, u => u['App version']), devices: tally(users, u => u['Device']), os: tally(users, u => u['OS version']),
      countries: tally(users, u => u['Country']), topTab: tally(users, u => u['Most used tab']),
      funnel: MILESTONES.map(([k, label]) => ({ label, value: users.filter(u => String(u[k] || '').trim()).length })),
      features: FEATURES.map(([k, label]) => ({ label, value: sumCol(users, k) })).filter(x => x.value).sort((a, b) => b.value - a.value),
      avgUpload: upN ? Math.round((upSec / upN) * 10) / 10 : null, avgList: listMs.length ? Math.round(listMs.reduce((a, b) => a + b, 0) / listMs.length) : null,
      failures: { upload: sumCol(users, 'Upload failures'), settings: sumCol(users, 'Settings save failures'), reauth: sumCol(users, 'Drive reconnects needed'), mic: sumCol(users, 'Mic denied') + sumCol(users, 'Mic errors (other)'), audio: sumCol(users, 'Audio blocked') },
      when: [['Morning', 'Recorded: morning'], ['Afternoon', 'Recorded: afternoon'], ['Evening', 'Recorded: evening'], ['Night', 'Recorded: night']].map(([label, k]) => ({ label, value: sumCol(users, k) })),
      lengths: [['Under 30 sec', 'Takes under 30s'], ['30 sec - 2 min', 'Takes 30s-2min'], ['2 - 5 min', 'Takes 2-5min'], ['Over 5 min', 'Takes over 5min']].map(([label, k]) => ({ label, value: sumCol(users, k) })),
      installed: [{ label: 'Installed app', value: sumCol(users, 'Sessions installed') }, { label: 'In a browser', value: sumCol(users, 'Sessions in browser') }],
    };
  }, [data]);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 12px' }}>
        <div style={sub}>{data?.generated ? `Updated ${data.generated} PT` : ' '}</div>
        <button onClick={load} disabled={state.kind === 'loading'} style={{ padding: '8px 14px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', border: '1px solid var(--rc-line)', cursor: 'pointer', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)' }}>
          {state.kind === 'loading' ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {state.kind === 'error' && <div role="alert" style={{ ...card, color: '#d93025', fontWeight: '600' }}>{state.msg}</div>}
      {state.kind === 'loading' && !m && <div style={{ ...card, ...sub }}>Reading your spreadsheet…</div>}

      {m && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            <Tile label="People" value={m.users.length} />
            <Tile label="Active in 7 days" value={m.active7} hint={`${m.active1} in the last day`} />
            <Tile label="Avg rating" value={m.avgRating ?? '–'} hint={m.ratedN ? `${m.ratedN} rating${m.ratedN === 1 ? '' : 's'}` : 'none yet'} />
            <Tile label="Clips in libraries" value={m.clips} />
            <Tile label="Sessions" value={m.sessions} hint={`${m.minutes} min open`} />
            <Tile label="Problems (7 days)" value={m.errCount} />
          </div>

          <div style={card}>
            <h3 style={h}>People active per day</h3>
            <Line points={m.line} />
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

          <div style={card}>
            <h3 style={h}>People ({m.users.length})</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '12px', width: '100%', minWidth: '560px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--rc-ink2)' }}>
                    {['Email', 'Last visit', 'Visits', 'Days', 'Clips', 'Device', 'Ver', 'Where'].map(c => <th key={c} style={{ padding: '4px 6px', borderBottom: '1px solid var(--rc-line)', fontWeight: '600' }}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {m.users.slice().sort((a, b) => String(b['Last login (PT)']).localeCompare(String(a['Last login (PT)']))).map(u => (
                    <tr key={u['Email']}>
                      {[u['Email'], String(u['Last login (PT)']).slice(5, 16), u['Sessions'], u['Days active'], u['Clip library size'], `${u['Device']} ${u['OS version']}`, u['App version'], `${u['Country']} ${u['Region']}`].map((c, i) => (
                        <td key={i} style={{ padding: '4px 6px', borderBottom: '1px solid var(--rc-line)', whiteSpace: 'nowrap' }}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
