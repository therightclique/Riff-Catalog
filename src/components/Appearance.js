// Light / dark / follow-the-device appearance. Saved on THIS device only (a
// phone and a PC often want different looks), applied before the first screen
// is drawn. It works by setting data-theme on <html>; index.css does the rest.

const KEY = 'rc_theme';
const MODES = ['system', 'light', 'dark'];
let theme = 'system';
const listeners = new Set();

function apply() {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

try {
  const saved = localStorage.getItem(KEY);
  if (MODES.includes(saved)) theme = saved;
} catch { /* storage unavailable — follow the device */ }
if (typeof document !== 'undefined') apply();

export const getTheme = () => theme;
export const subscribeTheme = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function setTheme(next) {
  if (!MODES.includes(next) || next === theme) return;
  theme = next;
  try { localStorage.setItem(KEY, theme); } catch { /* remembering is optional */ }
  apply();
  listeners.forEach(fn => { try { fn(theme); } catch { /* ignore */ } });
}

// Whether the app is showing dark right now (for the few places that draw their own colors).
export function isDark() {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
}
