// Single source of truth. All data lives only on this device (localStorage).
// To add sync later, replace load/persist with a remote adapter; the rest of the app is unchanged.
import { DEFAULT_SETTINGS, GEMINI_MODELS, STORAGE_KEY } from '../config.js';

const listeners = new Set();
let state = load();
let timer = null;

function blank() {
  return { version: 1, members: [], events: [], settings: { ...DEFAULT_SETTINGS } };
}

function migrate(s) {
  const next = { ...blank(), ...s };
  next.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  if (!GEMINI_MODELS.includes(next.settings.geminiModel)) next.settings.geminiModel = GEMINI_MODELS[0];
  next.members = Array.isArray(s.members) ? s.members : [];
  next.events = Array.isArray(s.events) ? s.events : [];
  next.version = 1;
  return next;
}

function load() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('Load failed', e);
  }
  return blank();
}

function writeNow() {
  clearTimeout(timer);
  timer = null;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Save failed', e);
    globalThis.dispatchEvent?.(new CustomEvent('app:error', { detail: 'Не удалось сохранить данные на устройстве' }));
  }
}

function emit() { listeners.forEach((fn) => fn(state)); }

export const store = {
  get: () => state,
  update(mutator) {
    mutator(state);
    clearTimeout(timer);
    timer = setTimeout(writeNow, 120);
    emit();
  },
  replace(next) {
    state = migrate(next);
    writeNow();
    emit();
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  flush() { if (timer) writeNow(); },
};
