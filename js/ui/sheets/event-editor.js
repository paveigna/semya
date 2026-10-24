// Add / edit an event. Big targets so a child can use it: who → what → when → how long.
import { h, avatar } from '../dom.js';
import { confirmDialog, openSheet, toast } from '../sheet.js';
import { icons } from '../icons.js';
import { store } from '../../core/store.js';
import { deleteEvent, editOccurrence, editSeries, saveEvent, skipOccurrence } from '../../core/actions.js';
import { DURATIONS, JOINT_ID, PRESETS, REPEATS } from '../../config.js';
import { addMinutes, combine, dayKey, durationLabel, timeKey } from '../../core/dates.js';
import { emojiFor } from '../../services/parser-rules.js';

const FIELDS = ['title', 'emoji', 'memberIds', 'date', 'time', 'durationMin', 'allDay', 'repeat', 'until', 'notes'];
const pick = (o) => Object.fromEntries(FIELDS.map((k) => [k, o[k]]));

function section(label, ...content) {
  return h('section', { class: 'ed-section' }, h('h3', { class: 'section-title' }, label), ...content);
}

/**
 * event: existing event to edit; occurrence: the tapped occurrence (for repeating events);
 * prefill: values for a new event (date, time, memberIds, title…).
 */
export function openEventEditor({ event, occurrence, prefill } = {}) {
  const state = store.get();
  const editing = !!event;
  const occDk = occurrence ? dayKey(occurrence.start) : null;
  const repeating = editing && event.repeat !== 'none';
  const draft = editing
    ? { ...structuredClone(event), date: occDk || event.date }
    : { title: '', emoji: '', memberIds: [], date: dayKey(new Date()), time: '09:00', durationMin: 60, allDay: false, repeat: 'none', until: null, notes: '', ...prefill };
  let emojiTouched = !!draft.emoji;

  const body = h('div', { class: 'editor' });
  const emojiBadge = h('span', { class: 'ed-emoji' });
  const setEmoji = () => { emojiBadge.textContent = draft.emoji || '✨'; };

  const who = () => {
    const btn = (id, emoji, name, color, sub) => h('button', {
      class: `who${draft.memberIds.includes(id) ? ' on' : ''}`, style: { '--c': color },
      onClick: () => {
        if (id === JOINT_ID) draft.memberIds = draft.memberIds.includes(JOINT_ID) ? [] : [JOINT_ID];
        else {
          const set = new Set(draft.memberIds.filter((x) => x !== JOINT_ID));
          if (set.has(id)) set.delete(id); else set.add(id);
          draft.memberIds = [...set];
        }
        render();
      },
    }, avatar(emoji, color, 'l'), h('span', { class: 'who-name' }, name), sub ? h('span', { class: 'who-sub' }, sub) : null);
    const family = state.members.filter((m) => m.kind !== 'helper');
    const helpers = state.members.filter((m) => m.kind === 'helper');
    return h('div', { class: 'who-row' },
      btn(JOINT_ID, '🏡', 'Вся семья', state.settings.jointColor),
      family.map((m) => btn(m.id, m.emoji, m.name, m.color)),
      helpers.map((m) => btn(m.id, m.emoji, m.name, m.color, m.role)));
  };

  const what = () => {
    const input = h('input', {
      class: 'field field-title', type: 'text', placeholder: 'Что будет? Например, Танцы', value: draft.title, enterkeyhint: 'done',
      onInput: (e) => {
        draft.title = e.target.value;
        if (!emojiTouched) { draft.emoji = emojiFor(draft.title); setEmoji(); }
      },
    });
    setEmoji();
    return [
      h('div', { class: 'ed-title-row' }, emojiBadge, input),
      h('div', { class: 'presets' }, PRESETS.map((p) => h('button', {
        class: `preset${draft.title === p.title ? ' on' : ''}`,
        onClick: () => { draft.title = p.title; draft.emoji = p.emoji; emojiTouched = true; render(); },
      }, h('span', { class: 'preset-emoji' }, p.emoji), p.title))),
    ];
  };

  const when = () => h('div', { class: 'ed-when' },
    h('label', { class: 'field-wrap' }, h('span', null, 'Дата'),
      h('input', { class: 'field', type: 'date', value: draft.date, onChange: (e) => { if (e.target.value) draft.date = e.target.value; } })),
    draft.allDay ? null : h('label', { class: 'field-wrap' }, h('span', null, 'Начало'),
      h('input', { class: 'field', type: 'time', step: 300, value: draft.time, onChange: (e) => { if (e.target.value) { draft.time = e.target.value; render(); } } })),
    h('button', { class: `toggle${draft.allDay ? ' on' : ''}`, role: 'switch', 'aria-checked': String(draft.allDay),
      onClick: () => { draft.allDay = !draft.allDay; if (!draft.allDay && draft.durationMin >= 1440) draft.durationMin = 60; render(); } },
    h('span', { class: 'toggle-knob' }), 'Весь день'));

  const howLong = () => {
    const end = timeKey(addMinutes(combine(draft.date, draft.time), draft.durationMin));
    return h('div', { class: 'chips' },
      DURATIONS.map((m) => h('button', { class: `chip${draft.durationMin === m ? ' on' : ''}`, onClick: () => { draft.durationMin = m; render(); } }, durationLabel(m))),
      h('span', { class: 'chip-note' }, `до ${end}`));
  };

  const repeat = () => h('div', null,
    h('div', { class: 'chips' }, REPEATS.map(([v, label]) => h('button', {
      class: `chip${draft.repeat === v ? ' on' : ''}`, onClick: () => { draft.repeat = v; render(); },
    }, label))),
    draft.repeat !== 'none' ? h('label', { class: 'field-wrap field-wrap-inline' }, h('span', null, 'Повторять до'),
      h('input', { class: 'field', type: 'date', value: draft.until || '', onChange: (e) => { draft.until = e.target.value || null; } })) : null);

  const notes = () => h('textarea', { class: 'field field-notes', rows: 2, placeholder: 'Адрес, что взять с собой…', onInput: (e) => { draft.notes = e.target.value; } }, draft.notes || '');

  function render() {
    body.replaceChildren(
      section('Для кого', who()),
      section('Что', ...what()),
      section('Когда', when()),
      draft.allDay ? null : section('Сколько длится', howLong()),
      section('Повтор', repeat()),
      section('Заметка', notes()),
    );
  }

  async function save() {
    if (!draft.title.trim()) { toast('Напишите, что за событие, или выберите вариант'); return; }
    const fields = pick(draft);
    if (repeating) {
      const scope = await confirmDialog({
        title: 'Изменить повторяющееся событие', message: 'Изменить только этот раз или все повторы?',
        actions: [{ label: 'Только этот раз', value: 'one' }, { label: 'Все повторы', value: 'all', style: 'primary' }],
      });
      if (!scope) return;
      if (scope === 'one') editOccurrence(event.id, occDk, { ...fields, repeat: 'none', until: null });
      else editSeries(event.id, occDk, fields);
    } else {
      saveEvent(editing ? { ...event, ...fields } : fields);
    }
    sheet.close();
    toast(editing ? 'Сохранено' : 'Событие добавлено', 'ok');
  }

  async function remove() {
    if (repeating) {
      const scope = await confirmDialog({
        title: 'Удалить событие', message: `«${event.title}» повторяется. Что удалить?`,
        actions: [{ label: 'Только этот раз', value: 'one' }, { label: 'Все повторы', value: 'all', style: 'danger' }],
      });
      if (!scope) return;
      if (scope === 'one') skipOccurrence(event.id, occDk); else deleteEvent(event.id);
    } else {
      const ok = await confirmDialog({
        title: 'Удалить событие', message: `Удалить «${event.title}»?`,
        actions: [{ label: 'Отмена', value: false }, { label: 'Удалить', value: true, style: 'danger' }],
      });
      if (!ok) return;
      deleteEvent(event.id);
    }
    sheet.close();
    toast('Удалено');
  }

  render();
  const sheet = openSheet({
    title: editing ? 'Событие' : 'Новое событие', size: 'l', body,
    footer: [
      editing ? h('button', { class: 'btn danger ghost', onClick: remove }, icons.trash(), 'Удалить') : null,
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn primary big', onClick: save }, icons.check(), 'Сохранить'),
    ],
  });
}
