import { useState } from 'react';

const CHANGELOG = [
  {
    date: '2026-08-22',
    displayDate: 'August 22, 2026',
    version: '1.9',
    entries: [
      {
        title: 'Pinch-to-zoom for every diagram',
        items: [
          'Tap any diagram — box licks, free licks, double stops, chord riffs, the fretboard, or Key Finder\u2019s chord shapes — to open it full-screen',
          'Pinch to zoom, drag to pan once zoomed in, double-tap to reset',
          'Zooms to fill the screen automatically on open, and re-fits itself if you rotate to landscape',
          'A toggle next to the back button switches between a lick or chord diagram and the fretboard for its key, when one is known',
          'Zooming in scales the whole page together (title, toggle, diagram, and the pinch-to-zoom hint) rather than leaving a fixed header and footer eating into the screen — only the back button stays put, so there\u2019s always a way out',
        ],
      },
      {
        title: 'Pentatonic box licks rebuilt for playability',
        items: [
          'Every note is now guaranteed within 5 frets of the one before it — licks that used to leap from, say, fret 6 to fret 21 no longer happen',
          'Removed jarring repeated-pitch transitions: the same note played on a different string, or the same note in a different octave, back to back',
          'Fixed a transposition bug that could stretch a tight box shape out to an 11-fret spread in certain keys',
          'All 750 box licks regenerated under these corrected rules',
        ],
      },
      {
        title: 'Scale-degree coloring, root/3rd/5th',
        items: [
          'Root, 3rd, and 5th are individually color-coded (red / orange / yellow) across every lick and scale diagram \u2014 box licks, free licks, double stops, and the fretboard overview',
          'Root shown as a filled circle, 3rd and 5th as hollow circles in their own color; every other note renders in white for contrast against the grid',
          'Free licks and double stops compute each note\u2019s degree live from its pitch, since \u2014 unlike box licks \u2014 that isn\u2019t stored in their data, but the coloring result is identical either way',
          'Chord riffs intentionally don\u2019t get this treatment: each chord in a riff has its own root, and coloring notes relative to whichever chord they belong to (rather than one shared key) read as confusing rather than helpful. Fretted notes there are still bright white against the dimmed grid',
          'Fretboard\u2019s open-string tuning labels now match the coloring of whatever scale degree that string plays',
          'The 3rd\u2019s color is now consistent across every diagram type \u2014 previously a lighter orange in box-mode tabs than on the fretboard',
        ],
      },
      {
        title: 'Uniform sizing across every lick, double-stop, and chord diagram',
        items: [
          'Fixed misaligned pipes and dashes that made some strings\u2019 measures wider than others',
          'Every card \u2014 box licks, free licks, double stops, and chord riffs \u2014 is now a consistent size, with content centered and sized to fit the screen without needing to scroll',
          'Shorter licks within each type now center within a fixed-length measure instead of clustering against the left edge, and double-stop/chord column widths no longer vary from lick to lick',
          'Chord riffs now have a full extra dash-column between each chord for easier reading',
        ],
      },
      {
        title: 'Library: bulk actions and Song Idea box',
        items: [
          'Download and Delete are now bulk actions — check the clips you want, then Download, Delete, or Clear the selection, icon-only',
          'Bulk delete asks for one confirmation covering everything selected, rather than one per clip',
          'Collapsed cards show key, tempo, and date each on their own centered line under the clip name',
          'Bigger, clearer pencil icon on the rename button',
          'New Song Idea box on expanded clips — pull a saved idea straight from the Randomizer via a dropdown, and it saves with the rest of the clip\u2019s metadata',
        ],
      },
      {
        title: 'App-wide back and refresh buttons',
        items: [
          'A back button at the top of the app now returns to whatever tab and state you were last on — filters, expanded cards, scroll position, and all — instead of losing it when you switch tabs',
          'The back button stays visible at all times, dimmed and inactive when there\u2019s nowhere to go back to, rather than disappearing entirely',
          'A matching refresh button now sits in the top right — the same full app reset (silent Drive reconnect first, then a full cache-clear reload if that doesn\u2019t work) that used to only be available as a link on the Record tab, now reachable from anywhere',
          'Both buttons use simple line-art icons in the same minimal style — the refresh icon replaces an earlier, more cluttered one that didn\u2019t match, and the separate "Refresh app" link on the Record tab is gone now that it\u2019s redundant',
          'If you\u2019re mid-recording with an unsaved take, refreshing now asks for confirmation first instead of silently discarding it',
        ],
      },
      {
        title: 'Randomizer wheel momentum',
        items: [
          'Flicking the wheel now spins it with real momentum, decelerating gradually to a stop, instead of only supporting a direct 1:1 drag',
          'Grabbing the wheel mid-spin stops it immediately, the way a real wheel would',
          'Saved song idea filenames no longer include seconds (e.g. "Idea (2026-08-21--23-36)")',
          'Previous/next buttons on either side of the category dropdown, with a position counter',
        ],
      },
    ],
  },
  {
    date: '2026-08-21',
    displayDate: 'August 21, 2026',
    version: '1.8',
    entries: [
      {
        title: 'Faster, less disruptive Drive reconnects',
        items: [
          'The app now automatically retries connecting to Google Drive the moment it comes back to the screen after being backgrounded or reloaded, with no tap needed when it succeeds silently',
          'When a tap is needed, a banner appears right under the header on any tab — no more hunting for a link buried in the Record tab',
        ],
      },
      {
        title: 'Debug log improvements',
        items: [
          'The debug log now persists across app sessions instead of clearing every time the app closes or reloads — only the Clear button empties it',
          'Log writes are batched so rapid bursts of activity (like audio analysis) don\u2019t hit storage on every single line, with a final flush right before the app closes so nothing from right before a crash is lost',
          'Entries now show a date divider whenever the day changes, so it\u2019s clear which entries are from which session when the log spans multiple days',
        ],
      },
    ],
  },
  {
    date: '2026-08-17',
    displayDate: 'August 17, 2026',
    version: '1.7',
    entries: [
      {
        title: 'Google Drive connection persists across app launches',
        items: [
          'Fixed the standalone home-screen app losing its Google Drive connection every time it was closed and reopened',
          'Root cause: a standalone home-screen app on iOS gets its own isolated storage, completely separate from Safari — so the silent reconnect that normally works in a browser tab had no session to use and failed every time',
          'The Drive connection is now remembered across launches, so reopening the app reconnects instantly with no prompt, for as long as the connection stays valid',
          'The manual reconnect option no longer forces the full permissions screen — it tries quietly first and only asks for input if that genuinely fails',
        ],
      },
      {
        title: 'Library management',
        items: [
          'Clips can be renamed directly in the library — the metadata sidecar is renamed to match so the two stay paired',
          'Clips can be deleted, with an inline confirmation. Deleted clips move to the Google Drive trash rather than being destroyed, so they can be recovered for 30 days',
          'Clips can be starred, with a "Starred only" filter for surfacing favorites quickly',
          'Export the entire library to a CSV file with every metadata field included',
        ],
      },
      {
        title: 'Installable app',
        items: [
          'Added a web app manifest and app icon, so adding Riff Catalog to your home screen now installs it as a proper standalone app instead of a browser bookmark',
          'Launches fullscreen without browser chrome, with a dark theme and its own app icon',
        ],
      },
      {
        title: 'Key detection fixed on iPhone',
        items: [
          'New recordings are now analyzed from raw audio captured live while you record, so key and BPM are detected without decoding a file at all',
          'Existing clips can be analyzed again — the app now demuxes the recording itself and decodes it with a built-in AAC decoder instead of relying on the browser, which could not read its own recordings on iOS',
          'Root cause: iOS Safari writes fragmented MP4 files that neither its own audio decoder nor the WebCodecs decoder could read, failing silently with no error',
        ],
      },
      {
        title: 'Recording improvements',
        items: [
          'Recording is now explicitly mono, fixing audio that played out of only the left speaker on some devices',
          'Waveform display is far more sensitive — the signal is amplified and clamped so normal playing and singing are clearly visible instead of a near-flat line',
          'Waveform line is thicker and smoother',
        ],
      },
      {
        title: 'Faster saving',
        items: [
          'Drive folder locations are cached for the session instead of being looked up on every save',
          'The audio file and its metadata sidecar now upload at the same time rather than one after the other',
        ],
      },
      {
        title: 'Reverse Key Lookup',
        items: [
          'New section on the Key Finder tab — tap any combination of the 12 notes and find every key containing them',
          'Falls back to a ranked list of closest matches when no key contains all selected notes',
          'Collapsible, and collapses automatically when a key is chosen from the dropdown',
        ],
      },
      {
        title: 'Debug tab',
        items: [
          'New Debug tab capturing all console output and errors from the session',
          'Filter by all / warnings / errors, copy the log, clear it, or save it to RiffCatalog/Debug in your Drive',
          'Timestamps and log filenames use local time',
        ],
      },
    ],
  },
  {
    date: '2026-08-04',
    displayDate: 'August 4, 2026',
    version: '1.4',
    entries: [
      {
        title: 'Audio quality fix',
        items: [
          'Disabled browser echo cancellation, noise suppression, and auto-gain control on recording — these voice-call features were causing popping and cracking artifacts on sustained guitar tones',
          'Fixed key/BPM detection silently failing on iOS due to a forced sample rate on the audio analysis context',
          'Analysis errors now show a visible message instead of failing silently',
        ],
      },
      {
        title: 'Mobile layout fixes',
        items: [
          'Added proper viewport meta tag so the app renders at actual device width on iOS instead of desktop-scaled-down',
          'Fixed horizontal overflow across the app',
          'Moved Changelog out of the tab bar into a link below the Google Drive note, freeing up space on small screens',
          'Fixed Key Finder scale degree cards so all 7 fit on one row on mobile',
        ],
      },
      {
        title: 'Library performance',
        items: [
          'Fixed library load time growing slower as more recordings were added — metadata was being looked up with one Drive search request per clip; now fetched in a single batched request and matched locally',
          'Fixed a silent cap that limited the library to the first 100 recordings — clip loading now pages through the full library',
        ],
      },
      {
        title: 'Versioning',
        items: [
          'Added version number and last-updated date display on the main page',
          'Changelog entries older than 60 days now move to a collapsible archive section',
        ],
      },
    ],
  },
  {
    date: '2026-06-11',
    displayDate: 'June 11, 2026',
    version: '1.2',
    entries: [
      {
        title: 'Practice Tab — complete rebuild',
        items: [
          '250 single-note licks across 5 scale groups (Minor Pentatonic, Major Pentatonic, Blues, Natural Minor, Major) — max 3 frets between notes, max 1 string jump, 5–8 notes each',
          '250 double stop riffs with the same scale groups — each column has exactly 2 notes within 5 frets of each other, consecutive diads share a note within 3 semitones, contained within any 4-string span',
          '480 chord riffs — 20 per key across all 24 keys, using open chords and barre shapes, consecutive chords within 5 frets of each other',
          'Mode selector dropdown: Single-note Licks / Double Stops / Chord Riffs',
          'Key selector transposes licks and double stops to the selected key and limits scale options to musically appropriate choices (major keys → major scales, minor keys → minor scales)',
          'Chord riffs filtered by key — selecting a key shows only progressions in that key',
          'Scale, Difficulty, and Type dropdowns all labeled',
          'All tab diagrams now display with low E at the bottom, matching standard guitar notation',
          'Fretboard diagram from Key Finder appears below each lick or riff when a key is selected',
        ],
      },
      {
        title: 'Key Finder — refactored',
        items: [
          'Extracted Fretboard diagram and scale note logic into a shared FretboardDiagram component used by both Key Finder and Practice',
        ],
      },
      {
        title: 'Record Tab',
        items: [
          'Added a note below the record button explaining that recordings are saved to Google Drive in a folder called RiffCatalog, and that the app cannot see anything else in the user\'s Drive',
        ],
      },
      {
        title: 'Bug fixes',
        items: [
          'Fixed scale selector in Practice tab returning zero results when switching away from Minor Pentatonic',
          'Fixed key selector not locking scale groups to musically appropriate options for the chosen key',
          'Fixed string label order on all tab diagrams — high e is now at the top, low E at the bottom',
        ],
      },
    ],
  },
  {
    date: '2026-06-10',
    displayDate: 'June 10, 2026',
    version: '1.1',
    entries: [
      {
        title: 'Project setup',
        items: [
          'Google Cloud project created with Drive API enabled and OAuth consent screen configured',
          'OAuth scope set to drive.file — app can only access files it creates, nothing else in the user\'s Drive',
          'React + Vite app scaffolded and connected to Google OAuth login',
          'Deployed to Netlify at scintillating-lollipop-de03ae.netlify.app',
          'GitHub repository created at github.com/therightclique/Riff-Catalog',
          'App published (not in test mode) so all Google accounts can sign in',
        ],
      },
      {
        title: 'Recording',
        items: [
          'Red circle record button with live waveform visualization using Web Audio API',
          'Centered timer display below waveform while recording',
          'Stop button ends recording and triggers upload flow',
        ],
      },
      {
        title: 'Google Drive storage',
        items: [
          'Recordings uploaded to RiffCatalog/YYYY/MM folder structure in the user\'s Drive',
          'JSON sidecar file saved alongside each recording with all metadata',
          'Key detection candidates array saved at upload time so analysis is preserved',
        ],
      },
      {
        title: 'Library',
        items: [
          'Clips loaded from Google Drive with playback, download, and expand controls',
          'Sort options: Newest, Oldest, Title A–Z, Title Z–A, Duration',
          'Playback speed control: 0.5×, 0.75×, 1×',
          'Duration display on each clip',
          'Recently Added section showing the top 5 most recent clips, collapsible',
          'Bulk selection and bulk metadata editing with 10-second undo',
        ],
      },
      {
        title: 'Metadata',
        items: [
          'Full metadata editor: Key, BPM, Time Signature, Instrument, Tuning, Genre, Capo, Quality, Needs Lyrics, Mood (multi-select chips), Tags (freeform), Notes/Lyrics',
          'Instruments: Guitar, Bass, Drums, Speech, Singing, Keyboard/Piano, Combination, Other',
          'Tunings: E Standard, Half-Step Down, Drop D, D Standard, Drop C#, Open G, Open E, DADGAD, Other',
          'Genres: 22 options including Alternative, Blues, Jazz, Metal, R&B/Soul, and more',
          'Moods: 15 options including Chill, Dark, Energetic, Melancholy, Uplifting, and more',
          'Auto key and BPM detection using Meyda audio analysis with Krumhansl-Schmuckler key scoring',
          '8 key candidates ranked and saved at upload; top candidate pre-selected in editor',
        ],
      },
      {
        title: 'Filtering',
        items: [
          'Collapsible filter panel with filters for Key, Instrument, Tuning, Genre, Time Signature, Quality, Capo, Needs Lyrics, Mood, and Tags',
          'Key filter supports exact match, relative key, and related keys (circle of fifths)',
          'All 24 sharp keys supported throughout — no flat equivalents used',
        ],
      },
      {
        title: 'Key Finder',
        items: [
          'Select any of 24 keys and see all 7 diatonic scale degrees with chord quality labels',
          'Interactive SVG fretboard showing scale notes highlighted across all 12 frets',
          'Root notes shown in red, other scale notes in blue',
          'Mini chord diagrams for all 7 chords in the selected key',
          'Find Clips button jumps to Library filtered to that key',
        ],
      },
      {
        title: 'Duplicate detection',
        items: [
          'Inline warning when a recording shares a name with an existing clip',
          'Suggested rename shown automatically',
        ],
      },
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;
export const LAST_UPDATED = CHANGELOG[0].displayDate;

function daysSince(dateStr) {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function ChangelogDay({ day }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          backgroundColor: '#1a73e8', color: 'white', borderRadius: '8px',
          padding: '4px 14px', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap',
        }}>
          {day.displayDate}
        </div>
        <div style={{
          fontSize: '12px', color: '#666', fontWeight: '600',
        }}>
          v{day.version}
        </div>
        <div style={{ flex: 1, height: '1px', backgroundColor: '#2a2a2a' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {day.entries.map((entry) => (
          <div key={entry.title} style={{
            border: '1px solid #2a2a2a', borderRadius: '10px', overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 16px', backgroundColor: '#1e1e1e',
              fontSize: '14px', fontWeight: '600', color: '#ddd',
              borderBottom: '1px solid #2a2a2a',
            }}>
              {entry.title}
            </div>
            <ul style={{ margin: 0, padding: '12px 16px 12px 32px', listStyleType: 'disc' }}>
              {entry.items.map((item, i) => (
                <li key={i} style={{
                  fontSize: '13px', color: '#aaa', lineHeight: '1.7', marginBottom: '2px',
                }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Changelog() {
  const [showArchive, setShowArchive] = useState(false);

  // Most recent entry always stays visible regardless of age.
  // Everything else visible if updated within the last 60 days; older goes to archive.
  const [mostRecent, ...rest] = CHANGELOG;
  const recentEntries = rest.filter(day => daysSince(day.date) <= 60);
  const archivedEntries = rest.filter(day => daysSince(day.date) > 60);

  return (
    <div style={{ marginTop: '20px', maxWidth: '700px', margin: '20px auto', padding: '0 16px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>Changelog</h2>
      <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '32px' }}>
        A running log of everything added and changed in Riff Catalog.
      </p>

      <ChangelogDay day={mostRecent} />
      {recentEntries.map((day) => <ChangelogDay key={day.date} day={day} />)}

      {archivedEntries.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <button
            onClick={() => setShowArchive(v => !v)}
            style={{
              width: '100%', padding: '10px 16px', backgroundColor: '#1e1e1e',
              border: '1px solid #2a2a2a', borderRadius: '8px', color: '#aaa',
              fontSize: '13px', cursor: 'pointer', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span>Archive ({archivedEntries.length} older update{archivedEntries.length !== 1 ? 's' : ''})</span>
            <span>{showArchive ? '▲' : '▼'}</span>
          </button>
          {showArchive && (
            <div style={{ marginTop: '20px' }}>
              {archivedEntries.map((day) => <ChangelogDay key={day.date} day={day} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

