// Captures console output and unhandled errors into a buffer that persists
// across reloads and app relaunches (localStorage), so nothing important
// is lost right when it matters most — e.g. right before a crash. Only
// clearEntries() (the Debug tab's Clear button) empties it.

const MAX_ENTRIES = 800;
const STORAGE_KEY = 'rc_debug_log';
const listeners = new Set();
let initialized = false;

function loadStoredEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // corrupted storage — start fresh rather than crash
  }
}

const entries = loadStoredEntries();

let persistTimer = null;
function persist() {
  // Writing to localStorage on every single log call adds up during rapid
  // bursts (audio analysis alone can log dozens of entries in a second).
  // Debounce the actual write; the in-memory array (and subscribers) stay
  // instant regardless.
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Storage full or unavailable (e.g. private browsing) — logging
      // still works for the current session via the in-memory array, it
      // just won't survive a reload. Never let this break the app.
    }
  }, 250);
}

window.addEventListener('pagehide', () => {
  // Make sure the last burst of entries before the app closes actually
  // gets written — this is exactly the moment persistence matters most.
  clearTimeout(persistTimer);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch { /* ignore */ }
});

function notify() {
  listeners.forEach(fn => fn(entries));
}

function serialize(arg) {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? '\n' + arg.stack : ''}`;
  }
  if (typeof arg === 'string') return arg;
  if (arg === undefined) return 'undefined';
  if (arg === null) return 'null';
  try {
    return JSON.stringify(arg, (k, v) => {
      if (v instanceof Error) return `${v.name}: ${v.message}`;
      if (ArrayBuffer.isView(v)) return `[${v.constructor.name} length=${v.length}]`;
      if (v instanceof ArrayBuffer) return `[ArrayBuffer byteLength=${v.byteLength}]`;
      if (v instanceof Blob) return `[Blob type=${v.type} size=${v.size}]`;
      return v;
    }, 2);
  } catch {
    return String(arg);
  }
}

function localTimestamp() {
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  // Render in the browser's local timezone rather than UTC.
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export function addEntry(level, args) {
  entries.push({
    level,
    time: localTimestamp(),
    text: args.map(serialize).join(' '),
  });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  persist();
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(entries);
  return () => listeners.delete(fn);
}

export function clearEntries() {
  entries.length = 0;
  persist();
  notify();
}

export function getEntries() {
  return entries;
}

export function localFileStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_` +
         `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

export function formatAsText() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  const header = [
    `Riff Catalog debug log`,
    `Generated: ${new Date().toString()}`,
    `Timestamps shown in: ${tz}`,
    `User agent: ${navigator.userAgent}`,
    `Entries: ${entries.length}`,
    '',
  ].join('\n');
  const body = entries
    .map(e => `[${e.time}] ${e.level.toUpperCase()}: ${e.text}`)
    .join('\n');
  return header + body + '\n';
}

export function initDebugLog() {
  if (initialized) return;
  initialized = true;

  ['log', 'info', 'warn', 'error', 'debug'].forEach(level => {
    const original = console[level]?.bind(console);
    if (!original) return;
    console[level] = (...args) => {
      try { addEntry(level, args); } catch { /* never break the app */ }
      original(...args);
    };
  });

  window.addEventListener('error', (e) => {
    addEntry('error', [
      `Uncaught ${e.message}`,
      `at ${e.filename}:${e.lineno}:${e.colno}`,
      e.error || '',
    ]);
  });

  window.addEventListener('unhandledrejection', (e) => {
    addEntry('error', ['Unhandled promise rejection:', e.reason]);
  });

  addEntry('info', [`── Session started (${entries.length} earlier entries retained) ──`]);
}
