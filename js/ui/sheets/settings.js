// Settings: weather city, joint colour, visible hours, voice, backup.
import { h } from '../dom.js';
import { confirmDialog, openSheet, toast } from '../sheet.js';
import { store } from '../../core/store.js';
import { updateSettings } from '../../core/actions.js';
import {
  exportFile, fetchFromGithub, githubConfigured, meta, onBackupChange, pushNow, restoreFrom, restoreSnapshot, setGithub, snapshots,
} from '../../services/backup.js';
import { APP_VERSION, GEMINI_MODELS, JOINT_PALETTE } from '../../config.js';
import { refreshWeather, searchCity } from '../../services/weather.js';
import { parseGemini } from '../../services/parser-gemini.js';

const group = (title, ...rows) => h('section', { class: 'ed-section' }, h('h3', { class: 'section-title' }, title), h('div', { class: 'group' }, ...rows));
const row = (label, control, note) => h('div', { class: 'group-row' },
  h('div', { class: 'group-label' }, label, note ? h('span', { class: 'group-note' }, note) : null), control);

export function openSettingsSheet() {
  let off = null;
  const sheet = openSheet({ title: 'Настройки', size: 'm', body: h('div'), onClose: () => off?.() });
  let cityResults = [];

  const draw = () => {
    const s = store.get().settings;

    const cityInput = h('input', { class: 'field', type: 'search', placeholder: 'Найти город', enterkeyhint: 'search' });
    const findCity = async () => {
      const q = cityInput.value.trim();
      if (!q) return;
      try { cityResults = await searchCity(q); if (!cityResults.length) toast('Город не найден'); draw(); }
      catch { toast('Нет связи. Попробуйте позже'); }
    };
    cityInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') findCity(); });

    const hours = (value, onPick, min, max) => h('select', { class: 'field field-select', onChange: (e) => onPick(Number(e.target.value)) },
      Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => {
        const o = h('option', { value: n }, `${String(n).padStart(2, '0')}:00`);
        if (n === value) o.selected = true;
        return o;
      }));

    const keyInput = h('input', { class: 'field', type: 'password', value: s.geminiKey, placeholder: 'Ключ из Google AI Studio', autocomplete: 'off',
      onChange: (e) => updateSettings({ geminiKey: e.target.value.trim() }) });

    sheet.setBody(h('div', { class: 'settings' },
      group('Погода',
        row('Город', h('span', { class: 'group-value' }, s.city.name)),
        h('div', { class: 'group-row' }, cityInput, h('button', { class: 'btn', onClick: findCity }, 'Найти')),
        cityResults.map((c) => h('button', {
          class: 'group-row group-pick',
          onClick: () => { updateSettings({ city: { name: c.name, lat: c.lat, lon: c.lon } }); cityResults = []; refreshWeather(store.get().settings.city, true); toast(`Город: ${c.name}`, 'ok'); draw(); },
        }, h('span', null, c.name), h('span', { class: 'group-note' }, c.region)))),

      group('Календарь',
        row('Цвет общих событий', h('div', { class: 'swatches swatches-s' }, JOINT_PALETTE.map((c) => h('button', {
          class: `swatch${s.jointColor === c ? ' on' : ''}`, style: { '--c': c }, 'aria-label': c,
          onClick: () => { updateSettings({ jointColor: c }); draw(); },
        })))),
        row('День начинается', hours(s.dayStart, (v) => { if (v < s.dayEnd) updateSettings({ dayStart: v }); draw(); }, 0, 12)),
        row('День заканчивается', hours(s.dayEnd, (v) => { if (v > s.dayStart) updateSettings({ dayEnd: v }); draw(); }, 14, 24))),

      group('Голосовые команды',
        row('Как понимать команды', h('div', { class: 'segmented' },
          [['rules', 'Просто'], ['auto', 'Авто'], ['gemini', 'Gemini']].map(([v, l]) => h('button', {
            class: s.voiceMode === v ? 'on' : '', onClick: () => { updateSettings({ voiceMode: v }); draw(); },
          }, l))),
        'Просто: без интернета. Авто: Gemini только для сложных фраз.'),
        h('div', { class: 'group-row' }, keyInput, h('button', {
          class: 'btn',
          onClick: async () => {
            const st = store.get();
            if (!st.settings.geminiKey) { toast('Сначала вставьте ключ'); return; }
            try {
              const r = await parseGemini('Добавь проверку завтра в 10', st, { key: st.settings.geminiKey, model: st.settings.geminiModel });
              toast(r.action === 'add' ? 'Gemini работает' : 'Gemini ответил, но не понял фразу', r.action === 'add' ? 'ok' : '');
            } catch (e) { toast(e.message || 'Ошибка Gemini'); }
          },
        }, 'Проверить')),
        row('Модель', h('select', { class: 'field field-select', onChange: (e) => updateSettings({ geminiModel: e.target.value }) },
          GEMINI_MODELS.map((m) => { const o = h('option', { value: m }, m); if (m === s.geminiModel) o.selected = true; return o; })),
        'Бесплатный ключ: Google может использовать текст команд для обучения.')),

      ...backupGroups(),

      h('p', { class: 'muted center' }, `Семейный календарь ${APP_VERSION}`)));
  };
  draw();
  off = onBackupChange(() => {
    const a = document.activeElement;
    if (!(a?.tagName === 'INPUT' && sheet.panel.contains(a))) draw();
  });
}

export function fmtWhen(ts) {
  if (!ts) return 'никогда';
  const d = new Date(ts);
  const t = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  if (diff === 0) return `сегодня в ${t}`;
  if (diff === 1) return `вчера в ${t}`;
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} в ${t}`;
}

const events = (n) => {
  const m10 = n % 10; const m100 = n % 100;
  const w = m10 === 1 && m100 !== 11 ? 'событие' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'события' : 'событий';
  return `${n} ${w}`;
};

async function confirmRestore(what) {
  return confirmDialog({
    title: 'Восстановить?',
    message: `Всё, что сейчас в календаре, будет заменено данными ${what}. Текущее состояние сохранится в снимках на этом iPad.`,
    actions: [{ label: 'Отмена', value: false }, { label: 'Восстановить', value: true, style: 'danger' }],
  });
}

function backupGroups() {
  const m = meta();
  const status = !githubConfigured(m) ? 'Не настроено'
    : m.lastError ? `Ошибка: ${m.lastError}`
    : m.lastPushAt ? `Сохранено ${fmtWhen(m.lastPushAt)}` : 'Ещё не сохранялось';

  const repoInput = h('input', { class: 'field', value: m.repo || '', placeholder: 'имя/semya-backup', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    onChange: (e) => setGithub({ repo: e.target.value }) });
  const tokenInput = h('input', { class: 'field', type: 'password', value: m.token || '', placeholder: 'Ключ GitHub (github_pat_…)', autocomplete: 'off',
    onChange: (e) => setGithub({ token: e.target.value }) });

  const saveNow = async () => {
    setGithub({ repo: repoInput.value, token: tokenInput.value });
    try { await pushNow(); toast('Копия сохранена в GitHub', 'ok'); } catch (e) { toast(e.message); }
  };
  const fromGithub = async () => {
    setGithub({ repo: repoInput.value, token: tokenInput.value });
    let text;
    try { text = await fetchFromGithub(); } catch (e) { toast(e.message); return; }
    if (!(await confirmRestore('из GitHub'))) return;
    try { restoreFrom(text); toast('Данные восстановлены', 'ok'); } catch (e) { toast(e.message); }
  };
  const fromFile = () => {
    const input = h('input', { type: 'file', accept: 'application/json,.json' });
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f || !(await confirmRestore('из файла'))) return;
      try { restoreFrom(await f.text()); toast('Данные восстановлены', 'ok'); } catch (e) { toast(e.message); }
    });
    input.click();
  };

  const snaps = snapshots();
  return [
    group('Автокопия в GitHub',
      row('Состояние', h('span', { class: `group-value${m.lastError ? ' danger-text' : ''}` }, status),
        'Каждое изменение через пару минут копируется в ваш закрытый репозиторий. Пустой календарь никогда не перезаписывает копию.'),
      h('div', { class: 'group-row' }, repoInput),
      h('div', { class: 'group-row' }, tokenInput),
      h('div', { class: 'group-row' }, h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onClick: saveNow }, 'Сохранить сейчас'),
        h('button', { class: 'btn', onClick: fromGithub }, 'Восстановить из GitHub')))),

    group('Файл копии',
      row('Последний файл', h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onClick: exportFile }, 'Сохранить копию'),
        h('button', { class: 'btn', onClick: fromFile }, 'Восстановить из файла')),
      fmtWhen(m.lastFileAt))),

    group('Снимки на этом iPad',
      snaps.length ? snaps.map((sn) => row(fmtWhen(sn.at),
        h('button', { class: 'btn', onClick: async () => {
          if (!(await confirmRestore(`снимка (${fmtWhen(sn.at)})`))) return;
          try { restoreSnapshot(sn.at); toast('Данные восстановлены', 'ok'); } catch (e) { toast(e.message); }
        } }, 'Вернуть'),
        `${sn.reason} · ${events(sn.events)}`))
        : row('Снимков пока нет', null, 'Снимок делается раз в день и перед каждым восстановлением.'),
      h('p', { class: 'group-row group-note' }, 'Хранятся последние 14. Защищают от ошибок, но удаляются вместе с приложением.')),
  ];
}
