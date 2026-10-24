// Pure date helpers. All dates are local time; weeks start on Monday.
const LOCALE = 'ru-RU';
const p2 = (n) => String(n).padStart(2, '0');

export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const addMinutes = (d, n) => new Date(d.getTime() + n * 60000);
export const weekdayIndex = (d) => (d.getDay() + 6) % 7; // Monday = 0
export const startOfWeek = (d) => addDays(startOfDay(d), -weekdayIndex(d));
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();

export const dayKey = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const parseDayKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const timeKey = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const combine = (dk, tk = '00:00') => {
  const d = parseDayKey(dk);
  const [h, m] = tk.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};
export const minutesToTime = (min) => `${p2(Math.floor(min / 60) % 24)}:${p2(min % 60)}`;

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const f = (o) => new Intl.DateTimeFormat(LOCALE, o);
const F = {
  wdShort: f({ weekday: 'short' }),
  wdLong: f({ weekday: 'long' }),
  dayMonth: f({ day: 'numeric', month: 'long' }),
  month: f({ month: 'long' }),
};

export const fmt = {
  wdShort: (d) => cap(F.wdShort.format(d).replace('.', '')),
  wdLong: (d) => cap(F.wdLong.format(d)),
  dayMonth: (d) => F.dayMonth.format(d),
  month: (d) => cap(F.month.format(d)),
  monthYear: (d) => `${cap(F.month.format(d))} ${d.getFullYear()}`,
  full: (d) => `${cap(F.wdLong.format(d))}, ${F.dayMonth.format(d)}`,
  time: (d) => timeKey(d),
};

export function durationLabel(min) {
  if (min >= 1440) return 'весь день';
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function isoWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - yearStart) / 86400000 + 1) / 7);
}
