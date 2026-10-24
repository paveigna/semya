// Day and week views share this hour grid. Tap an empty slot to add an event there.
import { h } from '../dom.js';
import { addDays, fmt, minutesOfDay, sameDay, timeKey } from '../../core/dates.js';
import { colorsOf, isJoint, membersOf } from '../../core/actions.js';

const barOf = (colors) => (colors.length < 2 ? colors[0]
  : `linear-gradient(180deg, ${colors.map((c, i) => `${c} ${(i / colors.length) * 100}% ${((i + 1) / colors.length) * 100}%`).join(', ')})`);

/** Assigns side-by-side columns to overlapping items. */
function layout(items) {
  items.sort((a, b) => a.s - b.s || b.e - a.e);
  const clusters = [];
  let cur = []; let end = -1;
  for (const it of items) {
    if (cur.length && it.s >= end) { clusters.push(cur); cur = []; }
    cur.push(it); end = Math.max(end, it.e);
  }
  if (cur.length) clusters.push(cur);
  for (const c of clusters) {
    const colEnds = [];
    for (const it of c) {
      let i = colEnds.findIndex((e) => e <= it.s);
      if (i < 0) { i = colEnds.length; colEnds.push(it.e); } else colEnds[i] = it.e;
      it.col = i;
    }
    c.forEach((it) => { it.ncol = colEnds.length; });
  }
}

export function pill(o, state, onOpen) {
  const colors = colorsOf(o.ev, state);
  return h('button', {
    class: 'pill', style: { '--c': colors[0], '--bar': barOf(colors) },
    onClick: (e) => { e.stopPropagation(); onOpen(o); },
  }, o.ev.emoji ? `${o.ev.emoji} ` : '', o.ev.title);
}

function block(it, state, onOpen, wide) {
  const { o } = it;
  const colors = colorsOf(o.ev, state);
  const mins = it.e - it.s;
  const who = isJoint(o.ev) ? (wide ? 'Вся семья' : '')
    : membersOf(o.ev, state).map((m) => (wide ? `${m.emoji} ${m.name}` : m.emoji)).join('  ');
  return h('button', {
    class: `ev${mins < 45 ? ' ev-short' : ''}`,
    style: {
      top: `${it.top}%`, height: `${it.height}%`,
      left: `calc(${(it.col / it.ncol) * 100}% + 2px)`, width: `calc(${100 / it.ncol}% - 4px)`,
      '--c': colors[0], '--bar': barOf(colors),
    },
    'aria-label': `${o.ev.title}, ${timeKey(o.start)}`,
    onClick: (e) => { e.stopPropagation(); onOpen(o); },
  },
  h('span', { class: 'ev-title' }, o.ev.emoji ? h('span', { class: 'ev-emoji' }, o.ev.emoji) : null, o.ev.title),
  mins >= 45 ? h('span', { class: 'ev-time' }, `${timeKey(o.start)}–${timeKey(o.end)}`) : null,
  mins >= 60 && who ? h('span', { class: 'ev-who' }, who) : null);
}

export function renderTimeGrid({ days, occs, state, now, onSlot, onOpen }) {
  const { dayStart, dayEnd } = state.settings;
  const hours = dayEnd - dayStart;
  const ds = dayStart * 60; const de = dayEnd * 60; const span = de - ds;
  const wide = days.length === 1;

  const head = h('div', { class: 'tg-head' }, h('div', { class: 'tg-corner' }),
    days.map((d) => h('div', { class: `tg-dayhead${sameDay(d, now) ? ' today' : ''}` },
      h('span', { class: 'tg-wd' }, wide ? fmt.wdLong(d) : fmt.wdShort(d)),
      h('span', { class: 'tg-num' }, d.getDate()))));

  const allDay = days.map((d) => occs.filter((o) => o.ev.allDay && o.start < addDays(d, 1) && o.end > d));
  const allDayRow = allDay.some((l) => l.length)
    ? h('div', { class: 'tg-allday' }, h('div', { class: 'tg-corner tg-allday-label' }, h('span', null, 'весь день')),
      allDay.map((list) => h('div', { class: 'tg-allday-cell' }, list.map((o) => pill(o, state, onOpen)))))
    : null;

  const gutter = h('div', { class: 'tg-gutter' },
    Array.from({ length: hours }, (_, i) => h('div', { class: 'tg-hour' },
      i === 0 ? null : h('span', null, `${String(dayStart + i).padStart(2, '0')}:00`))));

  const cols = days.map((d) => {
    const col = h('div', { class: `tg-col${sameDay(d, now) ? ' today' : ''}` });
    col.addEventListener('click', (e) => {
      if (e.target !== col) return;
      const r = col.getBoundingClientRect();
      const slot = Math.floor(((e.clientY - r.top) / r.height) * hours * 2);
      onSlot(d, ds + Math.max(0, slot) * 30);
    });
    const next = addDays(d, 1);
    const items = occs.filter((o) => !o.ev.allDay && o.start < next && o.end > d).map((o) => {
      // wall-clock minutes, so DST-change days still line up with the hour labels
      const s = o.start <= d ? 0 : minutesOfDay(o.start);
      const e = o.end >= next ? 1440 : minutesOfDay(o.end);
      const top = Math.min(Math.max(s, ds), de - 15);
      const bottom = Math.max(Math.min(e, de), top + 15);
      return { o, s, e, top: ((top - ds) / span) * 100, height: ((bottom - top) / span) * 100 };
    });
    layout(items);
    items.forEach((it) => col.append(block(it, state, onOpen, wide)));
    if (sameDay(d, now)) {
      const m = minutesOfDay(now);
      if (m >= ds && m <= de) col.append(h('div', { class: 'now-line', style: { top: `${((m - ds) / span) * 100}%` } }));
    }
    return col;
  });

  const body = h('div', { class: 'tg-body', style: { '--hours': hours } }, gutter, h('div', { class: 'tg-cols' }, cols));
  return h('div', { class: `tg${wide ? ' tg-wide' : ''}`, style: { '--cols': days.length } },
    head, allDayRow, h('div', { class: 'tg-scroll' }, body));
}
