// Rules that turn a day's forecast into what a child should wear to kindergarten / school.
// Based on the "feels like" temperature at 8:00, when children leave home.
import { isRain, isSnow } from './wmo.js';

export const fmtT = (t) => {
  const r = Math.round(t);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)}°`;
};

const BANDS = [
  { max: -10, label: 'Зимняя экипировка', items: [['🧥', 'Зимний комбинезон или пуховик'], ['🧦', 'Термобельё и шерстяные носки'], ['🧣', 'Тёплая шапка и снуд'], ['🧤', 'Тёплые варежки'], ['🥾', 'Зимние ботинки']] },
  { max: 0, label: 'Зимняя куртка и шапка', items: [['🧥', 'Зимняя куртка и утеплённые штаны'], ['🧣', 'Шапка и шарф'], ['🧤', 'Варежки или перчатки'], ['🥾', 'Зимняя обувь']] },
  { max: 7, label: 'Тёплая куртка и шапка', items: [['🧥', 'Тёплая демисезонная куртка'], ['🧢', 'Шапка'], ['🧤', 'Перчатки'], ['🥾', 'Закрытые ботинки']] },
  { max: 13, label: 'Демисезонная куртка', items: [['🧥', 'Демисезонная куртка'], ['👕', 'Кофта под куртку'], ['🧢', 'Лёгкая шапка'], ['👟', 'Кроссовки или ботинки']] },
  { max: 18, label: 'Ветровка или толстовка', items: [['🧥', 'Ветровка или толстовка'], ['👖', 'Брюки или джинсы'], ['👟', 'Кроссовки']] },
  { max: 23, label: 'Футболка и кофта', items: [['👕', 'Футболка'], ['🧶', 'Лёгкая кофта на утро'], ['👟', 'Кроссовки']] },
  { max: Infinity, label: 'По-летнему', items: [['👗', 'Лёгкая одежда: шорты или платье'], ['👒', 'Панама или кепка'], ['💧', 'Бутылка воды']] },
];

export function clothingAdvice(f) {
  const t = f.morning.feels;
  const band = BANDS.find((b) => t <= b.max);
  const items = band.items.map(([icon, text]) => ({ icon, text }));
  const wet = f.pop >= 50 || f.rain >= 1 || isRain(f.code);
  const snowy = f.snow > 0.3 || isSnow(f.code);

  if (wet && !snowy) {
    items.push({ icon: '☔️', text: 'Дождевик или непромокаемая куртка' });
    if (f.tMin > 2) items.push({ icon: '👢', text: 'Резиновые сапоги' });
  }
  if (snowy) items.push({ icon: '❄️', text: 'Непромокаемые штаны' });
  if (wet || snowy) items.push({ icon: '🎒', text: 'Запасные носки и штаны в шкафчик' });
  if (f.windMax >= 30) items.push({ icon: '🌬️', text: 'Сильный ветер: капюшон или шарф' });
  if (f.uv >= 6 && t > 12) items.push({ icon: '🧴', text: 'Крем от солнца и головной убор' });
  if (f.tMax - f.morning.t >= 8) items.push({ icon: '🌡️', text: `Одеть слоями: днём до ${fmtT(f.tMax)}` });

  const label = band.label + (wet && !snowy ? ', дождевик' : snowy ? ', снег' : '');
  const facts = [`Утром ${fmtT(f.morning.t)}, ощущается ${fmtT(t)}`, `днём до ${fmtT(f.tMax)}`];
  if (wet || snowy) facts.push(`осадки ${f.pop}%`);
  return { label, summary: facts.join(', '), items };
}
