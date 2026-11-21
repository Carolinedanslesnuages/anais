/** Terminal display: narrow (fits a small cyberdeck screen), pink when the terminal allows colors. */
import { SYMBOLS } from './journal.mjs';
import { dayLabel } from './dates.mjs';

const useColor = () => process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (useColor() ? `\x1b[${code}m${text}\x1b[0m` : text);
export const pink = (text) => paint('38;5;212', text);
export const muted = (text) => paint('2', text);
const bold = (text) => paint('1', text);

const STYLE_OF_KIND = { done: muted, migrated: muted, cancelled: (text) => muted(paint('9', text)) };

export function entryLine(entry, number) {
  const style = STYLE_OF_KIND[entry.kind] || ((text) => text);
  const marker = entry.priority ? `${pink('!')} ` : '';
  return `${muted(String(number).padStart(2))} ${pink(SYMBOLS[entry.kind])} ${marker}${style(entry.text)}`;
}

export function dayBlock(isoDay, entries, { isToday = false } = {}) {
  const title = `${dayLabel(isoDay)}${isToday ? ' · aujourd’hui' : ''}`;
  const lines = [bold(pink(title))];
  if (!entries.length) lines.push(muted('   (rien pour l’instant)'));
  entries.forEach((entry, index) => {
    lines.push(entryLine(entry, index + 1));
    for (const bodyLine of entry.body || []) lines.push(muted(`      ${bodyLine}`));
  });
  return lines.join('\n');
}
