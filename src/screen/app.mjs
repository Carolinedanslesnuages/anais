/**
 * The full-screen interface: state, keys and the main loop. The state logic (buildRows,
 * handleKey) is separate from the terminal, so it can be tested without one.
 */
import { addDays, today, weekStart, monthOf, dayLabel } from '../dates.mjs';
import { fullText } from '../journal.mjs';
import { addEntry, editEntry, toggleDone, togglePriority, postpone, migrateOpenTasks, setTaskKind, searchEntries } from '../actions.mjs';
import { render, VIEWS, entryText } from './render.mjs';

const KEYS = {
  '\x1b[A': 'up', '\x1b[B': 'down', '\x1b[C': 'right', '\x1b[D': 'left', '\t': 'tab', '\x1b[Z': 'shift-tab',
  '\r': 'enter', '\n': 'enter', '\x7f': 'backspace', '\b': 'backspace', '\x1b': 'escape', '\x03': 'quit', '\x13': 'save', '\x04': 'save',
};
const NAMED_KEYS = new Set(Object.values(KEYS));
const NEW_TITLES = { task: 'Nouvelle tâche', event: 'Nouvel événement', note: 'Nouvelle note' };
const ADDED_MESSAGES = { task: 'Tâche ajoutée.', event: 'Événement ajouté.', note: 'Note ajoutée.' };
const KIND_NAMES = { task: 'la tâche', done: 'la tâche', migrated: 'la tâche', cancelled: 'la tâche', event: 'l’événement', note: 'la note' };
const KIND_KEYS = { t: 'task', e: 'event', n: 'note' };
const KIND_LABELS = { task: 'Tâche', done: 'Tâche faite', migrated: 'Tâche reportée', cancelled: 'Tâche abandonnée', event: 'Événement', note: 'Note' };
const detailHeading = (entry) => `${KIND_LABELS[entry.kind]}${entry.priority ? ' · prioritaire' : ''}`;

/** A key that types text (not an arrow, Enter, Tab…). */
const isText = (pressedKey) => !NAMED_KEYS.has(pressedKey) && !pressedKey.startsWith('\x1b') && pressedKey >= ' ';

export const initialState = () => ({ view: 'day', isoDay: today(), selected: 0, rows: [], message: '', editor: null, query: '' });

const shortDay = (isoDay) => dayLabel(isoDay).split(' ').slice(0, 2).join(' ');

/** Rows of the current view, from the journal. */
export function buildRows(state, journal) {
  if (state.view === 'day') {
    const rows = journal.entriesOf(state.isoDay).map((entry, index) => ({
      text: entryText(entry),
      selectable: true,
      index,
      muted: ['done', 'migrated', 'cancelled'].includes(entry.kind),
      detail: { heading: detailHeading(entry), text: fullText(entry) },
    }));
    return { rows, emptyText: 'Rien pour l’instant. T pour une tâche, E pour un événement, N pour une note.' };
  }
  if (state.view === 'week') {
    const firstDay = weekStart(state.isoDay);
    const rows = Array.from({ length: 7 }, (unused, offset) => {
      const isoDay = addDays(firstDay, offset);
      const entries = journal.entriesOf(isoDay);
      const open = entries.filter((entry) => entry.kind === 'task').length;
      const events = entries.filter((entry) => entry.kind === 'event').map((entry) => entry.text);
      return { text: `${shortDay(isoDay).padEnd(12)} ${open} •  ${events.length ? `○ ${events.join(' · ')}` : ''}`, selectable: true, isoDay, muted: !entries.length };
    });
    return { rows, emptyText: '' };
  }
  if (state.view === 'month') {
    const days = journal.allDays().filter((isoDay) => isoDay.startsWith(monthOf(state.isoDay)));
    const rows = days.map((isoDay) => {
      const entries = journal.entriesOf(isoDay);
      const count = (kind) => entries.filter((entry) => entry.kind === kind).length;
      return { text: `${shortDay(isoDay).padEnd(12)} ${count('done')} ×  ${count('task')} •  ${count('event')} ○`, selectable: true, isoDay };
    });
    return { rows, emptyText: 'Rien de noté ce mois-ci.' };
  }
  const results = searchEntries(journal, state.query).map(({ isoDay, entry }) => ({
    text: `${shortDay(isoDay).padEnd(12)} ${entryText(entry)}`,
    selectable: true,
    isoDay,
    detail: { heading: `${dayLabel(isoDay)} · ${detailHeading(entry)}`, text: fullText(entry) },
  }));
  return { rows: [{ text: `Chercher : ${state.query}▌`, selectable: false }, ...results], emptyText: '' };
}

const selectableIndexes = (rows) => rows.map((viewRow, index) => (viewRow.selectable ? index : -1)).filter((index) => index >= 0);

function clampSelection(state) {
  const selectable = selectableIndexes(state.rows);
  if (!selectable.length) return { ...state, selected: 0 };
  return { ...state, selected: selectable.includes(state.selected) ? state.selected : selectable[0] };
}

const refresh = (state, journal) => clampSelection({ ...state, ...buildRows(state, journal) });

function moveSelection(state, step) {
  const selectable = selectableIndexes(state.rows);
  if (!selectable.length) return state;
  const position = Math.max(0, selectable.indexOf(state.selected));
  return { ...state, selected: selectable[Math.min(selectable.length - 1, Math.max(0, position + step))] };
}

function switchView(state, step) {
  const position = VIEWS.findIndex(([view]) => view === state.view);
  const [view] = VIEWS[(position + step + VIEWS.length) % VIEWS.length];
  return { ...state, view, selected: 0, query: view === 'search' ? state.query : '' };
}

function withError(state, action) {
  try {
    return { ...state, message: action() };
  } catch (error) {
    return { ...state, message: error.message };
  }
}

/** Keys while writing: tasks and events take one line (Entrée saves), notes and edits several. */
function handleEditorKey(state, pressedKey, journal) {
  const { editor } = state;
  if (pressedKey === 'escape') return { ...state, editor: null, message: 'Annulé.' };
  if (pressedKey === 'backspace') return { ...state, editor: { ...editor, text: [...editor.text].slice(0, -1).join('') } };
  const saves = pressedKey === 'save' || (pressedKey === 'enter' && !editor.multiline);
  if (pressedKey === 'enter' && editor.multiline) return { ...state, editor: { ...editor, text: `${editor.text}\n` } };
  if (saves) {
    if (!editor.text.trim()) return { ...state, editor: null };
    return withError({ ...state, editor: null }, () => {
      if (editor.index !== undefined) {
        editEntry(journal, state.isoDay, editor.index, editor.text);
        return 'Modifié.';
      }
      addEntry(journal, state.isoDay, editor.kind, editor.text);
      return ADDED_MESSAGES[editor.kind];
    });
  }
  // Pasted text arrives in one chunk: line breaks inside it are kept in a long entry.
  if (isText(pressedKey)) {
    const typed = editor.multiline ? pressedKey.replace(/\r\n?/g, '\n') : pressedKey.replace(/[\r\n]+/g, ' ');
    return { ...state, editor: { ...editor, text: editor.text + typed } };
  }
  return state;
}

function handleDayKey(state, pressedKey, journal) {
  const viewRow = state.rows[state.selected];
  const lower = pressedKey.toLowerCase();
  if (KIND_KEYS[lower]) {
    const kind = KIND_KEYS[lower];
    return { ...state, editor: { kind, title: NEW_TITLES[kind], text: '', multiline: kind === 'note' } };
  }
  if (pressedKey === 'left' || pressedKey === 'right') return { ...state, isoDay: addDays(state.isoDay, pressedKey === 'left' ? -1 : 1), selected: 0 };
  if (!viewRow) return state;
  const entry = journal.entriesOf(state.isoDay)[viewRow.index];
  if (pressedKey === 'enter') return { ...state, editor: { index: viewRow.index, title: `Lire et modifier ${KIND_NAMES[entry.kind]}`, text: fullText(entry), multiline: true } };
  if (pressedKey === ' ') {
    const toggled = toggleDone(journal, state.isoDay, viewRow.index);
    return { ...state, message: toggled ? (toggled.kind === 'done' ? `Faite : ${toggled.text}` : `Rouverte : ${toggled.text}`) : 'Seule une tâche se coche.' };
  }
  if (pressedKey === '!') return { ...state, message: togglePriority(journal, state.isoDay, viewRow.index) ? 'Priorité changée.' : 'Seule une tâche ouverte peut être prioritaire.' };
  if (lower === 'a') return withError(state, () => `Abandonnée : ${setTaskKind(journal, state.isoDay, viewRow.index, 'cancelled').text}`);
  if (lower === 'r') return withError(state, () => `Reportée à demain : ${postpone(journal, state.isoDay, viewRow.index).entry.text}`);
  return state;
}

function handleSearchKey(state, pressedKey) {
  const viewRow = state.rows[state.selected];
  if (pressedKey === 'escape') return { ...state, view: 'day', query: '' };
  if (pressedKey === 'backspace') return { ...state, query: [...state.query].slice(0, -1).join('') };
  if (pressedKey === 'enter' && viewRow && viewRow.isoDay) return { ...state, view: 'day', isoDay: viewRow.isoDay, selected: 0, query: '' };
  if (isText(pressedKey)) return { ...state, query: state.query + pressedKey.replace(/[\r\n]+/g, ' ') };
  return state;
}

/** Applies a key; returns the new state, or null to quit. */
export function handleKey(state, pressedKey, journal) {
  const named = KEYS[pressedKey] || pressedKey;
  let next = { ...state, message: '' };
  if (named === 'quit') return null;
  if (state.editor) next = handleEditorKey(next, named, journal);
  else if (named === 'tab' || named === 'shift-tab') next = switchView(next, named === 'tab' ? 1 : -1);
  else if (named === 'up' || named === 'down') next = moveSelection(next, named === 'up' ? -1 : 1);
  else if (state.view === 'search') next = handleSearchKey(next, named);
  else if (named === 'q' || named === 'Q' || named === 'escape') return null;
  else if (state.view === 'day') next = handleDayKey(next, named, journal);
  else if (named === 'enter' && state.rows[state.selected]) next = { ...next, view: 'day', isoDay: state.rows[state.selected].isoDay, selected: 0 };
  else if (state.view === 'week' && (named === 'left' || named === 'right')) next = { ...next, isoDay: addDays(state.isoDay, named === 'left' ? -7 : 7) };
  else if (state.view === 'month' && (named === 'm' || named === 'M')) {
    const moved = migrateOpenTasks(journal, today());
    next = { ...next, message: moved.length ? `${moved.length} tâche(s) reportée(s) à aujourd'hui.` : 'Aucune tâche ouverte les jours passés.' };
  }
  return refresh(next, journal);
}

/** Runs the interface in the terminal until the user quits. */
export function runScreen(journal, theme) {
  const { stdin, stdout } = process;
  let state = refresh(initialState(), journal);
  const draw = () => {
    const size = { width: Math.max(40, Math.min(stdout.columns || 80, 140)), height: Math.max(12, stdout.rows || 24) };
    stdout.write('\x1b[H' + render(state, size, theme).join('\x1b[K\n') + '\x1b[K\x1b[J');
  };
  const restore = () => {
    stdout.write('\x1b[0m\x1b[?25h\x1b[?1049l');
    if (stdin.isTTY) stdin.setRawMode(false);
    stdin.pause();
  };
  stdout.write('\x1b[?1049h\x1b[?25l');
  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  stdin.resume();
  stdout.on('resize', draw);
  stdin.on('data', (chunk) => {
    try {
      const next = handleKey(state, chunk, journal);
      if (!next) {
        restore();
        process.exit(0);
      }
      state = next;
      draw();
    } catch (error) {
      restore();
      console.error(`anais : ${error.message}`);
      process.exit(1);
    }
  });
  draw();
}
