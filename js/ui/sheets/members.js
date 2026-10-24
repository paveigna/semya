// Family members and helpers (nanny, cleaner…): name, avatar, colour.
import { h, avatar } from '../dom.js';
import { confirmDialog, openSheet, toast } from '../sheet.js';
import { icons } from '../icons.js';
import { store } from '../../core/store.js';
import { deleteMember, saveMember } from '../../core/actions.js';
import { AVATARS, HELPER_ROLES, PALETTE } from '../../config.js';

export function openMembersSheet() {
  const sheet = openSheet({ title: 'Участники', size: 'm', body: h('div') });
  const draw = () => {
    const { members } = store.get();
    const row = (m) => h('button', { class: 'list-row', onClick: () => openMemberEditor(m, draw) },
      avatar(m.emoji, m.color, 'm'),
      h('span', { class: 'list-main' }, h('span', { class: 'list-title' }, m.name),
        h('span', { class: 'list-sub' }, m.kind === 'helper' ? m.role || 'Помощник' : 'Семья')),
      icons.right());
    const family = members.filter((m) => m.kind !== 'helper');
    const helpers = members.filter((m) => m.kind === 'helper');
    sheet.setBody(h('div', null,
      family.length ? h('div', { class: 'list' }, family.map(row)) : h('p', { class: 'muted' }, 'Добавьте членов семьи: у каждого будет свой цвет в календаре.'),
      helpers.length ? [h('h3', { class: 'section-title' }, 'Помощники'), h('div', { class: 'list' }, helpers.map(row))] : null));
  };
  sheet.setFooter([
    h('button', { class: 'btn', onClick: () => openMemberEditor({ kind: 'helper' }, draw) }, icons.plus(), 'Помощник'),
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn primary', onClick: () => openMemberEditor({ kind: 'family' }, draw) }, icons.plus(), 'Член семьи'),
  ]);
  draw();
  return sheet;
}

export function openMemberEditor(member = {}, onDone) {
  const { members } = store.get();
  const used = new Set(members.filter((m) => m.id !== member.id).map((m) => m.color));
  const draft = {
    kind: 'family', name: '', role: '', emoji: member.kind === 'helper' ? '🧹' : '🙂',
    color: PALETTE.find((c) => !used.has(c)) || PALETTE[0], ...member,
  };
  const body = h('div', { class: 'editor' });

  const render = () => body.replaceChildren(
    h('div', { class: 'me-preview' }, avatar(draft.emoji, draft.color, 'xl')),
    h('section', { class: 'ed-section' },
      h('div', { class: 'segmented segmented-wide' },
        [['family', 'Семья'], ['helper', 'Помощник']].map(([v, l]) => h('button', {
          class: draft.kind === v ? 'on' : '', onClick: () => { draft.kind = v; render(); },
        }, l)))),
    h('section', { class: 'ed-section' }, h('h3', { class: 'section-title' }, 'Имя'),
      h('input', { class: 'field field-title', type: 'text', value: draft.name, placeholder: draft.kind === 'helper' ? 'Например, Ольга' : 'Например, Маша',
        onInput: (e) => { draft.name = e.target.value; } })),
    draft.kind === 'helper' ? h('section', { class: 'ed-section' }, h('h3', { class: 'section-title' }, 'Кто это'),
      h('div', { class: 'chips' }, HELPER_ROLES.map((r) => h('button', {
        class: `chip${draft.role === r ? ' on' : ''}`, onClick: () => { draft.role = r; render(); },
      }, r)))) : null,
    h('section', { class: 'ed-section' }, h('h3', { class: 'section-title' }, 'Цвет'),
      h('div', { class: 'swatches' }, PALETTE.map((c) => h('button', {
        class: `swatch${draft.color === c ? ' on' : ''}${used.has(c) ? ' used' : ''}`, style: { '--c': c }, 'aria-label': c,
        onClick: () => { draft.color = c; render(); },
      })))),
    h('section', { class: 'ed-section' }, h('h3', { class: 'section-title' }, 'Значок'),
      h('div', { class: 'emoji-grid' }, AVATARS.map((a) => h('button', {
        class: `emoji-btn${draft.emoji === a ? ' on' : ''}`, onClick: () => { draft.emoji = a; render(); },
      }, a)))),
  );
  render();

  const sheet = openSheet({
    title: member.id ? 'Изменить участника' : 'Новый участник', size: 'm', body,
    footer: [
      member.id ? h('button', {
        class: 'btn danger ghost',
        onClick: async () => {
          const ok = await confirmDialog({
            title: `Удалить ${member.name}?`, message: 'Личные события этого участника тоже удалятся. Общие события останутся.',
            actions: [{ label: 'Отмена', value: false }, { label: 'Удалить', value: true, style: 'danger' }],
          });
          if (!ok) return;
          deleteMember(member.id); sheet.close(); onDone?.(); toast('Участник удалён');
        },
      }, icons.trash(), 'Удалить') : null,
      h('span', { class: 'spacer' }),
      h('button', {
        class: 'btn primary big',
        onClick: () => {
          if (!draft.name.trim()) { toast('Введите имя'); return; }
          saveMember({ ...draft, name: draft.name.trim(), role: draft.kind === 'helper' ? draft.role : '' });
          sheet.close(); onDone?.(); toast('Сохранено', 'ok');
        },
      }, icons.check(), 'Сохранить'),
    ],
  });
}
