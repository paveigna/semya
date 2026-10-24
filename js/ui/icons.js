import { svg } from './dom.js';

const icon = (d, w = 2) => () => svg(
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`,
);

export const icons = {
  plus: icon('<path d="M12 5v14M5 12h14"/>', 2.6),
  mic: icon('<rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>', 2.1),
  left: icon('<path d="M14.5 5.5 8 12l6.5 6.5"/>', 2.5),
  right: icon('<path d="M9.5 5.5 16 12l-6.5 6.5"/>', 2.5),
  close: icon('<path d="M7 7l10 10M17 7 7 17"/>', 2.4),
  people: icon('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.8 14.3A4.5 4.5 0 0 1 21 18.6"/>', 1.9),
  settings: icon('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/>', 2),
  trash: icon('<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7M9.5 7V4.5h5V7"/>', 1.9),
  check: icon('<path d="M5 12.5 9.5 17 19 7.5"/>', 2.6),
  repeat: icon('<path d="M17 3.5 20 6.5l-3 3"/><path d="M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5 4 17.5l3-3"/><path d="M20 12.5v1a4 4 0 0 1-4 4H4"/>', 1.9),
};
