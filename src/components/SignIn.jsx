import { useEffect, useRef } from 'react';

// Sign-in pieces for people who haven't signed in yet. The app can be explored without an account; these appear
// where something needs Google Drive (recording, the library, the dashboard, support).
//
// Google's own button is drawn into each of these. App.jsx sets Google sign-in up once and announces it
// ("rc-gsi-ready"), and every button here draws itself whenever it appears.

export function SignInButton({ size = 'large' }) {
  const ref = useRef(null);
  useEffect(() => {
    const draw = () => {
      try {
        if (ref.current && window.__rcGsiReady && window.google?.accounts?.id) {
          ref.current.innerHTML = '';
          window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size });
        }
      } catch { /* Google's script not ready yet; it will announce itself */ }
    };
    draw();
    window.addEventListener('rc-gsi-ready', draw);
    return () => window.removeEventListener('rc-gsi-ready', draw);
  }, [size]);
  return <div ref={ref} style={{ minHeight: '44px', display: 'flex', justifyContent: 'center' }} />;
}

const box = { backgroundColor: 'var(--rc-card)', border: '1px solid var(--rc-line)', borderRadius: '12px', padding: '16px', textAlign: 'center', color: 'var(--rc-ink)', lineHeight: 1.5, fontSize: '14px' };

// A small bar shown near the top while signed out.
export function SignInBanner({ onLearnMore }) {
  return (
    <div style={{ ...box, margin: '0 0 16px', padding: '12px 14px' }}>
      <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>Riff Catalog</div>
      <div style={{ marginBottom: '8px' }}>
        Record your guitar riffs, keep them organized, and practice with them. Your recordings are saved in your own Google Drive.
        {onLearnMore && <> <button type="button" onClick={onLearnMore} style={{ background: 'none', border: 'none', padding: 0, color: '#1a73e8', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>Learn more</button></>}
      </div>
      <div style={{ marginBottom: '8px', fontSize: '13px', color: 'var(--rc-ink2)' }}>You can look around without an account. <strong>Sign in with Google</strong> to record and save your riffs.</div>
      <SignInButton />
    </div>
  );
}

// Shown in place of a section that needs Google Drive.
export function SignInGate({ what }) {
  return (
    <div style={{ ...box, maxWidth: '420px', margin: '20px auto' }}>
      <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Sign in to continue</div>
      <div style={{ marginBottom: '12px' }}>Signing in with Google lets Riff Catalog {what}. It can only see the files it creates in your Drive.</div>
      <SignInButton />
    </div>
  );
}
