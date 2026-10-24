// App chrome: title bar, member filter chips, floating action buttons.
import { h, avatar } from './dom.js';
import { icons } from './icons.js';
import { renderWeatherWidget } from './weather-widget.js';
import { addDays, fmt, isoWeek, startOfWeek } from '../core/dates.js';
import { JOINT_ID } from '../config.js';

const VIEWS = [['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']];

function titleFor(ui) {
  const c = ui.cursor;
  if (ui.view === 'day') return { main: fmt.full(c), sub: String(c.getFullYear()) };
  if (ui.view === 'month') return { main: fmt.month(c), sub: String(c.getFullYear()) };
  const s = startOfWeek(c); const e = addDays(s, 6);
  const main = s.getMonth() === e.getMonth() ? fmt.month(s) : `${fmt.month(s)} – ${fmt.month(e)}`;
  return { main, sub: `${fmt.dayMonth(s)} – ${fmt.dayMonth(e)}, неделя ${isoWeek(s)}` };
}

export function renderHeader({ ui, state, now, act }) {
  const t = titleFor(ui);
  return h('header', { class: 'topbar' },
    h('div', { class: 'title-block' },
      h('h1', { class: 'title' }, t.main),
      h('div', { class: 'subtitle' }, t.sub)),
    h('div', { class: 'controls' },
      h('div', { class: 'segmented', role: 'tablist' }, VIEWS.map(([v, l]) => h('button', {
        class: ui.view === v ? 'on' : '', role: 'tab', 'aria-selected': String(ui.view === v), onClick: () => act.setView(v),
      }, l))),
      h('div', { class: 'nav' },
        h('button', { class: 'icon-btn', 'aria-label': 'Назад', onClick: () => act.shift(-1) }, icons.left()),
        h('button', { class: 'btn today-btn', onClick: act.today }, 'Сегодня'),
        h('button', { class: 'icon-btn', 'aria-label': 'Вперёд', onClick: () => act.shift(1) }, icons.right()))),
    h('div', { class: 'top-right' },
      renderWeatherWidget(state, now),
      h('button', { class: 'icon-btn glass', 'aria-label': 'Настройки', onClick: act.openSettings }, icons.settings())));
}

export function renderChips({ ui, state, act }) {
  const chip = (id, emoji, name, color) => h('button', {
    class: `mchip${ui.filter.has(id) ? ' on' : ''}${ui.filter.size && !ui.filter.has(id) ? ' dim' : ''}`,
    style: { '--c': color }, 'aria-pressed': String(ui.filter.has(id)), onClick: () => act.toggleFilter(id),
  }, avatar(emoji, color, 's'), name);

  if (!state.members.length) {
    return h('div', { class: 'chips-row' },
      h('button', { class: 'mchip add strong', onClick: act.addMember }, icons.plus(), 'Добавить членов семьи'),
      h('span', { class: 'chips-hint' }, 'У каждого будет свой цвет'));
  }
  return h('div', { class: 'chips-row' },
    h('button', { class: `mchip all${ui.filter.size ? '' : ' on'}`, onClick: act.clearFilter }, 'Все'),
    chip(JOINT_ID, '🏡', 'Вся семья', state.settings.jointColor),
    state.members.map((m) => chip(m.id, m.emoji, m.name, m.color)),
    h('button', { class: 'mchip add', 'aria-label': 'Участники', onClick: act.openMembers }, icons.people()));
}

export function renderFab({ act }) {
  return h('div', { class: 'fab' },
    h('button', { class: 'fab-btn fab-mic', 'aria-label': 'Голосовая команда', onClick: act.openVoice }, icons.mic()),
    h('button', { class: 'fab-btn fab-add', 'aria-label': 'Новое событие', onClick: () => act.newEvent() }, icons.plus(), h('span', null, 'Событие')));
}
