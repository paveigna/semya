# Семейный календарь (iPad)

Web app for the iPad Home Screen. All data stays on the iPad.

## Structure
- `index.html`, `manifest.webmanifest`, `sw.js`: app shell, Home Screen install, offline support
- `css/app.css`: design system (light/dark)
- `js/config.js`: colours, presets, defaults
- `js/core/`: dates, repeats, data store, domain actions
- `js/services/`: weather (Open-Meteo), clothing advice, speech, voice parsers (rules + Gemini)
- `js/ui/`: header/chips/buttons, week/day/month views, sheets (editor, members, settings, voice, weather)

## Backups (Settings → Резервные копии)
1. **Автокопия в GitHub**: after each change, the full data is written to `semya-backup.json` in a private repo. Every save is a separate version in the repo's history. An empty calendar never overwrites the copy. Keys are never included.
2. **Файл копии**: manual JSON file, e.g. to iCloud Drive.
3. **Снимки на этом iPad**: one per day plus one before every restore, last 14 kept. Lost if the app is deleted.

## Updating
1. Edit the files and upload them again (replace the old ones).
2. In `sw.js`, raise `VERSION` (e.g. `fc-1.0.1`).
3. On the iPad, close the app completely and open it again.

Data is not affected by updates. Before big changes: Settings → "Сохранить копию".
