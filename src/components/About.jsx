import { useState } from 'react';

// About section: tabs for the Privacy Policy and the User Agreement.
// To add another tab later, add an entry to TABS and a component for it.
// If what the app collects changes, update PrivacyPolicy to match (and UsageLog.js / log-usage.mjs).

const UPDATED = 'November 5, 2026';

const card = { backgroundColor: 'var(--rc-card)', border: '1px solid var(--rc-line)', borderRadius: '12px', padding: '16px', textAlign: 'left', lineHeight: 1.55, fontSize: '14px', color: 'var(--rc-ink)' };
const h3 = { fontSize: '15px', margin: '18px 0 6px', color: 'var(--rc-ink)' };
const p = { margin: '0 0 10px' };
const ul = { margin: '0 0 10px', paddingLeft: '20px' };
const li = { marginBottom: '4px' };
const note = { fontSize: '12px', color: 'var(--rc-ink2)', margin: '0 0 8px' };

function PrivacyPolicy() {
  return (
    <div style={card}>
      <div style={note}>Last updated {UPDATED}</div>

      <h3 style={{ ...h3, marginTop: 0 }}>The short version</h3>
      <ul style={ul}>
        <li style={li}>Your recordings, lyrics and song ideas stay in your own Google Drive. We never see them.</li>
        <li style={li}>Riff Catalog can only see files it created itself. It can't look at anything else in your Drive.</li>
        <li style={li}>We do keep simple usage numbers (below), so we know how the app is being used and what to improve.</li>
      </ul>

      <h3 style={h3}>What Riff Catalog can reach in your Google account</h3>
      <p style={p}>
        You sign in with Google so the app knows who you are, and you give it permission to use Google Drive. The permission
        we ask for is Google's narrowest Drive option. It lets Riff Catalog open only the files and folders that Riff Catalog
        created. Your other documents, photos and files are invisible to the app, and so is anything else in your Drive.
      </p>
      <p style={p}>
        Your recordings, clip details, song ideas, saved beats and settings are stored in your Drive, not on a server of
        ours. Nobody who runs the app can open them.
      </p>

      <h3 style={h3}>What we never collect</h3>
      <ul style={ul}>
        <li style={li}>The audio of your recordings, or any copy of it</li>
        <li style={li}>Clip names, lyrics, notes, tags or any other details you type about a clip</li>
        <li style={li}>The text of your song ideas, or the patterns in your drum beats</li>
        <li style={li}>Anything else you create, and your Google password (Google handles sign-in, not us)</li>
      </ul>

      <h3 style={h3}>What we do collect</h3>
      <p style={p}>Each time you open the app while signed in, it sends a small summary made only of counts and dates:</p>
      <ul style={ul}>
        <li style={li}>Your email address, so we can tell users apart</li>
        <li style={li}>The date and time you first opened the app, your most recent visit, and how many visits you've made</li>
        <li style={li}>The IP address from your most recent visit, and the country and region it points to</li>
        <li style={li}>Your device type (for example iPhone or Windows), whether the app is installed on your home screen or open in a browser, and which version of the app you have</li>
        <li style={li}>How many recordings are in your library, how many song ideas you've saved, and how many custom drum beats you've saved</li>
        <li style={li}>The average length of the recordings you make in the app (a number of seconds, nothing about what's on them)</li>
        <li style={li}>How many times you've opened each section of the app</li>
      </ul>

      <h3 style={h3}>Why we collect it</h3>
      <p style={p}>
        To see whether the app is working, which features people use, and where to spend time improving it, and to spot
        people who are stuck on an old version. We don't sell this information, show ads, or share it with anyone.
      </p>

      <h3 style={h3}>Where it's kept</h3>
      <p style={p}>
        The numbers go into a private spreadsheet that only the app's owner can open. The app is hosted on Netlify, which
        handles each request and, like most hosting services, may keep ordinary server logs (including IP addresses) for a
        short time. Google provides sign-in and Drive.
      </p>

      <h3 style={h3}>Your choices</h3>
      <ul style={ul}>
        <li style={li}>Sign out in Settings to disconnect Riff Catalog from your Google account on that device.</li>
        <li style={li}>Remove Riff Catalog's access any time at myaccount.google.com/permissions.</li>
        <li style={li}>Ask Justin, who built Riff Catalog, to see or delete the usage row held about you.</li>
        <li style={li}>Your recordings are yours. Delete them from Drive whenever you like.</li>
      </ul>

      <h3 style={h3}>Changes</h3>
      <p style={{ ...p, marginBottom: 0 }}>
        If we start collecting anything new, this page will be updated first, and the date at the top will change.
      </p>
    </div>
  );
}

function UserAgreement() {
  return (
    <div style={card}>
      <div style={note}>Last updated {UPDATED}</div>
      <p style={p}>This is a plain-English agreement for using Riff Catalog. It will grow as the app does.</p>

      <h3 style={h3}>1. Using the app</h3>
      <p style={p}>
        Riff Catalog is a tool for recording, organizing and practicing your music. You need a Google account to use it, and
        you're responsible for that account and for what happens on your device.
      </p>

      <h3 style={h3}>2. Your music is yours</h3>
      <p style={p}>
        Everything you record or write in Riff Catalog belongs to you. We claim no rights to it, and we don't access it or
        use it. It lives in your own Google Drive.
      </p>

      <h3 style={h3}>3. It's beta software</h3>
      <p style={p}>
        Riff Catalog is still being built. It may have bugs, change without notice, or stop working. It's provided "as is",
        without promises. Please keep your own copy of anything important, because the app's maker can't be responsible for
        lost recordings or data, to the fullest extent the law allows.
      </p>

      <h3 style={h3}>4. Be decent</h3>
      <p style={p}>
        Don't try to break the app, overload it, get at other people's data, or use it to infringe anyone's rights.
        Access may be removed for anyone who does.
      </p>

      <h3 style={h3}>5. Usage numbers</h3>
      <p style={p}>
        By using the app you agree that it records the simple usage numbers described in the Privacy Policy tab.
      </p>

      <h3 style={h3}>6. Stopping</h3>
      <p style={p}>You can stop using Riff Catalog at any time by signing out and removing its access in your Google account.</p>

      <h3 style={h3}>7. Changes</h3>
      <p style={{ ...p, marginBottom: 0 }}>
        This agreement may change as the app grows. The date at the top shows the latest version, and using the app after a
        change means you accept it.
      </p>
    </div>
  );
}

const TABS = [
  { id: 'privacy', label: 'Privacy Policy', Component: PrivacyPolicy },
  { id: 'agreement', label: 'User Agreement', Component: UserAgreement },
];

export default function About({ version }) {
  const [tab, setTab] = useState('privacy');
  const Active = (TABS.find(t => t.id === tab) || TABS[0]).Component;
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div role="tablist" style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, minWidth: '120px', padding: '10px 12px', fontSize: '14px', fontWeight: '600', borderRadius: '10px', cursor: 'pointer',
              border: `2px solid ${tab === t.id ? '#1a73e8' : 'var(--rc-line)'}`,
              backgroundColor: tab === t.id ? 'var(--rc-sel)' : 'var(--rc-surface)',
              color: tab === t.id ? '#1a73e8' : 'var(--rc-ink)',
            }}>
            {t.label}
          </button>
        ))}
      </div>
      <Active />
      {version && <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--rc-ink2)' }}>Riff Catalog {version}</div>}
    </div>
  );
}
