import { useState, useEffect } from 'react';
import Changelog from './Changelog';
import { noteTabView } from './UsageLog';

// About section: tabs for About (what the app is), Privacy Policy, User Agreement and Changelog.
// To add another tab later, add an entry to TABS and a component for it.
// If what the app collects changes, update PrivacyPolicy to match (and UsageLog.js / log-usage.mjs).

const UPDATED = 'November 5, 2026';

const card = { backgroundColor: 'var(--rc-card)', border: '1px solid var(--rc-line)', borderRadius: '12px', padding: '16px', textAlign: 'left', lineHeight: 1.55, fontSize: '14px', color: 'var(--rc-ink)' };
const h3 = { fontSize: '15px', margin: '18px 0 6px', color: 'var(--rc-ink)' };
const p = { margin: '0 0 10px' };
const ul = { margin: '0 0 10px', paddingLeft: '20px' };
const li = { marginBottom: '4px' };
const note = { fontSize: '12px', color: 'var(--rc-ink2)', margin: '0 0 8px' };

function AboutHome() {
  return (
    <div style={card}>
      <h3 style={{ ...h3, marginTop: 0, fontSize: '18px' }}>Riff Catalog</h3>
      <p style={p}>Record your guitar riffs, keep them organized, and practice with them. Free, and no music-theory degree required.</p>

      <h3 style={h3}>What it is for</h3>
      <p style={p}>Every guitar player has a phone full of half-remembered ideas. Riff Catalog gives them a home. Hit record when an idea shows up, give it a name, and find it again later instead of scrolling through a camera roll.</p>

      <h3 style={h3}>What you can do</h3>
      <ul style={ul}>
        <li style={li}><strong>Record</strong> a riff in one tap, even without an internet connection. It uploads when you&rsquo;re back online.</li>
        <li style={li}><strong>Keep a library</strong> of your recordings with names, tags, keys and tempos, and filter or sort to find the one you want.</li>
        <li style={li}><strong>Find a key</strong> and see which notes and chords fit, on a fretboard or piano.</li>
        <li style={li}><strong>Practice</strong> with random picks so you stop playing the same three things.</li>
        <li style={li}><strong>Jam</strong> along to drum beats you can build and save.</li>
        <li style={li}><strong>Spark an idea</strong> with the randomizer when you&rsquo;re stuck.</li>
      </ul>
      <p style={p}>You can look around the whole app without an account. Signing in with Google is only needed to record, keep a library, and contact support.</p>

      <h3 style={h3}>Your music stays yours</h3>
      <p style={p}>You sign in with your Google account. Riff Catalog saves your recordings and notes in <strong>your own Google Drive</strong>, and it can only see the files and folders it created itself. It can&rsquo;t look at anything else in your Drive.</p>
      <p style={p}>We never see or keep your recordings. We only keep simple usage numbers, such as how often each part of the app is used, so we know what to improve. The Privacy tab has the full details.</p>

      <h3 style={h3}>Questions or trouble?</h3>
      <p style={{ ...p, marginBottom: 0 }}>Read the <a href="/guide.html" target="_blank" rel="noopener">User Guide</a> to see how every part of the app works. If you still need help, choose <strong>Support</strong> from the menu and send us a message. We reply by email.</p>
    </div>
  );
}

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
      <p style={p}>Each time you open the app while signed in, it sends a small summary made only of counts, dates and a few device and settings facts:</p>
      <ul style={ul}>
        <li style={li}>Your email address, so we can tell users apart</li>
        <li style={li}>The date and time you first opened the app, your most recent visit, how many visits you've made, and how many different days you've used it. Once a day we also keep a one-line snapshot of the counts below, so we can see how things change over time</li>
        <li style={li}>The IP address from your most recent visit, and the country and region it points to</li>
        <li style={li}>Your device type (for example iPhone or Windows), its operating system version, the device model when your browser shares it (on iPhone it's only an estimate from the screen size), your screen size, your browser and its version, your time zone and language, how much storage the app is using on your device, whether the app is installed on your home screen or open in a browser (and how many visits were each), and which version of the app you have, including which version you had before and when you updated</li>
        <li style={li}>How many recordings are in your library, how many song ideas you've saved, and how many custom drum beats you've saved</li>
        <li style={li}>How many of your recordings have a key, a tempo or tags filled in (just the numbers, never the keys, tempos or tags themselves)</li>
        <li style={li}>The average length of the recordings you make in the app, how many of your takes fall into short, medium, long and very long groups, and how many you made in the morning, afternoon, evening or at night and on weekdays or weekends (all as numbers, nothing about what's on them)</li>
        <li style={li}>How many times you've opened each section, and how many times you've used features such as Jam's Play button, Practice's Random button, Key Finder, the Randomizer wheel and Surprise me, the Library's sort and filter, and playing clips, and how many song ideas you've saved (including how many of them use more than one key, which is only a number)</li>
        <li style={li}>The date and time you first did each of a handful of things, such as first recording, first save to Drive, first visit to the Library and first Jam play</li>
        <li style={li}>How many minutes the app has been open on your screen</li>
        <li style={li}>Speed and reliability numbers: how long listing your recordings from Drive and uploading them takes, how often Google asked the app to reconnect, and how often the microphone was refused or sound couldn't start</li>
        <li style={li}>Problems: how many recordings failed to upload, how many saves to Drive failed, how many recordings are waiting on your device, and how many unexpected errors happened. For each problem we keep one line: the date and time, your email, the app version, your device and system, which part of the app it happened in, a short code such as "upload Error 401" and the screen you were on. The code is made only from the kind of error and a web status number, never the error's message, a clip name or anything you wrote</li>
        <li style={li}>Your look-and-feel choices: light or dark appearance, sharps or flats, the four note colors you picked (as color codes such as #FF4444), and your strum speed</li>
      </ul>

      <h3 style={h3}>Why we collect it</h3>
      <p style={p}>
        To see whether the app is working, which features people use, and where to spend time improving it, and to spot
        people who are stuck on an old version. We don't sell this information, show ads, or share it with anyone.
      </p>

      <h3 style={h3}>If you send feedback</h3>
      <p style={p}>
        Feedback is optional and only sent when you press Send on the Give feedback tab of the Support section in the menu. We keep your star rating, the things you typed
        (what you find useful, what you dislike, ideas, and anything else), your email address, the country and region of your
        connection, the date and the app version. Each submission is kept as its own entry. If your message can't be sent right away (no connection, or the
        server is busy), it waits on your device and is sent automatically later. Your usage numbers work the same way.
      </p>

      <h3 style={h3}>If you contact support</h3>
      <p style={p}>
        Contact support (in the Support section of the menu) sends the message you type, along with your email address (so we can reply to you by email), the country and region of your connection, the date
        and the app version. It is only sent when you press Send to support. If you leave "Include technical details" ticked, it also includes your device, system, browser and screen size, whether you're
        online, how many recordings are waiting on your device, and the list of recent problem codes described above (never the console text, your recordings or anything you've written in the app).
        Each message is kept as its own entry, and we reply by email. You can also attach up to three screenshots to a message. A screenshot is only sent if you add one and press Send to support. The app shrinks it on your device first, it is stored with our hosting provider (Netlify) where only the app’s owner can open it, and it is deleted automatically after 60 days. Please don’t include anything private in a screenshot.
      </p>

      <h3 style={h3}>If you send a diagnostic report</h3>
      <p style={p}>
        On the Debug tab (in Support) you can choose to send a report when something isn't working. It is only sent when you press the button.
        It contains the date, your email, a note you type (optional on the Debug tab), your app version, device, system, browser and screen size,
        whether you're online, how many recordings are waiting on your device, how much storage the app uses, the country and region of
        your connection, and the list of recent problem codes described above. It does not include the console text shown on that
        screen, your recordings or anything you've written in the app.
      </p>

      <h3 style={h3}>Where it's kept</h3>
      <p style={p}>
        The numbers, feedback and support messages go into a private spreadsheet that only the app's owner can open, and the app’s owner can also see them on a Dashboard page inside the app. Every person has their own Dashboard in the menu that shows only their own numbers, never anyone else’s. The app is hosted on Netlify, which
        handles each request and, like most hosting services, may keep ordinary server logs (including IP addresses) for a
        short time. Google provides sign-in and Drive.
      </p>

      <h3 style={h3}>Your choices</h3>
      <ul style={ul}>
        <li style={li}>Open Dashboard in the menu to see the numbers, feedback, support messages and reports kept about you, and tap Download my data to save them as a file.</li>
        <li style={li}>Sign out in Settings to disconnect Riff Catalog from your Google account on that device.</li>
        <li style={li}>Remove Riff Catalog's access any time at myaccount.google.com/permissions.</li>
        <li style={li}>To see or delete the usage row, daily snapshots, problem log, feedback entries, support messages and diagnostic reports held about you, open Support in the menu, choose Contact support, and ask. We reply by email.</li>
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
        By using the app you agree that it records the simple usage numbers described in the Privacy tab, and that anything you choose to send as feedback may be read and kept by the app's maker.
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
  { id: 'about', label: 'About', Component: AboutHome },
  { id: 'privacy', label: 'Privacy', Component: PrivacyPolicy },
  { id: 'agreement', label: 'Agreement', Component: UserAgreement },
  { id: 'changelog', label: 'Changelog', Component: Changelog },
];

export default function About({ version, accessToken, request }) {
  const [tab, setTab] = useState((request && TABS.some(t => t.id === request.tab)) ? request.tab : 'about');
  // Another part of the app can ask About to open a particular tab (for example the Changelog link on the home screen).
  useEffect(() => { if (request && TABS.some(t => t.id === request.tab)) setTab(request.tab); }, [request]);
  const Active = (TABS.find(t => t.id === tab) || TABS[0]).Component;
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div role="tablist" style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); if (t.id === 'changelog') noteTabView(t.id); }}
            style={{
              flex: 1, minWidth: 0, padding: '10px 2px', fontSize: '12px', fontWeight: '600', borderRadius: '10px', cursor: 'pointer',
              border: `2px solid ${tab === t.id ? '#1a73e8' : 'var(--rc-line)'}`,
              backgroundColor: tab === t.id ? 'var(--rc-sel)' : 'var(--rc-surface)',
              color: tab === t.id ? '#1a73e8' : 'var(--rc-ink)',
            }}>
            {t.label}
          </button>
        ))}
      </div>
      <Active version={version} accessToken={accessToken} />
      {version && <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--rc-ink2)' }}>Riff Catalog {version}</div>}
    </div>
  );
}
