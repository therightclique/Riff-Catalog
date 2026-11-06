import { useState } from 'react';
import { noteMilestone, sendDiagnostic, recentProblems } from './UsageLog';
import { sendOrQueue } from './UsageOutbox';

// Feedback section (own item in the main menu). Later this becomes Support, with feedback and support together.

const card = { backgroundColor: 'var(--rc-card)', border: '1px solid var(--rc-line)', borderRadius: '12px', padding: '16px', textAlign: 'left', lineHeight: 1.55, fontSize: '14px', color: 'var(--rc-ink)' };
const h3 = { fontSize: '15px', margin: '18px 0 6px', color: 'var(--rc-ink)' };
const p = { margin: '0 0 10px' };
const ul = { margin: '0 0 10px', paddingLeft: '20px' };
const li = { marginBottom: '4px' };
const note = { fontSize: '12px', color: 'var(--rc-ink2)', margin: '0 0 8px' };

const STAR_FULL = '#f5b301';

function Stars({ value, onChange, disabled }) {
  const star = (i) => {
    const fill = value >= i ? 100 : value >= i - 0.5 ? 50 : 0;
    return (
      <span key={i} style={{ position: 'relative', width: '44px', height: '44px', display: 'inline-block', fontSize: '40px', lineHeight: '44px', textAlign: 'center' }}>
        <span aria-hidden style={{ color: 'var(--rc-line)' }}>{'★'}</span>
        <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: `${fill}%`, overflow: 'hidden', whiteSpace: 'nowrap', color: STAR_FULL, textAlign: 'left', paddingLeft: '2px', boxSizing: 'border-box' }}>{'★'}</span>
        {[i - 0.5, i].map((v, k) => (
          <button key={v} type="button" disabled={disabled} onClick={() => onChange(v)} aria-label={`${v} star${v === 1 ? '' : 's'}`}
            style={{ position: 'absolute', top: 0, height: '100%', width: '50%', left: k === 0 ? 0 : '50%', background: 'none', border: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer', opacity: 0 }} />
        ))}
      </span>
    );
  };
  return <div role="group" aria-label="Star rating" style={{ display: 'flex', justifyContent: 'center', gap: '2px' }}>{[1, 2, 3, 4, 5].map(star)}</div>;
}

function FeedbackForm({ version, accessToken }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [liked, setLiked] = useState('');
  const [disliked, setDisliked] = useState('');
  const [ideas, setIdeas] = useState('');
  const [state, setState] = useState({ kind: 'idle', msg: '' });   // idle | sending | sent | error
  const sending = state.kind === 'sending';

  const send = async () => {
    if (!rating || sending) return;
    if (!accessToken) { setState({ kind: 'error', msg: 'Connect to Google Drive first (tap the Drive banner at the top), then try again.' }); return; }
    setState({ kind: 'sending', msg: '' });
    try {
      const out = await sendOrQueue('feedback', { rating, text: text.trim(), liked: liked.trim(), disliked: disliked.trim(), ideas: ideas.trim(), version }, accessToken);
      if (out === 'sent' || out === 'queued') {
        setState({ kind: 'sent', msg: out === 'sent' ? 'Thank you! Your feedback was sent.' : 'Thank you! Your feedback is saved on this device and will be sent automatically as soon as the server is reachable.' });
        noteMilestone('feedback'); setRating(0); setText(''); setLiked(''); setDisliked(''); setIdeas(''); return;
      }
      setState({ kind: 'error', msg: 'Couldn’t send. If your Google connection has expired, reconnect Drive and try again. Your message is still here.' });
    } catch {
      setState({ kind: 'error', msg: 'Couldn’t send right now. Your message is still here. Please try again.' });
    }
  };

  return (
    <div style={card}>
      <h3 style={{ ...h3, marginTop: 0 }}>How are we doing?</h3>
      <p style={p}>Tap a star to rate Riff Catalog out of 5. Tap the left half of a star for a half star.</p>
      <Stars value={rating} onChange={(v) => { setRating(v); if (state.kind === 'sent') setState({ kind: 'idle', msg: '' }); }} disabled={sending} />
      <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: '600', margin: '4px 0 14px', minHeight: '20px', color: rating ? 'var(--rc-ink)' : 'var(--rc-ink2)' }}>
        {rating ? `${rating} out of 5` : 'No rating yet'}
      </div>

      {[
        ['rc-fb-liked', 'Which features do you find most useful?', liked, setLiked, 'For example: the Jam beats, the Key Finder piano, saving ideas\u2026', 1000],
        ['rc-fb-disliked', 'Is there anything you dislike or find frustrating?', disliked, setDisliked, 'What gets in your way or feels off?', 1000],
        ['rc-fb-ideas', 'Any ideas for new features?', ideas, setIdeas, 'What would you love the app to do?', 1000],
        ['rc-feedback-text', 'Anything else you\u2019d like to tell us?', text, setText, 'Anything at all.', 2000],
      ].map(([id, label, val, set, ph, max]) => (
        <div key={id} style={{ marginBottom: '12px' }}>
          <label htmlFor={id} style={{ display: 'block', fontWeight: '600', marginBottom: '6px' }}>{label} <span style={{ fontWeight: '400', color: 'var(--rc-ink2)' }}>(optional)</span></label>
          <textarea id={id} value={val} onChange={(e) => set(e.target.value.slice(0, max))} disabled={sending} rows={3} maxLength={max} placeholder={ph}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '16px', fontFamily: 'inherit', borderRadius: '8px', border: '1px solid var(--rc-line)', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)', resize: 'vertical' }} />
        </div>
      ))}

      <div style={{ ...note, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--rc-line)', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)', margin: '0 0 12px', lineHeight: 1.45 }}>
        <strong>This form is not for technical support.</strong> Messages here are not answered. If something is broken, use the Report a problem tab. A full support option is coming later. Your email, country and region are sent with your feedback.
      </div>

      <button onClick={send} disabled={!rating || sending}
        style={{ width: '100%', padding: '12px', fontSize: '16px', fontWeight: '600', borderRadius: '10px', border: 'none', cursor: !rating || sending ? 'default' : 'pointer', backgroundColor: !rating || sending ? 'var(--rc-line)' : '#1a73e8', color: !rating || sending ? 'var(--rc-ink2)' : 'white' }}>
        {sending ? 'Sending…' : 'Send feedback'}
      </button>
      <div role="status" aria-live="polite" style={{ marginTop: '10px', fontSize: '14px', fontWeight: '600', color: state.kind === 'error' ? '#d93025' : '#1e8e3e', minHeight: '20px' }}>{state.msg}</div>
    </div>
  );
}


function ReportProblem({ version, accessToken }) {
  const [what, setWhat] = useState('');
  const [problems, setProblems] = useState(() => recentProblems());
  const [state, setState] = useState({ kind: 'idle', msg: '' });   // idle | sending | sent | error
  const sending = state.kind === 'sending';
  const ready = what.trim().length >= 3;

  const send = async () => {
    if (!ready || sending) return;
    if (!accessToken) { setState({ kind: 'error', msg: 'Connect to Google Drive first (tap the Drive banner at the top), then try again.' }); return; }
    setState({ kind: 'sending', msg: '' });
    try {
      const out = await sendDiagnostic(accessToken, version, what.trim());
      if (out !== 'failed') { setState({ kind: 'sent', msg: out === 'sent' ? 'Report sent. Thank you!' : 'Thank you! Your report is saved on this device and will be sent automatically as soon as the server is reachable.' }); setWhat(''); return; }
      setState({ kind: 'error', msg: 'Couldn’t send right now. Your note is still here. Please try again.' });
    } catch { setState({ kind: 'error', msg: 'Couldn’t send right now. Your note is still here. Please try again.' }); }
  };

  return (
    <div style={card}>
      <h3 style={{ ...h3, marginTop: 0 }}>Report a problem</h3>
      <p style={p}>Tell us what went wrong. Your note is sent with a short technical report so the problem can be tracked down.</p>
      <label htmlFor="rc-report-note" style={{ display: 'block', fontWeight: '600', marginBottom: '6px' }}>What happened?</label>
      <textarea id="rc-report-note" value={what} onChange={(e) => { setWhat(e.target.value.slice(0, 500)); if (state.kind === 'sent') setState({ kind: 'idle', msg: '' }); }} disabled={sending} rows={4} maxLength={500}
        placeholder="For example: I tapped Save on a recording and it never finished."
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '16px', fontFamily: 'inherit', borderRadius: '8px', border: '1px solid var(--rc-line)', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)', resize: 'vertical', marginBottom: '12px' }} />

      <div style={{ fontWeight: '600', marginBottom: '4px' }}>Recent problems on this device ({problems.length})</div>
      <div style={{ fontFamily: '"Courier New", monospace', fontSize: '11px', lineHeight: 1.5, maxHeight: '110px', overflowY: 'auto', backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-line)', borderRadius: '8px', padding: '6px 8px', marginBottom: '12px' }}>
        {problems.length === 0 ? <span style={{ color: 'var(--rc-ink2)' }}>None. Nothing has gone wrong lately.</span>
          : problems.slice().reverse().map((q, i) => (
            <div key={i}>{new Date(q.t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {q.area} · {q.code}{q.view ? ` · ${q.view}` : ''}{q.n > 1 ? ` ×${q.n}` : ''}</div>
          ))}
      </div>

      <div style={{ ...note, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--rc-line)', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)', margin: '0 0 12px', lineHeight: 1.45 }}>
        The report includes your app version, device, system, browser and screen size, whether you’re online, how many recordings are waiting on this device, the problem codes above, and your email, country and region. It never includes your recordings, clip names, lyrics or anything you’ve written in the app. Reports are read, but we can’t reply to each one yet.
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={send} disabled={!ready || sending}
          style={{ flex: 1, padding: '12px', fontSize: '16px', fontWeight: '600', borderRadius: '10px', border: 'none', cursor: !ready || sending ? 'default' : 'pointer', backgroundColor: !ready || sending ? 'var(--rc-line)' : '#1a73e8', color: !ready || sending ? 'var(--rc-ink2)' : 'white' }}>
          {sending ? 'Sending…' : 'Send report'}
        </button>
        <button onClick={() => setProblems(recentProblems())}
          style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '10px', border: '1px solid var(--rc-line)', cursor: 'pointer', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)' }}>Refresh list</button>
      </div>
      <div role="status" aria-live="polite" style={{ marginTop: '10px', fontSize: '14px', fontWeight: '600', color: state.kind === 'error' ? '#d93025' : '#1e8e3e', minHeight: '20px' }}>{state.msg}</div>
    </div>
  );
}

const TABS = [
  { id: 'feedback', label: 'Feedback', Component: FeedbackForm },
  { id: 'report', label: 'Report a problem', Component: ReportProblem },
];

export default function Feedback({ version, accessToken }) {
  const [tab, setTab] = useState('feedback');
  const Active = (TABS.find(t => t.id === tab) || TABS[0]).Component;
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div role="tablist" style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, minWidth: 0, padding: '10px 6px', fontSize: '13px', fontWeight: '600', borderRadius: '10px', cursor: 'pointer',
              border: `2px solid ${tab === t.id ? '#1a73e8' : 'var(--rc-line)'}`, backgroundColor: tab === t.id ? 'var(--rc-sel)' : 'var(--rc-surface)', color: tab === t.id ? '#1a73e8' : 'var(--rc-ink)' }}>
            {t.label}
          </button>
        ))}
      </div>
      <Active version={version} accessToken={accessToken} />
    </div>
  );
}
