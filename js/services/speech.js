// Thin wrapper over the browser speech API (Russian). If unavailable, the UI falls back
// to the iPad keyboard microphone, which works everywhere.
const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

export const speechSupported = () => !!Recognition;

export function listen({ onText, onEnd, onError }) {
  const rec = new Recognition();
  rec.lang = 'ru-RU';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let finalText = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
    }
    onText?.((finalText + interim).trim(), false);
  };
  rec.onerror = (e) => onError?.(e.error);
  rec.onend = () => onEnd?.(finalText.trim());
  rec.start();
  return () => { try { rec.stop(); } catch { /* already stopped */ } };
}
