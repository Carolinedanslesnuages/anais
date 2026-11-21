/**
 * The full-screen interface: state, keys and the main loop. The state logic (buildRows,
 * handleKey) is separate from the terminal, so it can be tested without one.
 */
import { addDays, today, weekStart, monthOf, dayLabel } from '../dates.mjs';
import { addEntry, toggleDone, togglePriority, postpone, migrateOpenTasks, setTaskKind, searchEntries } from '../actions.mjs';
import { render, VIEWS, entryText } from './render.mjs';

const INPUT_TITLES = { task: 'Nouvelle tâche', event: 'Nouvel événement', note: 'Nouvelle note' };
const ADDED_MESSAGES = { task: 'Tâche ajoutée.', event: 'Événement ajouté.', note: 'Note ajoutée.' };
const KEYS = { '\x1b[A': 'up', '\x1b[B': 'down', '\x1b[C': 'right', '\x1b[D': 'left', '\t': 'tab', '\x1b[Z': 'shift-tab', '\r': 'enter', '\n': 'enter', '\x7f': 'backspace', '\b': 'backspace', '\x1b': 'escape', '\x03': 'quit' };
const NAMED_KEYS = new Set(Object.values(KEYS));

/** A pressedKey that types text (not an arrow, Enter, Tab…). */
const isText = (pressedKey) => !NAMED_KEYS.has(pressedKey) && !pressedKey.startsWith('\x1b') && pressedKey >= ' ';

export const initialState = () => ({ view: 'day', isoDay: today(), selected: 0, rows: [], message: '', input: null, query: '' });

const shortDay = (isoDay) => dayLabel(isoDay).split(' ').slice(0, 2).join(' ');

/** Rows of the current view, from the journal. */
export function buildRows(state, journal) {
  if (state.view === 'day') {
    const rows = journal.entriesOf(state.isoDay).map((entry, index) => ({ text: entryText(entry), selectable: true, index, muted: ['done', 'migrated', 'cancelled'].includes(entry.kind) }));
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
  const results = searchEntries(journal, state.query);
  const rows = [{ text: `Chercher : ${state.query}▌`, selectable: false }, ...results.map(({ isoDay, entry }) => ({ text: `${shortDay(isoDay).padEnd(12)} ${entryText(entry)}`, selectable: true, isoDay }))];
  return { rows, emptyText: '' };
}

const clampSelection = (state) => {
  const selectable = state.rows.map((viewRow, index) => (viewRow.selectable ? index : -1)).filter((index) => index >= 0);
  if (!selectable.length) return { ...state, selected: 0 };
  return { ...state, selected: selectable.includes(state.selected) ? state.selected : selectable[0] };
};

const refresh = (state, journal) => clampSelection({ ...state, ...buildRows(state, journal) });

function moveSelection(state, step) {
  const selectable = state.rows.map((viewRow, index) => (viewRow.selectable ? index : -1)).filter((index) => index >= 0);
  if (!selectable.length) return state;
  const position = Math.max(0, selectable.indexOf(state.selected));
  return { ...state, selected: selectable[Math.min(selectable.length - 1, Math.max(0, position + step))] };
}

function switchView(state, step) {
  const position = VIEWS.findIndex(([view]) => view === state.view);
  const [view] = VIEWS[(position + step + VIEWS.length) % VIEWS.length];
  return { ...state, view, selected: 0, query: view === 'search' ? state.query : '' };
}

function handleInputKey(state, pressedKey, journal) {
  if (pressedKey === 'escape') return { ...state, input: null, message: 'Annulé.' };
  if (pressedKey === 'backspace') return { ...state, input: { ...state.input, text: [...state.input.text].slice(0, -1).join('') } };
  if (pressedKey === 'enter') {
    if (!state.input.text.trim()) return { ...state, input: null };
    const { number } = addEntry(journal, state.isoDay, state.input.kind, state.input.text);
    return { ...state, input: null, selected: number - 1, message: ADDED_MESSAGES[state.input.kind] };
  }
  if (isText(pressedKey)) return { ...state, input: { ...state.input, text: state.input.text + pressedKey } };
  return state;
}

function handleDayKey(state, pressedKey, journal) {
  const viewRow = state.rows[state.selected];
  const lower = pressedKey.toLowerCase();
  if (KIND_KEYS[lower]) return { ...state, input: { kind: KIND_KEYS[lower], title: INPUT_TITLES[KIND_KEYS[lower]], text: '' } };
  if (pressedKey === 'left' || pressedKey === 'right') return { ...state, isoDay: addDays(state.isoDay, pressedKey === 'left' ? -1 : 1), selected: 0 };
  if (!viewRow) return state;
  if (pressedKey === ' ') {
    const entry = toggleDone(journal, state.isoDay, viewRow.index);
    return { ...state, message: entry ? (entry.kind === 'done' ? `Faite : ${entry.text}` : `Rouverte : ${entry.text}`) : 'Seule une tâche se coche.' };
  }
  if (pressedKey === '!') return { ...state, message: togglePriority(journal, state.isoDay, viewRow.index) ? 'Priorité changée.' : 'Seule une tâche ouverte peut être prioritaire.' };
  if (lower === 'a') return withError(state, () => `Abandonnée : ${setTaskKind(journal, state.isoDay, viewRow.index, 'cancelled').text}`);
  if (lower === 'r') return withError(state, () => `Reportée à demain : ${postpone(journal, state.isoDay, viewRow.index).entry.text}`);
  return state;
}

const KIND_KEYS = { t: 'task', e: 'event', n: 'note' };

function withError(state, action) {
  try {
    return { ...state, message: action() };
  } catch (error) {
    return { ...state, message: error.message };
  }
}

/** Applies a pressedKey; returns the new state, or null to quit. */
export function handleKey(state, pressedKey, journal) {
  const named = KEYS[pressedKey] || pressedKey;
  let next = { ...state, message: '' };
  if (named === 'quit') return null;
  if (state.input) next = handleInputKey(next, named, journal);
  else if (named === 'tab' || named === 'shift-tab') next = switchView(next, named === 'tab' ? 1 : -1);
  else if (named === 'up' || named === 'down') next = moveSelection(next, named === 'up' ? -1 : 1);
  else if (state.view === 'search') {
    if (named === 'escape') next = { ...next, view: 'day', query: '' };
    else if (named === 'backspace') next = { ...next, query: [...next.query].slice(0, -1).join('') };
    else if (named === 'enter' && state.rows[state.selected] && state.rows[state.selected].isoDay) next = { ...next, view: 'day', isoDay: state.rows[state.selected].isoDay, selected: 0, query: '' };
    else if (isText(named)) next = { ...next, query: next.query + named };
  } else if (named === 'q' || named === 'Q' || named === 'escape') return null;
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
export function runScreen(journal) {
  const { stdin, stdout } = process;
  let state = refresh(initialState(), journal);
  const draw = () => {
    const lines = render(state, { width: Math.max(40, Math.min(stdout.columns || 80, 100)), height: Math.max(12, stdout.rows || 24) });
    stdout.write('\x1b[H' + lines.join('\x1b[K\n') + '\x1b[K\x1b[J');
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
