// Offline Russian command parser. Handles common phrasings, e.g.
//   «Добавь Маше танцы в среду в 17 на час»
//   «Каждую субботу в 10 утра бассейн всей семьёй»
//   «Перенеси танцы со среды на четверг в 18»
//   «Удали уборку в пятницу»
import { EMOJI_HINTS, JOINT_ID } from '../config.js';
import { addDays, cap, dayKey, minutesToTime, startOfDay, startOfWeek, weekdayIndex } from '../core/dates.js';

const NUM = {
  один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7,
  восемь: 8, девять: 9, десять: 10, одиннадцать: 11, двенадцать: 12, пятнадцать: 15,
  двадцать: 20, тридцать: 30, сорок: 40,
};
const WD = ['понедельник', 'вторник', 'сред', 'четверг', 'пятниц', 'суббот', 'воскресен'];
const WD_RE = `(${WD.join('|')})[а-я]*`;
const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'ма[йя]', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
const MONTH_RE = `(${MONTHS.join('|')})[а-я]*`;
const PREP = '(?:(с|со|на|в|во|к) )?';
const STOP = new Set(['в', 'во', 'на', 'у', 'для', 'с', 'со', 'к', 'по', 'и', 'а', 'мне', 'нам', 'пожалуйста',
  'это', 'эту', 'этот', 'событие', 'запись', 'час', 'часа', 'часов', 'время', 'до', 'от', 'из', 'про', 'о', 'об', 'пусть', 'будет']);

/** Pattern helper: a space in the source means "one or more whitespace". */
const R = (src) => new RegExp(src.replace(/ /g, '\\s+'));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function normalize(text) {
  let s = text.toLowerCase().replace(/ё/g, 'е').replace(/[,!?;«»"()]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/сорок пять/g, '45');
  for (const [w, n] of Object.entries(NUM)) s = s.replace(new RegExp(`(^|\\s)${w}(?=\\s|$)`, 'g'), `$1${n}`);
  return s;
}

function toMin(h, m, q, guessPm = true) {
  h = Number(h); m = m ? Number(m) : 0;
  if (h > 23 || m > 59) return null;
  if (q === 'вечера' || q === 'дня') { if (h < 12) h += 12; }
  else if (q === 'ночи' || q === 'утра') { if (h === 12) h = 0; }
  else if (guessPm && h >= 1 && h <= 7) h += 12; // «в 5» for family activities almost always means 17:00
  return h * 60 + m;
}

function weekdayDate(stem, mod, today) {
  const wd = WD.indexOf(stem);
  if (mod?.startsWith('следующ')) return addDays(startOfWeek(today), 7 + wd);
  if (mod?.startsWith('эт')) return addDays(startOfWeek(today), wd);
  return addDays(today, (wd - weekdayIndex(today) + 7) % 7);
}

function monthDate(day, monthWord, today) {
  const mi = MONTHS.findIndex((m) => new RegExp(`^${m}`).test(monthWord));
  if (mi < 0 || day < 1 || day > 31) return null;
  let d = new Date(today.getFullYear(), mi, day);
  if (d < addDays(today, -60)) d = new Date(today.getFullYear() + 1, mi, day);
  return d;
}

function stemsOf(member) {
  return [member.name, member.role].filter(Boolean).map((w) => {
    const word = w.toLowerCase().replace(/ё/g, 'е').split(/\s+/)[0];
    const stem = word.length >= 3 && /[аяоеиыйьу]$/.test(word) ? word.slice(0, -1) : word;
    return { stem, role: w === member.role ? member.role : null };
  }).filter((x) => x.stem.length >= 2);
}

export function emojiFor(text) {
  const t = ` ${text.toLowerCase().replace(/ё/g, 'е')} `;
  return EMOJI_HINTS.find(([re]) => re.test(t))?.[1] || '';
}

export function parseRules(text, state, now = new Date()) {
  let s = ` ${normalize(text)} `;
  const today = startOfDay(now);
  // Replace matches with equal-length spaces so positions stay comparable.
  const take = (re) => {
    const m = s.match(re);
    if (!m) return null;
    s = s.slice(0, m.index) + ' '.repeat(m[0].length) + s.slice(m.index + m[0].length);
    return m;
  };
  let m;

  /* intent */
  let action = 'add';
  if (take(R(' (удали(?:ть|те)?|убери(?:те)?|убрать|отмени(?:ть|те)?|сотри(?:те)?) '))) action = 'delete';
  else if (take(R(' (перенеси(?:те)?|перенести|измени(?:ть|те)?|поменяй(?:те)?|сдвинь(?:те)?|передвинь(?:те)?) '))) action = 'edit';
  while (take(R(' (добавь(?:те)?|добавить|запиши(?:те)?|записать|создай(?:те)?|поставь(?:те)?|запланируй(?:те)?|напомни(?:те)?|в календарь|новое событие|событие) ')));

  /* repeat */
  let repeat = 'none';
  let repeatWd = null;
  if (take(R(' (каждый день|ежедневно) '))) repeat = 'daily';
  else if (take(R(' (каждый месяц|ежемесячно) '))) repeat = 'monthly';
  else if ((m = take(R(` (?:каждый|каждую|каждое|по) ${WD_RE} `)))) { repeat = 'weekly'; repeatWd = m[1]; }
  else if (take(R(' (каждую неделю|еженедельно) '))) repeat = 'weekly';

  /* duration and ranges */
  let durationMin = null;
  let allDay = false;
  const times = [];
  if (take(R(' (?:на )?(?:весь|целый) день '))) allDay = true;
  if ((m = take(R(' (?:с|со) (\\d{1,2})(?:[:.](\\d{2}))? (?:до|по) (\\d{1,2})(?:[:.](\\d{2}))?(?: (утра|дня|вечера))? ')))) {
    const a = toMin(m[1], m[2], m[5]);
    let b = toMin(m[3], m[4], m[5]);
    if (a != null && b != null) {
      if (b <= a) b += 720;
      times.push({ min: a, index: m.index });
      durationMin = b - a;
    }
  }
  if (take(R(' (?:на )?(?:полтора|1[.,]5) часа '))) durationMin = 90;
  else if (take(R(' (?:на )?полчаса '))) durationMin = 30;
  else if ((m = take(R(' на (\\d{1,2}) (с половиной )?час(?:а|ов)? ')))) durationMin = Number(m[1]) * 60 + (m[2] ? 30 : 0);
  else if (take(R(' на час '))) durationMin = 60;
  else if ((m = take(R(' на (\\d{1,3}) мин[а-я]* ')))) durationMin = Number(m[1]);

  /* explicit clock times like 17:30 (before dates, so «17.30» is not read as a date) */
  while (times.length < 2 && (m = take(R(` ${PREP}(\\d{1,2})[:.](\\d{2})(?: (утра|дня|вечера|ночи))? `)))) {
    const v = toMin(m[2], m[3], m[4], false);
    if (v != null) times.push({ min: v, index: m.index, prep: m[1] });
  }

  /* dates */
  const dates = [];
  const DATE_RULES = [
    [R(` ${PREP}(сегодня) `), () => today],
    [R(` ${PREP}(послезавтра) `), () => addDays(today, 2)],
    [R(` ${PREP}(завтра) `), () => addDays(today, 1)],
    [R(` ${PREP}(?:(следующ[а-я]*|эт[а-я]*|ближайш[а-я]*) )?${WD_RE} `), (x) => weekdayDate(x[3], x[2], today)],
    [R(` ${PREP}(\\d{1,2}) ${MONTH_RE} `), (x) => monthDate(Number(x[2]), x[3], today)],
    [R(` ${PREP}(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))? `), (x) => {
      const d = Number(x[2]); const mo = Number(x[3]);
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
      return monthDate(d, MONTHS[mo - 1].replace('[йя]', 'я'), today);
    }],
  ];
  for (const [re, fn] of DATE_RULES) {
    while (dates.length < 2 && (m = take(re))) {
      const d = fn(m);
      if (d) dates.push({ date: d, index: m.index, prep: m[1] });
    }
  }
  dates.sort((a, b) => a.index - b.index);

  /* remaining times: «в 17», «в 5 вечера», «к 9 утра», «в полдень» */
  if (take(R(' (?:в|к) полдень '))) times.push({ min: 720, index: 0 });
  while (times.length < 2 && (m = take(R(' (в|к|на|с|со) (\\d{1,2})(?: (\\d{2}))?(?: час(?:а|ов)?)?(?: (утра|дня|вечера|ночи))? ')))) {
    const v = toMin(m[2], m[3], m[4]);
    if (v != null) times.push({ min: v, index: m.index, prep: m[1] });
  }
  if (!times.length) {
    if (take(R(' утром '))) times.push({ min: 540, index: 0 });
    else if (take(R(' днем '))) times.push({ min: 780, index: 0 });
    else if (take(R(' вечером '))) times.push({ min: 1080, index: 0 });
  }
  times.sort((a, b) => a.index - b.index);

  /* who */
  const memberIds = new Set();
  let roleTitle = '';
  if (take(R(' (?:для )?(?:всей семьи|всей семьей|вся семья|всей семье|всю семью|семьей|для всех|все вместе|всем вместе|семейн[а-я]*) '))) memberIds.add(JOINT_ID);
  for (const mem of state.members) {
    for (const { stem, role } of stemsOf(mem)) {
      const re = R(` (?:(?:у|для|с|со|к) )?${esc(stem)}[а-я]{0,3} `);
      while (take(re)) { memberIds.add(mem.id); if (role) roleTitle = role; }
    }
  }

  /* what */
  const words = s.split(/\s+/).filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));
  let title = words.join(' ');
  if (!title && roleTitle) title = roleTitle;
  const emoji = emojiFor(title || text);

  if (action === 'add') {
    const d = dates[0]?.date || (repeatWd ? weekdayDate(repeatWd, null, today) : null);
    const t = times[0]?.min ?? null;
    return {
      action: 'add', source: 'rules',
      complete: !!title && !!d && (t != null || allDay),
      event: {
        title: cap(title), emoji, memberIds: [...memberIds], date: dayKey(d || today),
        time: t != null ? minutesToTime(t) : '09:00', durationMin: durationMin || 60, allDay, repeat,
      },
    };
  }

  const target = { query: title, memberIds: [...memberIds].filter((id) => id !== JOINT_ID), date: null, time: null };
  if (action === 'delete') {
    target.date = dates[0] ? dayKey(dates[0].date) : null;
    target.time = times[0] ? minutesToTime(times[0].min) : null;
    return { action, source: 'rules', complete: !!(target.query || target.memberIds.length), target };
  }

  // edit: «на X» is the new value, the other one identifies the event
  let from = null; let to = null;
  for (const d of dates) {
    if (d.prep === 'на' && !to) to = d; else if (!from) from = d; else if (!to) to = d;
  }
  const changes = {};
  if (to) changes.date = dayKey(to.date);
  if (times.length >= 2) { target.time = minutesToTime(times[0].min); changes.time = minutesToTime(times[1].min); }
  else if (times.length === 1) changes.time = minutesToTime(times[0].min);
  if (durationMin) changes.durationMin = durationMin;
  if (allDay) changes.allDay = true;
  target.date = from ? dayKey(from.date) : null;
  return {
    action, source: 'rules', target, changes,
    complete: !!(target.query || target.memberIds.length) && Object.keys(changes).length > 0,
  };
}
