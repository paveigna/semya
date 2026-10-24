// Backups in three layers:
//  1. Local snapshots on this iPad (undo for mistakes and bad restores).
//  2. Automatic copy to a private GitHub repository (survives deleting the app).
//  3. Manual backup file (iCloud Drive) — works without any setup.
// Keys (Gemini, GitHub) are never written into any backup.
import { store } from '../core/store.js';

const META_KEY = 'family-calendar:backup';
const SNAP_KEY = 'family-calendar:snapshots';
const SNAP_KEEP = 14;                   // daily snapshots kept on the device
const SNAP_EVERY = 20 * 3600e3;         // one snapshot per day
const PUSH_DELAY = 2 * 60e3;            // push 2 minutes after the last change
const PUSH_MIN_GAP = 10 * 60e3;         // never more often than every 10 minutes
const GH_FILE = 'semya-backup.json';
export const REMIND_AFTER = 14 * 24 * 3600e3;

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
export const onBackupChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/* ---------- meta (config + status), stored apart from family data ---------- */

function readJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
export const meta = () => readJSON(META_KEY, {});
function setMeta(patch, silent = false) {
  localStorage.setItem(META_KEY, JSON.stringify({ ...meta(), ...patch }));
  if (!silent) emit();
}

/* ---------- payload ---------- */

const hasData = (s) => s.events.length > 0 || s.members.length > 0;

function cleanData(state) {
  const { geminiKey, ...settings } = state.settings;
  return { ...state, settings };
}

export function payloadText(state = store.get()) {
  return JSON.stringify({ app: 'family-calendar', exportedAt: new Date().toISOString(), data: cleanData(state) }, null, 2);
}

function hash(state) {
  const str = JSON.stringify(cleanData(state));
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** Replace all data from a backup, keeping keys and taking a safety snapshot first. */
export function restoreFrom(text) {
  const obj = JSON.parse(text);
  const data = obj.data || obj;
  if (!Array.isArray(data?.events) || !Array.isArray(data?.members)) throw new Error('Файл не похож на резервную копию календаря');
  takeSnapshot('Перед восстановлением', true);
  const current = store.get().settings;
  data.settings = { ...(data.settings || {}), geminiKey: current.geminiKey };
  store.replace(data);
  setMeta({ lastPushHash: null }); // next change is pushed again
}

/* ---------- 1. local snapshots ---------- */

export const snapshots = () => readJSON(SNAP_KEY, []);

export function takeSnapshot(reason = 'Ежедневный снимок', force = false) {
  const state = store.get();
  if (!hasData(state)) return;
  const list = snapshots();
  const h = hash(state);
  const last = list[0];
  if (!force && last && (last.hash === h || Date.now() - last.at < SNAP_EVERY)) return;
  list.unshift({ at: Date.now(), reason, hash: h, events: state.events.length, members: state.members.length, data: cleanData(state) });
  // Keep the newest, drop the oldest if storage is full.
  for (let keep = SNAP_KEEP; keep > 0; keep--) {
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(list.slice(0, keep))); break; } catch { /* quota: retry with fewer */ }
  }
  emit();
}

export function restoreSnapshot(at) {
  const snap = snapshots().find((s) => s.at === at);
  if (!snap) throw new Error('Снимок не найден');
  restoreFrom(JSON.stringify({ data: snap.data }));
}

/* ---------- 2. GitHub ---------- */

export const githubConfigured = (m = meta()) => Boolean(m.repo && m.token);

export function setGithub({ repo, token }) {
  const patch = {};
  if (repo !== undefined) patch.repo = repo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/+$/, '');
  if (token !== undefined) patch.token = token.trim();
  setMeta({ ...patch, lastError: null, lastPushHash: null }, true); // silent: don't redraw while typing
}

function b64encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function gh(method, body) {
  const { repo, token } = meta();
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${repo}/contents/${GH_FILE}`, {
      method, cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new Error('Нет связи с GitHub'); }
  if (method === 'GET' && res.status === 404) return null;
  if (res.status === 401) throw new Error('Ключ GitHub недействителен или истёк');
  if (res.status === 403 || res.status === 404) throw new Error('Нет доступа к репозиторию. Проверьте имя и права ключа');
  if (!res.ok) throw new Error(`GitHub ответил ошибкой ${res.status}`);
  return res.json();
}

let pushing = false;

/** Upload the current data now. Throws on failure (used by the "Сохранить сейчас" button). */
export async function pushNow() {
  if (!githubConfigured()) throw new Error('Сначала укажите репозиторий и ключ');
  const state = store.get();
  if (!hasData(state)) throw new Error('Календарь пуст — нечего сохранять');
  if (pushing) return;
  pushing = true;
  setMeta({ lastAttemptAt: Date.now() });
  try {
    const existing = await gh('GET');
    const stamp = new Date().toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
    await gh('PUT', { message: `Копия ${stamp}: ${state.events.length} событий`, content: b64encode(payloadText(state)), sha: existing?.sha });
    setMeta({ lastPushAt: Date.now(), lastPushHash: hash(state), lastError: null });
  } catch (e) {
    setMeta({ lastError: e.message });
    throw e;
  } finally { pushing = false; }
}

/** Background push: only if configured, changed, not empty, and not too frequent. */
export async function autoPush() {
  const m = meta();
  const state = store.get();
  if (!githubConfigured(m) || !hasData(state) || !navigator.onLine) return;
  if (m.lastPushHash === hash(state)) return;
  if (m.lastAttemptAt && Date.now() - m.lastAttemptAt < PUSH_MIN_GAP) return;
  try { await pushNow(); } catch { /* status shown via meta.lastError */ }
}

export async function fetchFromGithub() {
  if (!githubConfigured()) throw new Error('Сначала укажите репозиторий и ключ');
  const file = await gh('GET');
  if (!file?.content) throw new Error('В репозитории ещё нет копии');
  return b64decode(file.content);
}

/* ---------- 3. backup file ---------- */

export async function exportFile() {
  const name = `family-calendar-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([payloadText()], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      setMeta({ lastFileAt: Date.now() });
      return;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setMeta({ lastFileAt: Date.now() });
}

/* ---------- reminder ---------- */

/** What the reminder banner should say, or null. */
export function backupWarning() {
  const m = meta();
  const state = store.get();
  if (!hasData(state)) return null;
  if (githubConfigured(m) && m.lastError) return { kind: 'error', text: `Автокопия не сохраняется: ${m.lastError}` };
  const githubFresh = githubConfigured(m) && m.lastPushAt && Date.now() - m.lastPushAt < 7 * 24 * 3600e3;
  if (githubFresh) return null;
  if (m.snoozeUntil && Date.now() < m.snoozeUntil) return null;
  const since = m.lastFileAt || m.firstSeenAt;
  if (since && Date.now() - since < REMIND_AFTER) return null;
  return { kind: 'remind', text: m.lastFileAt ? 'Больше двух недель без резервной копии' : 'Сохраните резервную копию календаря' };
}
export const snoozeReminder = () => setMeta({ snoozeUntil: Date.now() + 3 * 24 * 3600e3 });

/* ---------- start ---------- */

let pushTimer = null;
export function startBackups() {
  if (!meta().firstSeenAt) setMeta({ firstSeenAt: Date.now() });
  takeSnapshot();
  autoPush();
  store.subscribe(() => { clearTimeout(pushTimer); pushTimer = setTimeout(autoPush, PUSH_DELAY); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { takeSnapshot(); autoPush(); }
  });
  window.addEventListener('online', () => autoPush());
}
