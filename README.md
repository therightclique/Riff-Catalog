# 🎸 Riff Catalog

A web app for capturing, organizing, and exploring musical ideas. Record audio clips from your phone or computer, auto-detect key and BPM, annotate with metadata, and browse your library with powerful filters.

**Live app:** https://scintillating-lollipop-de03ae.netlify.app

---

## Features

- **Record** audio directly from your browser with a live waveform display
- **Auto-detect** key and BPM on every recording
- **Metadata** — key, BPM, instrument, tuning, capo, genre, time signature, mood, quality, tags, and notes
- **Library** with sorting, filtering by any metadata field, bulk editing, and a Recently Added section
- **Key Finder** — fretboard diagram and chord shapes for all 24 keys
- **Practice** — lick library with tab notation that auto-transposes to any key
- All recordings stored in your own Google Drive — nothing is shared

---

## Running Your Own Copy

### Prerequisites

Before starting, install the following. Each link goes to the official download page.

- **Node.js** (includes npm): https://nodejs.org — download the LTS version and run the installer with all defaults
- **Git**: https://git-scm.com/download/win — run the installer with all defaults

After installing, close and reopen your terminal before continuing.

---

### Step 1 — Clone the repository

```
git clone https://github.com/therightclique/Riff-Catalog.git
cd Riff-Catalog
```

---

### Step 2 — Install dependencies

```
npm install
```

---

### Step 3 — Set up Google Cloud

The app uses Google OAuth for login and Google Drive for storage. You need your own Google Cloud project.

1. Go to https://console.cloud.google.com and create a new project
2. Navigate to **APIs & Services → Library** and enable the **Google Drive API**
3. Go to **APIs & Services → OAuth consent screen**
   - Choose **External**
   - Fill in app name and your email
   - Add the scope: `https://www.googleapis.com/auth/drive.file`
   - Under **Audience**, publish the app (or add your email as a test user)
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Under **Authorized JavaScript origins**, add:
     - `http://localhost:5173`
   - Click **Create** and copy your **Client ID**

---

### Step 4 — Add your Client ID to the app

Open `src/App.jsx` and replace the Client ID on line 9:

```js
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
```

---

### Step 5 — Run the app locally

```
npm run dev -- --host
```

Open http://localhost:5173 in your browser.

---

### Step 6 — Deploy to Netlify (optional)

To host it publicly:

1. Build the app:
   ```
   npm run build
   ```
2. Go to https://netlify.com, create a free account, and drag the `dist` folder onto the deploy area
3. Add your Netlify URL to **Authorized JavaScript origins** in Google Cloud (same place as Step 3)
4. Wait ~5 minutes for Google to propagate, then open your Netlify URL

---

## Tech Stack

- React + Vite
- Google OAuth 2.0 (login)
- Google Drive API (storage)
- Meyda (audio analysis)
- Deployed on Netlify
