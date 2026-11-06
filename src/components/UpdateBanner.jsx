import { useEffect, useState } from 'react';

// Shows "A new version is ready" when Netlify has a newer build than the one this screen loaded.
// How: the page's main script has a build-stamped file name (/assets/index-XXXX.js). We re-read the
// page (never from cache) when the app comes back to the foreground, at most every 10 minutes, and
// compare that file name with the one we're running. Nothing is sent anywhere; it's just a page fetch.
// Reloading is only ever done by the person tapping Reload, so it can't interrupt a recording.

const MIN_GAP_MS = 10 * 60 * 1000;
const bundleOf = (html) => { const m = /\/assets\/index-[\w-]+\.js/.exec(html || ''); return m ? m[0] : ''; };

export default function UpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let last = 0;
    let stopped = false;
    const running = (() => {
      try { return bundleOf(Array.from(document.scripts).map(s => s.src).join(' ')); } catch { return ''; }
    })();
    if (!running) return undefined;   // development server or an unrecognised build: nothing to compare

    const check = async () => {
      if (stopped || ready || document.visibilityState === 'hidden' || navigator.onLine === false) return;
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      try {
        const res = await fetch('/index.html', { cache: 'no-store' });
        if (!res.ok) return;
        const latest = bundleOf(await res.text());
        if (latest && latest !== running && !stopped) setReady(true);
      } catch { /* offline or blocked: try again next time */ }
    };

    const first = setTimeout(check, 15000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => { stopped = true; clearTimeout(first); document.removeEventListener('visibilitychange', check); window.removeEventListener('online', check); };
  }, [ready]);

  if (!ready) return null;
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', left: '12px', right: '12px', bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', zIndex: 3000,
      display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '12px',
      backgroundColor: 'var(--rc-card)', color: 'var(--rc-ink)', border: '2px solid #1a73e8', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', fontSize: '14px', textAlign: 'left',
    }}>
      <div style={{ flex: 1, lineHeight: 1.4 }}>
        <strong>A new version is ready.</strong>
        <div style={{ fontSize: '12px', color: 'var(--rc-ink2)' }}>Reload when you’re not in the middle of a recording.</div>
      </div>
      <button onClick={() => window.location.reload()} style={{ padding: '10px 16px', fontSize: '14px', fontWeight: '600', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: '#1a73e8', color: 'white', flex: '0 0 auto' }}>Reload</button>
    </div>
  );
}
