// Domain operations. UI and voice both go through these functions only.
import { JOINT_ID } from '../config.js';
import { store } from './store.js';
import { occurrencesInRange } from './recurrence.js';
import { addDays, dayKey, parseDayKey } from './dates.js';

export const uid = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/* ---------- members ---------- */

export function saveMember(member) {
  let id = member.id;
  store.update((s) => {
    const i = s.members.findIndex((m) => m.id === id);
    if (i >= 0) s.members[i] = { ...s.members[i], ...member };
    else { id = uid(); s.members.push({ ...member, id }); }
  });
  return id;
}

export function deleteMember(id) {
  store.update((s) => {
    s.members = s.members.filter((m) => m.id !== id);
    for (const e of s.events) e.memberIds = e.memberIds.filter((x) => x !== id);
    s.events = s.events.filter((e) => e.memberIds.length > 0);
  });
}

/* ---------- events ---------- */

export function normalizeEvent(ev) {
  const allDay = !!ev.allDay;
  return {
    id: ev.id || uid(),
    title: (ev.title || '').trim() || 'Событие',
    emoji: ev.emoji || '',
    memberIds: ev.memberIds?.length ? [...new Set(ev.memberIds)] : [JOINT_ID],
    date: ev.date,
    time: allDay ? '00:00' : ev.time || '09:00',
    durationMin: allDay ? 1440 : Math.max(5, Number(ev.durationMin) || 60),
    allDay,
    repeat: ev.repeat || 'none',
    until: ev.until || null,
    exceptions: ev.exceptions || [],
    notes: ev.notes || '',
    createdAt: ev.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

export function saveEvent(ev) {
  const clean = normalizeEvent(ev);
  store.update((s) => {
    const i = s.events.findIndex((e) => e.id === clean.id);
    if (i >= 0) s.events[i] = clean; else s.events.push(clean);
  });
  return clean.id;
}

export function deleteEvent(id) {
  store.update((s) => { s.events = s.events.filter((e) => e.id !== id); });
}

/** Removes one occurrence of a repeating event. */
export function skipOccurrence(id, dk) {
  store.update((s) => {
    const e = s.events.find((x) => x.id === id);
    if (e) e.exceptions = [...new Set([...(e.exceptions || []), dk])];
  });
}

/** Changes one occurrence of a repeating event by splitting it off as a single event. */
export function editOccurrence(id, dk, changes) {
  const e = store.get().events.find((x) => x.id === id);
  if (!e) return null;
  skipOccurrence(id, dk);
  const { id: _i, createdAt: _c, ...rest } = e;
  return saveEvent({ ...rest, date: dk, repeat: 'none', until: null, exceptions: [], ...changes });
}

/** Changes the whole series; a date change shifts the series by the same number of days. */
export function editSeries(id, occurrenceDk, changes) {
  const e = store.get().events.find((x) => x.id === id);
  if (!e) return null;
  const next = { ...e, ...changes };
  if (changes.date && occurrenceDk) {
    const delta = Math.round((parseDayKey(changes.date) - parseDayKey(occurrenceDk)) / 86400000);
    next.date = dayKey(addDays(parseDayKey(e.date), delta));
    if (delta !== 0) next.exceptions = [];
  }
  return saveEvent(next);
}

/* ---------- settings ---------- */

export function updateSettings(patch) {
  store.update((s) => { Object.assign(s.settings, patch); });
}

/* ---------- queries ---------- */

export const isJoint = (ev) => ev.memberIds.includes(JOINT_ID);

export const membersOf = (ev, state) =>
  ev.memberIds.map((id) => state.members.find((m) => m.id === id)).filter(Boolean);

export function colorsOf(ev, state) {
  if (isJoint(ev)) return [state.settings.jointColor];
  const c = membersOf(ev, state).map((m) => m.color);
  return c.length ? c : [state.settings.jointColor];
}

export function whoLabel(ev, state) {
  if (isJoint(ev)) return 'Вся семья';
  return membersOf(ev, state).map((m) => m.name).join(', ') || 'Вся семья';
}

/** Occurrences in range. Joint events are always shown; filter limits personal ones. */
export function occurrences(state, from, to, filter) {
  const out = [];
  for (const ev of state.events) {
    if (filter?.size && !isJoint(ev) && !ev.memberIds.some((id) => filter.has(id))) continue;
    out.push(...occurrencesInRange(ev, from, to));
  }
  return out.sort((a, b) => a.start - b.start || b.end - a.end);
}

/* ---------- backup ---------- */

export function exportData() {
  const { geminiKey, ...settings } = store.get().settings;
  return JSON.stringify({ app: 'family-calendar', exportedAt: new Date().toISOString(), data: { ...store.get(), settings } }, null, 2);
}

export function importData(text) {
  const obj = JSON.parse(text);
  const data = obj.data || obj;
  if (!Array.isArray(data.events) || !Array.isArray(data.members)) throw new Error('Файл не похож на резервную копию календаря');
  store.replace(data);
}
