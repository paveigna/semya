// Turns text into a command (rules and/or Gemini) and finds the events it refers to.
import { addDays, parseDayKey, startOfDay, timeKey } from '../core/dates.js';
import { occurrences } from '../core/actions.js';
import { parseRules } from './parser-rules.js';
import { parseGemini } from './parser-gemini.js';

/**
 * Modes: 'rules' = offline only; 'gemini' = Gemini first, rules if it fails;
 * 'auto' = rules for simple complete commands, Gemini for everything else.
 */
export async function interpret(text, state, now = new Date()) {
  const { voiceMode, geminiKey, geminiModel } = state.settings;
  const rules = parseRules(text, state, now);
  const canGemini = !!geminiKey && voiceMode !== 'rules' && navigator.onLine !== false;
  const useRules = !canGemini || (voiceMode === 'auto' && rules.action === 'add' && rules.complete);
  if (useRules) return rules;
  try {
    const g = await parseGemini(text, state, { key: geminiKey, model: geminiModel }, now);
    return g.action === 'unknown' && rules.complete ? rules : g;
  } catch (e) {
    console.warn('Gemini failed, using rules', e);
    return { ...rules, warning: e.message };
  }
}

const stemWords = (q) => q.toLowerCase().replace(/ё/g, 'е').split(/\s+/)
  .filter((w) => w.length >= 3).map((w) => w.slice(0, Math.max(3, w.length - 2)));

/** Occurrences a delete/edit command refers to (max 6). */
export function findTargets(target, state, now = new Date()) {
  const today = startOfDay(now);
  const from = target.date ? parseDayKey(target.date) : addDays(today, -1);
  const to = target.date ? addDays(from, 1) : addDays(today, 60);
  let list = occurrences(state, from, to);

  if (target.ids?.length) {
    list = list.filter((o) => target.ids.includes(o.ev.id));
  } else {
    if (!target.query && !target.memberIds?.length) return [];
    if (target.memberIds?.length) list = list.filter((o) => o.ev.memberIds.some((id) => target.memberIds.includes(id)));
    if (target.query) {
      const words = stemWords(target.query);
      if (words.length) {
        list = list.filter((o) => {
          const t = o.ev.title.toLowerCase().replace(/ё/g, 'е');
          return words.some((w) => t.includes(w));
        });
      }
    }
  }
  if (target.time) {
    const exact = list.filter((o) => timeKey(o.start) === target.time);
    if (exact.length) list = exact;
  }
  if (!target.date) { // nearest occurrence of each event only
    const seen = new Set();
    list = list.filter((o) => (seen.has(o.ev.id) ? false : (seen.add(o.ev.id), true)));
  }
  return list.slice(0, 6);
}
