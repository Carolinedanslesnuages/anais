/**
 * Draws the full-screen interface: a text-mode window with double frames, a menu bar at the top,
 * the keys at the bottom and, on a wide enough screen, a side panel with the whole text of the
 * selected line. Pure function: (state, size, theme) → lines.
 */
import { SYMBOLS } from '../journal.mjs';
import { dayLabel } from '../dates.mjs';
import { RESET_CODE, themeNamed } from './themes.mjs';

export const VIEWS = [['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois'], ['search', 'Chercher']];
/** Below this width, there is no room for the side panel. */
export const PANEL_MIN_WIDTH = 84;

import { displayWidth, fitWidth, wrapText } from '../text-width.mjs';
import { cloudLines, faceOf } from './cloud.mjs';

export { fitWidth, wrapText };

export const entryText = (entry) => `${SYMBOLS[entry.kind]} ${entry.priority ? '! ' : ''}${entry.text}${entry.body && entry.body.length ? ' ¶' : ''}`;

const HELP_BY_VIEW = {
  day: ['↑↓ ←→ choisir  Espace fait  T E N ajouter  ? aide', 'Entrée lire  H humeur  S soir  Tab vue  Q quitter'],
  week: ['↑↓ choisir un jour  Entrée l’ouvrir  ←→ semaine', 'Tab vue  Q quitter'],
  month: ['↑↓ choisir un jour  Entrée l’ouvrir  M migrer', 'Tab vue  Q quitter'],
  search: ['Tapez vos mots  ↑↓ choisir  Entrée ouvrir le jour', 'Tab vue  Échap quitter la recherche'],
  moods: ['↑↓ choisir une humeur  Entrée la garder', 'Échap annuler'],
  editor: ['Entrée : à la ligne  Ctrl+S : enregistrer', 'Échap : annuler'],
  quickInput: ['Entrée : noter', 'Échap : annuler'],
  help: ['Une touche pour revenir', ''],
};

/** Every key of the day page, shown with "?". */
export const FULL_HELP = [
  '↑ ↓      choisir une ligne',
  '← →      jour précédent, jour suivant',
  'Espace   cocher une tâche, ou la rouvrir',
  '!        tâche prioritaire, ou non',
  'R        reporter la tâche à demain',
  'A        abandonner la tâche',
  'T E N    ajouter une tâche, un événement, une note',
  'Entrée   lire et modifier la ligne (Ctrl+S enregistre)',
  'H        humeur du jour',
  'S        question du soir',
  'Tab      Jour, Semaine, Mois, Chercher',
  'Q        quitter',
];

function frameParts(theme, width) {
  const edge = (left, fill, right) => theme.frame + left + fill.repeat(width - 2) + right + RESET_CODE;
  const boxed = (content, style) => theme.frame + '║' + style + content + theme.frame + '║' + RESET_CODE;
  return { edge, boxed };
}

function titleLine(state, theme, width) {
  const left = `═ Anaïs ${faceOf(state.companion || 'calm')} `;
  const right = ` ${dayLabel(state.isoDay)}${state.moodEmoji ? ` · ${state.moodEmoji}` : ''} ═`;
  const fill = Math.max(0, width - 2 - displayWidth(left) - displayWidth(right));
  return theme.frame + '╔' + left + '═'.repeat(fill) + right + '╗' + RESET_CODE;
}

function menuLine(state, theme, width) {
  let line = theme.frame + '║' + theme.bar + ' ';
  let used = 1;
  for (const [view, label] of VIEWS) {
    const item = ` ${label} `;
    line += (view === state.view ? theme.barActive : theme.bar) + item + theme.bar + ' ';
    used += displayWidth(item) + 1;
  }
  return line + ' '.repeat(Math.max(0, width - 2 - used)) + theme.frame + '║' + RESET_CODE;
}

/** The editor fills the content area: title, wrapped text with a cursor, scrolled to the end. */
function editorRows(editor, theme, innerWidth, contentHeight) {
  const textWidth = innerWidth - 4;
  const wrapped = wrapText(`${editor.text}▌`, textWidth);
  const visible = wrapped.slice(Math.max(0, wrapped.length - (contentHeight - 2)));
  const rows = [theme.message + fitWidth(` ${editor.title}`, innerWidth)];
  for (let index = 0; index < contentHeight - 2; index++) {
    rows.push(theme.body + '  ' + theme.field + fitWidth(visible[index] ?? '', textWidth) + theme.body + '  ');
  }
  rows.push(theme.dimmed + fitWidth(editor.multiline ? '  La première ligne sert de titre.' : '', innerWidth));
  return rows;
}

function listCell(state, theme, rowIndex, firstRow, width) {
  const viewRow = state.rows[firstRow + rowIndex];
  if (!viewRow) return theme.dimmed + fitWidth(rowIndex === 0 && !state.rows.length ? `  ${state.emptyText || ''}` : '', width);
  const isSelected = firstRow + rowIndex === state.selected && viewRow.selectable;
  const style = isSelected ? theme.selected : viewRow.muted ? theme.dimmed : theme.body;
  return style + fitWidth(`${isSelected ? '▸ ' : '  '}${viewRow.text}`, width);
}

/** Lines of the side panel: the selected line's detail, with the cloud at the bottom of the day page. */
function panelLines(state, width, height) {
  const viewRow = state.rows[state.selected];
  const detail = (viewRow && viewRow.detail) || state.panelDetail;
  const lines = detail ? [detail.heading, '', ...(detail.lines || wrapText(detail.text, width))] : [];
  if (state.view === 'day' && height >= lines.length + 4) {
    const cloud = cloudLines(state.companion || 'calm', state.partyFrame ?? null);
    while (lines.length < height - cloud.length) lines.push('');
    lines.push(...cloud);
  }
  return lines;
}

export function render(state, { width, height }, theme = themeNamed()) {
  const { edge, boxed } = frameParts(theme, width);
  const innerWidth = width - 2;
  const contentHeight = Math.max(3, height - 7);
  const lines = [titleLine(state, theme, width), menuLine(state, theme, width), edge('╟', '─', '╢')];

  if (state.showHelp) {
    const helpLines = FULL_HELP.length > contentHeight ? [...FULL_HELP.slice(0, contentHeight - 1), '… agrandissez la fenêtre pour voir la suite'] : FULL_HELP;
    for (let rowIndex = 0; rowIndex < contentHeight; rowIndex++) lines.push(boxed(fitWidth(`  ${helpLines[rowIndex] ?? ''}`, innerWidth), theme.body));
  } else if (state.editor) {
    for (const content of editorRows(state.editor, theme, innerWidth, contentHeight)) lines.push(boxed(content, ''));
  } else {
    const withPanel = width >= PANEL_MIN_WIDTH && ['day', 'search', 'month'].includes(state.view);
    const listWidth = withPanel ? Math.floor((innerWidth - 1) / 2) : innerWidth;
    const panelWidth = innerWidth - 1 - listWidth;
    const panel = withPanel ? panelLines(state, panelWidth - 2, contentHeight) : [];
    const firstRow = Math.max(0, Math.min(state.selected - contentHeight + 1, state.rows.length - contentHeight));
    for (let rowIndex = 0; rowIndex < contentHeight; rowIndex++) {
      let content = listCell(state, theme, rowIndex, firstRow, listWidth);
      if (withPanel) {
        const panelStyle = rowIndex === 0 ? theme.message : theme.body;
        content += theme.frame + '│' + panelStyle + ' ' + fitWidth(panel[rowIndex] ?? '', panelWidth - 1);
      }
      lines.push(boxed(content, ''));
    }
  }

  lines.push(edge('╟', '─', '╢'));
  const helpKey = state.showHelp ? 'help' : state.editor ? (state.editor.multiline ? 'editor' : 'quickInput') : state.view;
  const [firstHelp, secondHelp] = HELP_BY_VIEW[helpKey];
  lines.push(boxed(fitWidth(` ${state.message || firstHelp}`, innerWidth), state.message ? theme.message : theme.bar));
  lines.push(boxed(fitWidth(` ${secondHelp}`, innerWidth), theme.bar));
  lines.push(edge('╚', '═', '╝'));
  return lines;
}
