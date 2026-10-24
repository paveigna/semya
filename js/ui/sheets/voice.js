// Voice / text commands. Nothing changes until the user confirms the card.
import { h, avatar } from '../dom.js';
import { openSheet, toast } from '../sheet.js';
import { icons } from '../icons.js';
import { store } from '../../core/store.js';
import { colorsOf, deleteEvent, editOccurrence, editSeries, membersOf, isJoint, normalizeEvent, saveEvent, skipOccurrence, whoLabel } from '../../core/actions.js';
import { REPEATS } from '../../config.js';
import { addMinutes, combine, dayKey, fmt, parseDayKey, timeKey } from '../../core/dates.js';
import { listen, speechSupported } from '../../services/speech.js';
import { findTargets, interpret } from '../../services/commands.js';

const repeatLabel = (r) => REPEATS.find(([v]) => v === r)?.[1] || '';

function whenText(date, time, durationMin, allDay) {
  const d = parseDayKey(date);
  if (allDay) return `${fmt.full(d)}, весь день`;
  const end = timeKey(addMinutes(combine(date, time), durationMin));
  return `${fmt.full(d)}, ${time}–${end}`;
}

function card(ev, state, extra) {
  const colors = colorsOf(ev, state);
  const who = isJoint(ev) || !membersOf(ev, state).length
    ? [avatar('🏡', state.settings.jointColor, 's'), 'Вся семья']
    : membersOf(ev, state).map((m) => h('span', { class: 'vc-who' }, avatar(m.emoji, m.color, 's'), m.name));
  return h('div', { class: 'vcard', style: { '--c': colors[0] } },
    h('div', { class: 'vcard-title' }, ev.emoji ? h('span', { class: 'vcard-emoji' }, ev.emoji) : null, ev.title),
    h('div', { class: 'vcard-row' }, who),
    extra);
}

export function openVoiceSheet({ openEditor }) {
  const state0 = store.get();
  const first = state0.members.find((m) => m.kind !== 'helper')?.name || 'Маша';
  const examples = [
    `${first}, танцы в среду в 17 на час`,
    'Каждую субботу в 10 утра бассейн всей семьёй',
    'Перенеси уборку с пятницы на субботу в 11',
    'Удали стоматолога в четверг',
  ];
  const sheet = openSheet({ title: 'Скажите, что сделать', size: 'm', body: h('div'), onClose: () => stop?.() });
  let stop = null;

  function inputView(prefill = '') {
    const area = h('textarea', { class: 'field voice-text', rows: 3, placeholder: 'Например: Маша, танцы в среду в 17 на час' }, prefill);
    const status = h('p', { class: 'voice-status' }, speechSupported() ? 'Нажмите на микрофон и говорите' : 'Нажмите 🎤 на клавиатуре и продиктуйте');
    const mic = h('button', {
      class: 'mic-big', 'aria-label': 'Говорить',
      onClick: () => {
        if (stop) { stop(); return; }
        if (!speechSupported()) { area.focus(); return; }
        mic.classList.add('live');
        status.textContent = 'Слушаю…';
        stop = listen({
          onText: (t) => { area.value = t; },
          onError: (err) => {
            status.textContent = err === 'not-allowed' || err === 'service-not-allowed'
              ? 'Нет доступа к микрофону. Нажмите 🎤 на клавиатуре' : 'Не расслышал. Попробуйте ещё раз';
          },
          onEnd: (final) => {
            stop = null; mic.classList.remove('live');
            if (final) run(final); else if (status.textContent === 'Слушаю…') status.textContent = 'Нажмите на микрофон и говорите';
          },
        });
      },
    }, icons.mic());
    sheet.setBody(h('div', { class: 'voice' },
      mic, status, area,
      h('div', { class: 'examples' }, examples.map((x) => h('button', { class: 'chip', onClick: () => { area.value = x; } }, x)))));
    sheet.setFooter([h('span', { class: 'spacer' }), h('button', { class: 'btn primary big', onClick: () => run(area.value) }, 'Выполнить')]);
  }

  async function run(text) {
    text = (text || '').trim();
    if (!text) { toast('Скажите или напишите команду'); return; }
    sheet.setFooter([]);
    sheet.setBody(h('div', { class: 'voice-loading' }, h('span', { class: 'spinner' }), 'Разбираю команду…'));
    const state = store.get();
    let cmd;
    try { cmd = await interpret(text, state); } catch (e) { cmd = { action: 'unknown', warning: e.message }; }
    result(cmd, text);
  }

  const back = (text) => h('button', { class: 'btn ghost', onClick: () => inputView(text) }, 'Назад');
  const done = (msg) => { sheet.close(); toast(msg, 'ok'); };
  const note = (t) => (t ? h('p', { class: 'vnote' }, t) : null);

  function result(cmd, text) {
    const state = store.get();
    const heard = h('p', { class: 'heard' }, `«${text}»`);

    if (cmd.action === 'add' && cmd.event?.title) {
      const ev = normalizeEvent(cmd.event);
      const warn = cmd.source === 'rules' && !cmd.complete ? 'Не всё расслышал: проверьте день и время.' : cmd.warning ? `Gemini недоступен (${cmd.warning}), понял по-простому.` : '';
      sheet.setTitle('Добавить событие?');
      sheet.setBody(h('div', null, heard, card(ev, state, [
        h('div', { class: 'vcard-row' }, whenText(ev.date, ev.time, ev.durationMin, ev.allDay)),
        ev.repeat !== 'none' ? h('div', { class: 'vcard-row muted' }, repeatLabel(ev.repeat)) : null,
      ]), note(warn)));
      sheet.setFooter([back(text), h('span', { class: 'spacer' }),
        h('button', { class: 'btn', onClick: () => { sheet.close(); openEditor({ prefill: { ...ev, id: undefined } }); } }, 'Исправить'),
        h('button', { class: 'btn primary big', onClick: () => { saveEvent(cmd.event); done('Событие добавлено'); } }, icons.check(), 'Добавить')]);
      return;
    }

    if (cmd.action === 'delete' || cmd.action === 'edit') {
      const targets = findTargets(cmd.target, state);
      if (!targets.length) {
        sheet.setTitle('Не нашёл событие');
        sheet.setBody(h('div', null, heard, note('Скажите название и день, например: «Удали танцы в среду».')));
        sheet.setFooter([back(text)]);
        return;
      }
      const isEdit = cmd.action === 'edit';
      if (isEdit && !Object.keys(cmd.changes || {}).length) {
        sheet.setTitle('Что изменить?');
        sheet.setBody(h('div', null, heard, note('Скажите новый день или время, например: «Перенеси танцы на четверг в 18».')));
        sheet.setFooter([back(text)]);
        return;
      }
      sheet.setTitle(isEdit ? 'Изменить событие?' : 'Удалить событие?');
      sheet.setBody(h('div', null, heard, targets.map((o) => {
        const ev = o.ev;
        const occDk = dayKey(o.start);
        const repeating = ev.repeat !== 'none';
        const nowText = whenText(occDk, timeKey(o.start), ev.durationMin, ev.allDay);
        const c = cmd.changes || {};
        const nextText = isEdit ? whenText(c.date || occDk, c.time || timeKey(o.start), c.durationMin || ev.durationMin, c.allDay ?? ev.allDay) : '';
        const actions = isEdit
          ? (repeating
            ? [h('button', { class: 'btn', onClick: () => { editOccurrence(ev.id, occDk, c); done('Изменено'); } }, 'Только этот раз'),
              h('button', { class: 'btn primary', onClick: () => { editSeries(ev.id, occDk, c); done('Изменено'); } }, 'Все повторы')]
            : [h('button', { class: 'btn primary', onClick: () => { saveEvent({ ...ev, ...c }); done('Изменено'); } }, 'Применить')])
          : (repeating
            ? [h('button', { class: 'btn', onClick: () => { skipOccurrence(ev.id, occDk); done('Удалено'); } }, 'Только этот раз'),
              h('button', { class: 'btn danger', onClick: () => { deleteEvent(ev.id); done('Удалено'); } }, 'Все повторы')]
            : [h('button', { class: 'btn danger', onClick: () => { deleteEvent(ev.id); done('Удалено'); } }, 'Удалить')]);
        return card(ev, state, [
          h('div', { class: 'vcard-row muted' }, whoLabel(ev, state)),
          h('div', { class: `vcard-row${isEdit ? ' strike' : ''}` }, nowText),
          isEdit ? h('div', { class: 'vcard-row vcard-new' }, '→ ', nextText) : null,
          h('div', { class: 'vcard-actions' }, actions),
        ]);
      }), note(cmd.warning ? `Gemini недоступен (${cmd.warning}), понял по-простому.` : '')));
      sheet.setFooter([back(text)]);
      return;
    }

    sheet.setTitle('Не понял команду');
    const hasKey = !!state.settings.geminiKey;
    sheet.setBody(h('div', null, heard,
      note('Попробуйте сказать: кто, что, когда. Например: «Маша, танцы в среду в 17».'),
      hasKey ? null : note('Для свободных фраз включите Gemini в настройках.')));
    sheet.setFooter([back(text), h('span', { class: 'spacer' }),
      h('button', { class: 'btn', onClick: () => { sheet.close(); openEditor({}); } }, 'Добавить вручную')]);
  }

  inputView();
}
