// Entry point: owns view state, wires modules together, renders the screen.
import { store } from './core/store.js';
import { occurrences } from './core/actions.js';
import { addDays, addMonths, dayKey, minutesToTime, sameDay, startOfDay, startOfMonth, startOfWeek } from './core/dates.js';
import { h } from './ui/dom.js';
import { toast } from './ui/sheet.js';
import { renderChips, renderFab, renderHeader } from './ui/chrome.js';
import { renderTimeGrid } from './ui/views/time-grid.js';
import { renderMonth } from './ui/views/month.js';
import { openEventEditor } from './ui/sheets/event-editor.js';
import { openMemberEditor, openMembersSheet } from './ui/sheets/members.js';
import { openSettingsSheet } from './ui/sheets/settings.js';
import { openVoiceSheet } from './ui/sheets/voice.js';
import { refreshWeather, weather } from './services/weather.js';
import { backupWarning, exportFile, onBackupChange, snoozeReminder, startBackups } from './services/backup.js';

const VIEW_KEY = 'family-calendar:view';
const ui = {
  view: localStorage.getItem(VIEW_KEY) || 'week',
  cursor: startOfDay(new Date()),
  filter: new Set(),
  scroll: null,
};
const app = document.getElementById('app');

function range() {
  if (ui.view === 'day') return [ui.cursor, addDays(ui.cursor, 1)];
  if (ui.view === 'week') { const s = startOfWeek(ui.cursor); return [s, addDays(s, 7)]; }
  const s = startOfWeek(startOfMonth(ui.cursor));
  return [s, addDays(s, 42)];
}

/** Default date for a new event: today if visible, otherwise the first visible day. */
function defaultDate(now) {
  const [from, to] = range();
  return now >= from && now < to ? startOfDay(now) : (ui.view === 'month' ? startOfMonth(ui.cursor) : from);
}

const act = {
  setView(v) { ui.view = v; localStorage.setItem(VIEW_KEY, v); ui.scroll = null; render(); },
  shift(dir) {
    if (ui.view === 'day') ui.cursor = addDays(ui.cursor, dir);
    else if (ui.view === 'week') ui.cursor = addDays(ui.cursor, 7 * dir);
    else ui.cursor = addMonths(ui.cursor, dir);
    render();
  },
  today() { ui.cursor = startOfDay(new Date()); ui.scroll = null; render(); },
  toggleFilter(id) { if (ui.filter.has(id)) ui.filter.delete(id); else ui.filter.add(id); render(); },
  clearFilter() { ui.filter.clear(); render(); },
  openMembers: () => openMembersSheet(),
  addMember: () => openMemberEditor({ kind: 'family' }),
  openSettings: () => openSettingsSheet(),
  openVoice: () => openVoiceSheet({ openEditor: openEventEditor }),
  newEvent(date, minutes) {
    const now = new Date();
    const d = date || defaultDate(now);
    const start = minutes ?? Math.min((now.getHours() + 1) * 60, 21 * 60);
    const solo = ui.filter.size === 1 ? [...ui.filter] : [];
    openEventEditor({ prefill: { date: dayKey(d), time: minutesToTime(start), memberIds: solo } });
  },
  openOccurrence: (o) => openEventEditor({ event: o.ev, occurrence: o }),
  openDay(d) { ui.cursor = startOfDay(d); act.setView('day'); },
};

function render() {
  const state = store.get();
  const now = new Date();
  const prevScroll = app.querySelector('.tg-scroll');
  if (prevScroll) ui.scroll = prevScroll.scrollTop;

  const [from, to] = range();
  const occs = occurrences(state, from, to, ui.filter);
  let view;
  if (ui.view === 'month') {
    view = renderMonth({ cursor: ui.cursor, occs, state, now, onDay: act.openDay, onOpen: act.openOccurrence });
  } else {
    const days = ui.view === 'day' ? [ui.cursor] : Array.from({ length: 7 }, (_, i) => addDays(from, i));
    view = renderTimeGrid({ days, occs, state, now, onSlot: (d, m) => act.newEvent(d, m), onOpen: act.openOccurrence });
  }
  const main = h('main', { class: 'stage' }, view);
  addSwipe(main);

  app.replaceChildren(...[renderHeader({ ui, state, now, act }), renderChips({ ui, state, act }), main, renderFab({ act }), renderBackupBanner()].filter(Boolean));

  const sc = app.querySelector('.tg-scroll');
  if (sc) {
    if (ui.scroll != null) sc.scrollTop = ui.scroll;
    else {
      const hourPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour')) || 58;
      sc.scrollTop = Math.max(0, (now.getHours() - 1 - state.settings.dayStart) * hourPx);
    }
  }
}

/** Floating reminder when there is no recent off-device backup. */
function renderBackupBanner() {
  const w = backupWarning();
  if (!w) return null;
  return h('div', { class: `backup-banner ${w.kind}`, role: 'status' },
    h('span', { class: 'backup-banner-text' }, w.kind === 'error' ? '⚠️ ' : '💾 ', w.text),
    w.kind === 'error'
      ? h('button', { class: 'btn', onClick: act.openSettings }, 'Открыть')
      : [h('button', { class: 'btn primary', onClick: () => exportFile() }, 'Сохранить'),
        h('button', { class: 'btn ghost', onClick: () => snoozeReminder() }, 'Позже')]);
}

/** Horizontal swipe on the calendar = previous / next period. */
function addSwipe(el) {
  let x0 = null; let y0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 80 && Math.abs(dy) < 50) act.shift(dx < 0 ? 1 : -1);
  }, { passive: true });
}

/* ---------- boot ---------- */

store.subscribe(() => {
  const { city } = store.get().settings;
  if (render.city !== `${city.lat},${city.lon}`) { render.city = `${city.lat},${city.lon}`; refreshWeather(city); }
  render();
});
weather.subscribe(() => render());
onBackupChange(() => render());
window.addEventListener('app:error', (e) => toast(e.detail));
window.addEventListener('pagehide', () => store.flush());

let lastDay = new Date();
setInterval(() => {
  const now = new Date();
  if (!sameDay(now, lastDay)) { lastDay = now; ui.cursor = startOfDay(now); }
  render();
}, 60 * 1000);
setInterval(() => refreshWeather(store.get().settings.city), 30 * 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { refreshWeather(store.get().settings.city); render(); }
});

render.city = '';
render();
const { city } = store.get().settings;
render.city = `${city.lat},${city.lon}`;
refreshWeather(city);

navigator.storage?.persist?.();
startBackups();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW', e));
