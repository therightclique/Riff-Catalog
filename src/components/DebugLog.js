// Captures console output and unhandled errors into an in-memory buffer
// so they can be viewed on the Debug tab without a desktop browser.

const MAX_ENTRIES = 800;
const entries = [];
const listeners = new Set();
let initialized = false;

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
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(entries);
  return () => listeners.delete(fn);
}

export function clearEntries() {
  entries.length = 0;
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

  addEntry('info', ['Debug logging started']);
}
