/** Personal settings, kept next to the journal (reglages.json). */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const settingsPath = (folder) => join(folder, 'reglages.json');

export function readSettings(folder) {
  try {
    return existsSync(settingsPath(folder)) ? JSON.parse(readFileSync(settingsPath(folder), 'utf8')) : {};
  } catch {
    return {}; // a broken settings file never blocks the journal
  }
}

export function saveSetting(folder, name, value) {
  mkdirSync(folder, { recursive: true });
  writeFileSync(settingsPath(folder), JSON.stringify({ ...readSettings(folder), [name]: value }, null, 2) + '\n');
}
