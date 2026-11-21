/**
 * Draws the full-screen interface: a text-mode window in parme and pink, double frames, a menu
 * bar at the firstLine and the keys at the bottom. Pure function: (state, size) → lines.
 * Colors come from the 256-color palette, which macOS Terminal displays correctly.
 */
import { SYMBOLS } from '../journal.mjs';
import { dayLabel } from '../dates.mjs';

const PARME = 182;
const DARK_PURPLE = 53;
const PINK = 212;
const MAUVE = 96;
const WHITE = 231;

export const VIEWS = [['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois'], ['search', 'Chercher']];
const RESET = '\x1b[0m';
const colors = (background, foreground, bold = false) => `\x1b[0;${bold ? '1;' : ''}48;5;${background};38;5;${foreground}m`;
const BODY = colors(PARME, DARK_PURPLE);
const FRAME = colors(PARME, MAUVE, true);
const MENU_BAR = colors(MAUVE, WHITE);
const MENU_BAR_ACTIVE = colors(PINK, DARK_PURPLE, true);
const SELECTED = colors(PINK, DARK_PURPLE, true);
const DIMMED = colors(PARME, MAUVE);

const characters = (text) => [...String(text)];
/** Cuts or pads a text to an exact width (in characters). */
export function fitWidth(text, width) {
  const chars = characters(text);
  return chars.length > width ? chars.slice(0, Math.max(0, width - 1)).join('') + '…' : String(text) + ' '.repeat(width - chars.length);
}

const frameLine = (left, fill, right, width) => FRAME + left + fill.repeat(width - 2) + right + RESET;
const boxed = (content, width, style = BODY) => FRAME + '║' + style + fitWidth(content, width - 2) + FRAME + '║' + RESET;

function titleLine(state, width) {
  const left = '═ Anaïs ';
  const right = ` ${dayLabel(state.isoDay)} ═`;
  const fill = Math.max(0, width - 2 - characters(left).length - characters(right).length);
  return FRAME + '╔' + left + '═'.repeat(fill) + right + '╗' + RESET;
}

function menuLine(state, width) {
  let line = FRAME + '║' + MENU_BAR + ' ';
  let used = 1;
  for (const [view, label] of VIEWS) {
    const item = ` ${label} `;
    line += (view === state.view ? MENU_BAR_ACTIVE : MENU_BAR) + item + MENU_BAR + ' ';
    used += characters(item).length + 1;
  }
  return line + ' '.repeat(Math.max(0, width - 2 - used)) + FRAME + '║' + RESET;
}

const entryText = (entry) => `${SYMBOLS[entry.kind]} ${entry.priority ? '! ' : ''}${entry.text}`;

const HELP_BY_VIEW = {
  day: ['↑↓ ←→ choisir  Espace fait  ! priorité  R reporter', 'T tâche  E événement  N note  Tab vue  Q quitter'],
  week: ['↑↓ choisir un jour  Entrée l’ouvrir  ←→ semaine', 'Tab vue  Q quitter'],
  month: ['↑↓ choisir un jour  Entrée l’ouvrir  M migrer', 'Tab vue  Q quitter'],
  search: ['Tapez vos mots  ↑↓ choisir  Entrée ouvrir le jour', 'Tab vue  Échap quitter la recherche'],
};

/** The input inputLines shown in the middle of the screen when adding an entry. */
function inputBox(state, width) {
  const innerWidth = Math.min(width - 6, 56);
  const leftPadding = ' '.repeat(Math.max(0, Math.floor((width - 2 - innerWidth - 2) / 2)));
  const title = ` ${state.input.title} `;
  const titleFill = Math.max(0, innerWidth - characters(title).length - 1);
  const field = fitWidth(state.input.text + '▌', innerWidth - 2);
  return [
    leftPadding + FRAME + '╔═' + title + '═'.repeat(titleFill) + '╗' + BODY,
    leftPadding + FRAME + '║ ' + SELECTED + field + FRAME + ' ║' + BODY,
    leftPadding + FRAME + '╚' + '═'.repeat(innerWidth) + '╝' + BODY,
    leftPadding + DIMMED + fitWidth('Entrée : noter · Échap : annuler', innerWidth + 2) + BODY,
  ].map((line) => ({ raw: line, visibleWidth: characters(leftPadding).length + innerWidth + 2 }));
}

/** state.rows: [{ text, selectable }]; state.selected: index in rows. */
export function render(state, { width, height }) {
  const contentHeight = Math.max(3, height - 7);
  const firstRow = Math.max(0, Math.min(state.selected - contentHeight + 1, state.rows.length - contentHeight));
  const visibleRows = state.rows.slice(Math.max(0, firstRow), Math.max(0, firstRow) + contentHeight);
  const lines = [titleLine(state, width), menuLine(state, width), frameLine('╟', '─', '╢', width)];
  for (let rowIndex = 0; rowIndex < contentHeight; rowIndex++) {
    const entry = visibleRows[rowIndex];
    if (!entry) {
      lines.push(boxed(rowIndex === 0 && !state.rows.length ? `  ${state.emptyText || ''}` : '', width, DIMMED));
      continue;
    }
    const isSelected = Math.max(0, firstRow) + rowIndex === state.selected && entry.selectable;
    const style = isSelected ? SELECTED : entry.muted ? DIMMED : BODY;
    lines.push(boxed(`${isSelected ? '▸ ' : '  '}${entry.text}`, width, style));
  }
  if (state.input) {
    const inputLines = inputBox(state, width);
    const firstLine = 3 + Math.max(0, Math.floor((contentHeight - inputLines.length) / 2));
    inputLines.forEach((boxLine, offset) => {
      lines[firstLine + offset] = FRAME + '║' + BODY + boxLine.raw + ' '.repeat(Math.max(0, width - 2 - boxLine.visibleWidth)) + FRAME + '║' + RESET;
    });
  }
  lines.push(frameLine('╟', '─', '╢', width));
  const [firstHelp, secondHelp] = HELP_BY_VIEW[state.view];
  lines.push(boxed(` ${state.message || firstHelp}`, width, state.message ? SELECTED : MENU_BAR));
  lines.push(boxed(` ${secondHelp}`, width, MENU_BAR));
  lines.push(frameLine('╚', '═', '╝', width));
  return lines;
}

export { entryText };
