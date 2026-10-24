// iPad-style form sheets, confirmation dialogs and toasts.
import { h } from './dom.js';
import { icons } from './icons.js';

let stack = [];

export function openSheet({ title, body, footer, size = 'm', onClose }) {
  const titleEl = h('h2', { class: 'sheet-title' }, title || '');
  const bodyEl = h('div', { class: 'sheet-body' }, body);
  const footEl = h('footer', { class: 'sheet-foot' });
  const panel = h('div', { class: `sheet sheet-${size}`, role: 'dialog', 'aria-modal': 'true' },
    h('header', { class: 'sheet-head' }, titleEl,
      h('button', { class: 'icon-btn', 'aria-label': 'Закрыть', onClick: () => api.close() }, icons.close())),
    bodyEl, footEl);
  const backdrop = h('div', { class: 'sheet-backdrop', onClick: (e) => { if (e.target === backdrop) api.close(); } }, panel);

  const api = {
    panel,
    close() {
      if (!backdrop.isConnected || backdrop.classList.contains('leaving')) return;
      backdrop.classList.add('leaving');
      stack = stack.filter((x) => x !== api);
      setTimeout(() => backdrop.remove(), 240);
      onClose?.();
    },
    setTitle(t) { titleEl.textContent = t; },
    setBody(node) { bodyEl.replaceChildren(node); bodyEl.scrollTop = 0; },
    setFooter(nodes) {
      footEl.replaceChildren(...(nodes || []).filter(Boolean));
      footEl.hidden = !footEl.childElementCount;
    },
  };
  api.setFooter(footer);
  document.body.append(backdrop);
  stack.push(api);
  return api;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close();
});

/** actions: [{ label, value, style: 'primary' | 'danger' | '' }] → resolves to value or null. */
export function confirmDialog({ title, message, actions }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; sheet.close(); resolve(v); };
    const sheet = openSheet({
      title, size: 's',
      body: message ? h('p', { class: 'confirm-msg' }, message) : null,
      footer: actions.map((a) => h('button', { class: `btn ${a.style || ''}`, onClick: () => finish(a.value) }, a.label)),
      onClose: () => { if (!done) { done = true; resolve(null); } },
    });
  });
}

export function toast(message, kind = '') {
  const t = h('div', { class: `toast ${kind}`, role: 'status' }, message);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 2600);
}
