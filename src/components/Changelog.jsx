const CHANGELOG = [
  {
    date: 'June 11, 2025',
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
    date: 'June 10, 2025',
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

export default function Changelog() {
  return (
    <div style={{ marginTop: '20px', maxWidth: '700px', margin: '20px auto', padding: '0 16px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>Changelog</h2>
      <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '32px' }}>
        A running log of everything added and changed in Riff Catalog.
      </p>

      {CHANGELOG.map((day) => (
        <div key={day.date} style={{ marginBottom: '40px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px',
          }}>
            <div style={{
              backgroundColor: '#1a73e8', color: 'white', borderRadius: '8px',
              padding: '4px 14px', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap',
            }}>
              {day.date}
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
      ))}
    </div>
  );
}
