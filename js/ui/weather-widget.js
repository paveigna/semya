// Compact weather card for the header + detail sheet with clothing advice for the kids.
import { h } from './dom.js';
import { openSheet } from './sheet.js';
import { addDays, fmt, parseDayKey, sameDay, startOfDay } from '../core/dates.js';
import { dayForecast, weather } from '../services/weather.js';
import { describe } from '../services/wmo.js';
import { clothingAdvice, fmtT } from '../services/clothing.js';

/** After 17:00 the family is preparing for tomorrow. */
export const prepDay = (now) => (now.getHours() >= 17 ? addDays(startOfDay(now), 1) : startOfDay(now));

export function renderWeatherWidget(state, now) {
  const w = weather.get();
  const city = state.settings.city.name;
  if (!w || w.error || !w.current) {
    return h('button', { class: 'wx wx-empty', onClick: () => openWeatherSheet(state, now) },
      h('span', { class: 'wx-icon' }, '🌤️'),
      h('span', { class: 'wx-text' }, h('span', { class: 'wx-line' }, city), h('span', { class: 'wx-sub' }, w?.error ? 'Нет связи с погодой' : 'Загрузка…')));
  }
  const [icon] = describe(w.current.code, w.current.isDay);
  const day = prepDay(now);
  const f = dayForecast(day);
  const advice = f ? clothingAdvice(f) : null;
  return h('button', { class: 'wx', onClick: () => openWeatherSheet(state, now), 'aria-label': 'Погода и одежда' },
    h('span', { class: 'wx-icon' }, icon),
    h('span', { class: 'wx-temp' }, fmtT(w.current.t)),
    h('span', { class: 'wx-text' },
      h('span', { class: 'wx-line' }, sameDay(day, now) ? 'Сегодня детям' : 'Завтра детям'),
      h('span', { class: 'wx-sub' }, advice ? advice.label : city)));
}

function dayPanel(date) {
  const f = dayForecast(date);
  if (!f) return h('p', { class: 'muted' }, 'Прогноз на этот день пока недоступен.');
  const [icon, label] = describe(f.code);
  const advice = clothingAdvice(f);
  return h('div', { class: 'wx-day' },
    h('div', { class: 'wx-hero' },
      h('span', { class: 'wx-hero-icon' }, icon),
      h('div', null,
        h('div', { class: 'wx-hero-t' }, `${fmtT(f.tMax)} / ${fmtT(f.tMin)}`),
        h('div', { class: 'wx-hero-l' }, `${label}. ${advice.summary}.`))),
    h('h3', { class: 'section-title' }, 'Что надеть в сад и школу'),
    h('ul', { class: 'wear' }, advice.items.map((i) => h('li', null, h('span', { class: 'wear-icon' }, i.icon), i.text))));
}

export function openWeatherSheet(state, now) {
  const w = weather.get();
  const today = startOfDay(now);
  let selected = prepDay(now);
  const sheet = openSheet({ title: `Погода, ${state.settings.city.name}`, size: 'm', body: h('div') });

  const draw = () => {
    if (!w?.days) { sheet.setBody(h('p', { class: 'muted' }, 'Нет данных о погоде. Проверьте интернет и город в настройках.')); return; }
    const strip = h('div', { class: 'wx-strip' }, w.days.map((d) => {
      const date = parseDayKey(d.date);
      return h('button', { class: `wx-strip-day${sameDay(date, selected) ? ' on' : ''}`, onClick: () => { selected = date; draw(); } },
        h('span', { class: 'wx-strip-wd' }, sameDay(date, today) ? 'Сегодня' : fmt.wdShort(date)),
        h('span', { class: 'wx-strip-icon' }, describe(d.code)[0]),
        h('span', { class: 'wx-strip-t' }, fmtT(d.tMax)),
        h('span', { class: 'wx-strip-t2' }, fmtT(d.tMin)));
    }));
    sheet.setBody(h('div', null, strip, dayPanel(selected)));
  };
  draw();
}
