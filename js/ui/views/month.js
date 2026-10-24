// Month overview. Tap a day to open it in day view.
import { h } from '../dom.js';
import { addDays, fmt, sameDay, startOfMonth, startOfWeek, timeKey, weekdayIndex } from '../../core/dates.js';
import { colorsOf } from '../../core/actions.js';

const MAX_PILLS = 3;

export function renderMonth({ cursor, occs, state, now, onDay, onOpen }) {
  const first = startOfMonth(cursor);
  const start = startOfWeek(first);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const rows = Math.ceil((weekdayIndex(first) + daysInMonth) / 7);

  const head = h('div', { class: 'mv-head' },
    Array.from({ length: 7 }, (_, i) => h('div', { class: 'mv-wd' }, fmt.wdShort(addDays(start, i)))));

  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const d = addDays(start, i);
    const next = addDays(d, 1);
    const list = occs.filter((o) => o.start < next && o.end > d);
    const out = d.getMonth() !== first.getMonth();
    return h('button', {
      class: `mv-cell${out ? ' out' : ''}${sameDay(d, now) ? ' today' : ''}`,
      'aria-label': fmt.full(d),
      onClick: () => onDay(d),
    },
    h('span', { class: 'mv-num' }, d.getDate()),
    h('span', { class: 'mv-list' },
      list.slice(0, MAX_PILLS).map((o) => h('span', {
        class: 'mv-item', style: { '--c': colorsOf(o.ev, state)[0] },
        onClick: (e) => { e.stopPropagation(); onOpen(o); },
      },
      h('span', { class: 'mv-dot' }),
      h('span', { class: 'mv-text' }, o.ev.allDay ? '' : `${timeKey(o.start)} `, o.ev.emoji ? `${o.ev.emoji} ` : '', o.ev.title))),
      list.length > MAX_PILLS ? h('span', { class: 'mv-more' }, `ещё ${list.length - MAX_PILLS}`) : null));
  });

  return h('div', { class: 'mv', style: { '--rows': rows } }, head, h('div', { class: 'mv-grid' }, cells));
}
