import { useState } from 'react';
import { noteMilestone, sendSupport, recentProblems } from './UsageLog';
import { sendOrQueue } from './UsageOutbox';

// Support section (menu item). Two tabs: Contact support (a message to the app's owner, answered by email) and Give feedback
// (a star rating and ideas, not answered individually).

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
        <strong>Feedback isn&rsquo;t answered one by one.</strong> If you need help or have a question, use the Contact support tab instead. Your email, country and region are sent with your feedback.
      </div>

      <button onClick={send} disabled={!rating || sending}
        style={{ width: '100%', padding: '12px', fontSize: '16px', fontWeight: '600', borderRadius: '10px', border: 'none', cursor: !rating || sending ? 'default' : 'pointer', backgroundColor: !rating || sending ? 'var(--rc-line)' : '#1a73e8', color: !rating || sending ? 'var(--rc-ink2)' : 'white' }}>
        {sending ? 'Sending…' : 'Send feedback'}
      </button>
      <div role="status" aria-live="polite" style={{ marginTop: '10px', fontSize: '14px', fontWeight: '600', color: state.kind === 'error' ? '#d93025' : '#1e8e3e', minHeight: '20px' }}>{state.msg}</div>
    </div>
  );
}


function ContactSupport({ version, accessToken, email }) {
  const [what, setWhat] = useState('');
  const [details, setDetails] = useState(true);
  const [problems, setProblems] = useState(() => recentProblems());
  const [state, setState] = useState({ kind: 'idle', msg: '' });   // idle | sending | sent | error
  const sending = state.kind === 'sending';
  const ready = what.trim().length >= 3;

  const send = async () => {
    if (!ready || sending) return;
    if (!accessToken) { setState({ kind: 'error', msg: 'Connect to Google Drive first (tap the Drive banner at the top), then try again.' }); return; }
    setState({ kind: 'sending', msg: '' });
    try {
      const out = await sendSupport(accessToken, version, what.trim(), details);
      if (out !== 'failed') {
        setState({ kind: 'sent', msg: out === 'sent' ? 'Thank you! Your message was sent.' + (email ? ` You\u2019ll get a reply by email at ${email}.` : '') : 'Thank you! Your message is saved on this device and will be sent automatically as soon as the server is reachable.' });
        setWhat(''); return;
      }
      setState({ kind: 'error', msg: 'Couldn\u2019t send. If your Google connection has expired, reconnect Drive and try again. Your message is still here.' });
    } catch { setState({ kind: 'error', msg: 'Couldn\u2019t send right now. Your message is still here. Please try again.' }); }
  };

  return (
    <div style={card}>
      <h3 style={{ ...h3, marginTop: 0 }}>Contact support</h3>
      <p style={p}>Something not working, or a question about the app? Tell us and we&rsquo;ll reply by email{email ? <> to <strong>{email}</strong></> : ' to the Google account you signed in with'}.</p>
      <label htmlFor="rc-support-msg" style={{ display: 'block', fontWeight: '600', marginBottom: '6px' }}>How can we help?</label>
      <textarea id="rc-support-msg" value={what} onChange={(e) => { setWhat(e.target.value.slice(0, 2000)); if (state.kind === 'sent') setState({ kind: 'idle', msg: '' }); }} disabled={sending} rows={5} maxLength={2000}
        placeholder="For example: I tapped Save on a recording and it never finished."
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '16px', fontFamily: 'inherit', borderRadius: '8px', border: '1px solid var(--rc-line)', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)', resize: 'vertical', marginBottom: '12px' }} />

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px', cursor: 'pointer' }}>
        <input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} disabled={sending} style={{ width: '20px', height: '20px', marginTop: '1px', flex: '0 0 auto' }} />
        <span><strong>Include technical details</strong> <span style={{ color: 'var(--rc-ink2)' }}>(recommended: helps us find the problem)</span></span>
      </label>

      {details && (
        <>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>Recent problems on this device ({problems.length})</div>
          <div style={{ fontFamily: '"Courier New", monospace', fontSize: '11px', lineHeight: 1.5, maxHeight: '110px', overflowY: 'auto', backgroundColor: 'var(--rc-surface)', border: '1px solid var(--rc-line)', borderRadius: '8px', padding: '6px 8px', marginBottom: '12px' }}>
            {problems.length === 0 ? <span style={{ color: 'var(--rc-ink2)' }}>None. Nothing has gone wrong lately.</span>
              : problems.slice().reverse().map((q, i) => (
                <div key={i}>{new Date(q.t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {q.area} · {q.code}{q.view ? ` · ${q.view}` : ''}{q.n > 1 ? ` ×${q.n}` : ''}</div>
              ))}
          </div>
          <div style={{ ...note, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--rc-line)', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)', margin: '0 0 12px', lineHeight: 1.45 }}>
            The technical details are your app version, device, system, browser and screen size, whether you&rsquo;re online, how many recordings are waiting on this device and the problem codes above. They never include your recordings, clip names, lyrics or anything you&rsquo;ve written in the app. Your email, country and region are sent with every message.
          </div>
        </>
      )}
      {!details && <div style={{ ...note, margin: '0 0 12px' }}>Only your message is sent, along with your email, country and region and the app version.</div>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={send} disabled={!ready || sending}
          style={{ flex: 1, padding: '12px', fontSize: '16px', fontWeight: '600', borderRadius: '10px', border: 'none', cursor: !ready || sending ? 'default' : 'pointer', backgroundColor: !ready || sending ? 'var(--rc-line)' : '#1a73e8', color: !ready || sending ? 'var(--rc-ink2)' : 'white' }}>
          {sending ? 'Sending…' : 'Send to support'}
        </button>
        {details && <button onClick={() => setProblems(recentProblems())}
          style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '10px', border: '1px solid var(--rc-line)', cursor: 'pointer', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)' }}>Refresh list</button>}
      </div>
      <div role="status" aria-live="polite" style={{ marginTop: '10px', fontSize: '14px', fontWeight: '600', color: state.kind === 'error' ? '#d93025' : '#1e8e3e', minHeight: '20px' }}>{state.msg}</div>
    </div>
  );
}

const TABS = [
  { id: 'support', label: 'Contact support', Component: ContactSupport },
  { id: 'feedback', label: 'Give feedback', Component: FeedbackForm },
];

export default function Feedback({ version, accessToken, email }) {
  const [tab, setTab] = useState('support');
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
      <Active version={version} accessToken={accessToken} email={email} />
    </div>
  );
}
