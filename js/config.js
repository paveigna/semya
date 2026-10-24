// Central configuration: change colours, presets and defaults here.
export const APP_VERSION = '1.1.0';
export const STORAGE_KEY = 'family-calendar:v1';
export const JOINT_ID = 'family'; // pseudo-member id for joint family events

export const PALETTE = [
  '#3A6FF7', '#E5577A', '#2FA37A', '#8A5CF6', '#F2784B',
  '#1BA6B8', '#C2489B', '#E3A21A', '#5B6B82', '#7A9A3A',
];

export const JOINT_PALETTE = ['#B08D57', '#C9A227', '#B76E79', '#8C7B6B', '#4E6E5D'];

export const AVATARS = [
  '👩', '👨', '👧', '👦', '🧒', '👶', '👵', '👴', '🧑', '👩‍🦰', '👱‍♀️', '🧔',
  '🐱', '🐶', '🦊', '🐻', '🐼', '🦄', '🐰', '🦁', '🌸', '⭐️', '🧹', '🍼',
];

export const PRESETS = [
  { emoji: '🩰', title: 'Танцы' }, { emoji: '⚽', title: 'Футбол' },
  { emoji: '🏊', title: 'Бассейн' }, { emoji: '🎨', title: 'Рисование' },
  { emoji: '🎵', title: 'Музыка' }, { emoji: '📚', title: 'Уроки' },
  { emoji: '🩺', title: 'Врач' }, { emoji: '🦷', title: 'Стоматолог' },
  { emoji: '🎂', title: 'День рождения' }, { emoji: '🧹', title: 'Уборка' },
  { emoji: '👶', title: 'Няня' }, { emoji: '🛒', title: 'Покупки' },
  { emoji: '🍽️', title: 'Ужин' }, { emoji: '🎬', title: 'Кино' },
  { emoji: '🏡', title: 'Гости' }, { emoji: '✈️', title: 'Поездка' },
];

// Keyword → emoji, used by the editor and the voice parser.
export const EMOJI_HINTS = [
  [/танц|балет|хореограф/, '🩰'], [/футбол/, '⚽'], [/хокке/, '🏒'], [/теннис/, '🎾'],
  [/бассейн|плаван/, '🏊'], [/рисов|рисун|художеств/, '🎨'], [/музык|пианино|скрипк|гитар|хор|вокал/, '🎵'],
  [/урок|домашн|английск|математ|репетитор|кружок/, '📚'], [/стоматолог|зуб/, '🦷'],
  [/врач|доктор|педиатр|поликлиник|анализ|прививк/, '🩺'], [/день рожд|др |праздник/, '🎂'],
  [/уборк|клининг/, '🧹'], [/нян/, '👶'], [/магазин|покупк|продукт/, '🛒'],
  [/ужин|обед|завтрак|ресторан|кафе/, '🍽️'], [/кино|фильм|мультик/, '🎬'], [/театр|спектакл|концерт/, '🎭'],
  [/гост/, '🏡'], [/поездк|самолет|аэропорт|отпуск|путешеств/, '✈️'], [/школ/, '🏫'], [/садик|детский сад|сад /, '🧸'],
  [/спорт|тренировк|зал|гимнастик|йог|бег/, '🏃'], [/работ|встреч|совещ/, '💼'], [/парикмахер|стрижк/, '💇'],
  [/машин|сервис|шиномонтаж/, '🚗'], [/прогулк|парк/, '🌳'],
];

export const DURATIONS = [30, 60, 90, 120, 180];

export const REPEATS = [
  ['none', 'Не повторять'], ['daily', 'Каждый день'],
  ['weekly', 'Каждую неделю'], ['monthly', 'Каждый месяц'],
];

export const HELPER_ROLES = ['Няня', 'Уборка', 'Репетитор', 'Водитель', 'Тренер'];

export const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];

export const DEFAULT_SETTINGS = {
  jointColor: '#B08D57',
  city: { name: 'Рига', lat: 56.9496, lon: 24.1052 },
  dayStart: 7,
  dayEnd: 22,
  voiceMode: 'auto', // 'rules' | 'auto' | 'gemini'
  geminiKey: '',
  geminiModel: GEMINI_MODELS[0],
};
