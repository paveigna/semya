// Optional smart parser via Google Gemini. The key is stored only on this iPad.
import { JOINT_ID } from '../config.js';
import { addDays, dayKey, fmt, startOfDay, timeKey } from '../core/dates.js';
import { occurrences, membersOf, isJoint } from '../core/actions.js';

const SYSTEM = `You convert a Russian voice command for a family calendar into JSON. Reply with JSON only.
Schema:
{"action":"add"|"delete"|"edit"|"unknown",
 "event":{"title":string,"emoji":string,"memberIds":[string],"date":"YYYY-MM-DD","time":"HH:MM","durationMin":number,"allDay":boolean,"repeat":"none"|"daily"|"weekly"|"monthly"},
 "targetIds":[string], "targetDate":"YYYY-MM-DD"|null,
 "changes":{"title"?:string,"date"?:"YYYY-MM-DD","time"?:"HH:MM","durationMin"?:number,"memberIds"?:[string]}}
Rules:
- "event" only for add; "targetIds"/"targetDate"/"changes" only for delete and edit.
- Titles in Russian, short, capitalised, in nominative case (e.g. "Танцы", not "танцев"). Pick one fitting emoji.
- memberIds must be ids from the members list. Use "${JOINT_ID}" for the whole family. Empty if nobody is named.
- Weeks start on Monday. Resolve relative dates from "today". A weekday without "следующий" means its next occurrence (today counts).
- Times like "в 5" or "в 6" for children's activities mean 17:00/18:00 unless "утра" is said.
- Default durationMin 60 when not said.
- targetIds: ids from the events list that the command refers to; targetDate: the occurrence date being changed or deleted.
- If the command is unclear, return {"action":"unknown"}.`;

function context(state, now) {
  const from = addDays(startOfDay(now), -7);
  const to = addDays(startOfDay(now), 45);
  const seen = new Map();
  for (const o of occurrences(state, from, to)) {
    if (seen.size >= 80) break;
    const k = o.key;
    if (!seen.has(k)) {
      seen.set(k, {
        id: o.ev.id, title: o.ev.title, date: dayKey(o.start), time: o.ev.allDay ? 'весь день' : timeKey(o.start),
        repeat: o.ev.repeat, who: isJoint(o.ev) ? 'вся семья' : membersOf(o.ev, state).map((m) => m.name).join(', '),
      });
    }
  }
  return {
    today: dayKey(now), weekday: fmt.wdLong(now), now: timeKey(now),
    members: state.members.map((m) => ({ id: m.id, name: m.name, role: m.role || (m.kind === 'helper' ? 'помощник' : 'семья') })),
    events: [...seen.values()],
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function sanitize(raw, state) {
  const ids = new Set([JOINT_ID, ...state.members.map((m) => m.id)]);
  const eventIds = new Set(state.events.map((e) => e.id));
  const mem = (list) => (Array.isArray(list) ? list.filter((x) => ids.has(x)) : []);
  if (raw.action === 'add' && raw.event && DATE.test(raw.event.date)) {
    const e = raw.event;
    return {
      action: 'add', source: 'gemini', complete: true,
      event: {
        title: String(e.title || '').slice(0, 80), emoji: String(e.emoji || '').slice(0, 8), memberIds: mem(e.memberIds),
        date: e.date, time: TIME.test(e.time) ? e.time : '09:00', durationMin: Number(e.durationMin) || 60,
        allDay: !!e.allDay, repeat: ['none', 'daily', 'weekly', 'monthly'].includes(e.repeat) ? e.repeat : 'none',
      },
    };
  }
  if (raw.action === 'delete' || raw.action === 'edit') {
    const target = { ids: (raw.targetIds || []).filter((x) => eventIds.has(x)), date: DATE.test(raw.targetDate) ? raw.targetDate : null };
    const c = raw.changes || {};
    const changes = {};
    if (c.title) changes.title = String(c.title).slice(0, 80);
    if (DATE.test(c.date)) changes.date = c.date;
    if (TIME.test(c.time)) changes.time = c.time;
    if (Number(c.durationMin) > 0) changes.durationMin = Number(c.durationMin);
    if (Array.isArray(c.memberIds) && mem(c.memberIds).length) changes.memberIds = mem(c.memberIds);
    return { action: raw.action, source: 'gemini', complete: target.ids.length > 0, target, changes };
  }
  return { action: 'unknown', source: 'gemini' };
}

async function geminiError(r, model) {
  let msg = '';
  try { msg = (await r.json())?.error?.message || ''; } catch { /* no body */ }
  if (/api key not valid|API_KEY_INVALID/i.test(msg)) return 'Неверный ключ Gemini. Скопируйте его заново';
  if (r.status === 404) return `Модель ${model} недоступна. Выберите другую модель`;
  if (r.status === 429) return 'Лимит Gemini исчерпан. Попробуйте позже';
  if (r.status === 403) return 'Ключ не имеет доступа к Gemini API';
  return `Gemini: ошибка ${r.status}${msg ? ` — ${msg.slice(0, 120)}` : ''}`;
}

export async function parseGemini(text, state, { key, model }, now = new Date()) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: `Context: ${JSON.stringify(context(state, now))}\n\nCommand: ${text}` }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    let r;
    try {
      r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    } catch (e) { throw new Error(e.name === 'AbortError' ? 'Gemini не ответил вовремя' : 'Нет связи с Gemini'); }
    if (!r.ok) throw new Error(await geminiError(r, model));
    const j = await r.json();
    const out = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    return sanitize(JSON.parse(out.replace(/```json|```/g, '').trim()), state);
  } finally {
    clearTimeout(timer);
  }
}
