// Weather from Open-Meteo (free, no key). Cached for 30 minutes.
import { dayKey } from '../core/dates.js';

const CACHE_KEY = 'family-calendar:weather';
const TTL = 30 * 60 * 1000;
const listeners = new Set();
let data = null;
let inflight = null;

const cityKey = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
const emit = () => listeners.forEach((fn) => fn(data));

export const weather = {
  get: () => data,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

function shape(j) {
  const d = j.daily;
  return {
    current: {
      t: j.current.temperature_2m, feels: j.current.apparent_temperature,
      code: j.current.weather_code, isDay: !!j.current.is_day, wind: j.current.wind_speed_10m,
    },
    days: d.time.map((date, i) => ({
      date, code: d.weather_code[i], tMax: d.temperature_2m_max[i], tMin: d.temperature_2m_min[i],
      pop: d.precipitation_probability_max[i] ?? 0, rain: d.precipitation_sum[i] ?? 0,
      snow: d.snowfall_sum[i] ?? 0, windMax: d.wind_speed_10m_max[i] ?? 0, uv: d.uv_index_max[i] ?? 0,
    })),
    hourly: {
      time: j.hourly.time, t: j.hourly.temperature_2m, feels: j.hourly.apparent_temperature,
      pop: j.hourly.precipitation_probability, code: j.hourly.weather_code,
    },
  };
}

export function refreshWeather(city, force = false) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && c.key === cityKey(city)) {
      data = c.data;
      emit();
      if (!force && Date.now() - c.at < TTL) return Promise.resolve(data);
    }
  } catch { /* ignore broken cache */ }
  if (inflight) return inflight;

  const q = new URLSearchParams({
    latitude: city.lat, longitude: city.lon, timezone: 'auto', forecast_days: '7', wind_speed_unit: 'kmh',
    current: 'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,snowfall_sum,wind_speed_10m_max,uv_index_max',
  });
  inflight = fetch(`https://api.open-meteo.com/v1/forecast?${q}`)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((j) => {
      data = shape(j);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ key: cityKey(city), at: Date.now(), data }));
      emit();
      return data;
    })
    .catch((e) => { console.warn('Weather failed', e); if (!data) { data = { error: true }; emit(); } return data; })
    .finally(() => { inflight = null; });
  return inflight;
}

/** Weather facts for one day, including the 8:00 "leaving home" reading. */
export function dayForecast(date) {
  if (!data?.days) return null;
  const dk = dayKey(date);
  const day = data.days.find((d) => d.date === dk);
  if (!day) return null;
  const at = (h) => {
    const i = data.hourly.time.indexOf(`${dk}T${String(h).padStart(2, '0')}:00`);
    return i < 0 ? null : { t: data.hourly.t[i], feels: data.hourly.feels[i], pop: data.hourly.pop[i], code: data.hourly.code[i] };
  };
  return { ...day, morning: at(8) || { t: day.tMin, feels: day.tMin, pop: day.pop, code: day.code }, afternoon: at(15) };
}

export async function searchCity(name) {
  const q = new URLSearchParams({ name, count: '6', language: 'ru', format: 'json' });
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${q}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return (j.results || []).map((x) => ({
    name: x.name, lat: x.latitude, lon: x.longitude, region: [x.admin1, x.country].filter(Boolean).join(', '),
  }));
}
