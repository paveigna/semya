// Expands an event (possibly repeating) into concrete occurrences within [from, to).
import { addDays, combine, dayKey, parseDayKey, startOfDay } from './dates.js';

export function occurrencesInRange(ev, from, to) {
  const out = [];
  const start = combine(ev.date, ev.allDay ? '00:00' : ev.time);
  const dur = ev.allDay ? 1440 : ev.durationMin;
  const skip = new Set(ev.exceptions || []);
  const until = ev.until ? addDays(parseDayKey(ev.until), 1) : null;

  const push = (s) => {
    const e = new Date(s.getTime() + dur * 60000);
    if (e > from && s < to && !skip.has(dayKey(s)) && (!until || s < until)) {
      out.push({ ev, start: s, end: e, key: `${ev.id}@${dayKey(s)}` });
    }
  };

  if (!ev.repeat || ev.repeat === 'none') { push(start); return out; }

  if (ev.repeat === 'monthly') {
    let i = Math.max(0, (from.getFullYear() - start.getFullYear()) * 12 + from.getMonth() - start.getMonth() - 1);
    for (;; i++) {
      const s = new Date(start.getFullYear(), start.getMonth() + i, start.getDate(), start.getHours(), start.getMinutes());
      if (s >= to) break;
      if (s.getDate() !== start.getDate()) continue; // e.g. 31st in a 30-day month
      push(s);
    }
    return out;
  }

  const step = ev.repeat === 'daily' ? 1 : 7;
  const diff = Math.round((startOfDay(from) - startOfDay(start)) / 86400000);
  for (let k = Math.max(0, Math.floor(diff / step) - 1); ; k++) {
    const s = addDays(start, k * step); // addDays keeps wall-clock time across DST
    if (s >= to) break;
    push(s);
  }
  return out;
}
