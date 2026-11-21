/**
 * The full-screen interface: state, keys and the main loop. The state logic (buildRows,
 * handleKey) is separate from the terminal, so it can be tested without one.
 */
import { addDays, today } from '../dates.mjs';
import { fullText } from '../journal.mjs';
import { addEntry, editEntry, toggleDone, togglePriority, postpone, migrateOpenTasks, setTaskKind, setMood, answerEvening } from '../actions.mjs';
import { memoriesOf } from '../memories.mjs';
import { render, VIEWS } from './render.mjs';
import { buildRows, eveningTitle } from './views.mjs';
import { companionMood, allTasksDone, PARTY_FRAMES, PARTY_STEP_MS } from './cloud.mjs';
import { addHabit, toggleHabit } from '../habits.mjs';
import { saveCollection, addToCollection, toggleCollectionItem, findCollection } from '../collections.mjs';

export { buildRows };

const KEYS = {
  '\x1b[A': 'up', '\x1b[B': 'down', '\x1b[C': 'right', '\x1b[D': 'left', '\t': 'tab', '\x1b[Z': 'shift-tab',
  '\r': 'enter', '\n': 'enter', '\x7f': 'backspace', '\b': 'backspace', '\x1b': 'escape', '\x03': 'quit', '\x13': 'save', '\x04': 'save',
};
const NAMED_KEYS = new Set(Object.values(KEYS));
const NEW_TITLES = { task: 'Nouvelle tâche', event: 'Nouvel événement', note: 'Nouvelle note' };
const ADDED_MESSAGES = { task: 'Tâche ajoutée.', event: 'Événement ajouté.', note: 'Note ajoutée.' };
const KIND_NAMES = { task: 'la tâche', done: 'la tâche', migrated: 'la tâche', cancelled: 'la tâche', event: 'l’événement', note: 'la note' };
const KIND_KEYS = { t: 'task', e: 'event', n: 'note' };

/** A key that types text (not an arrow, Enter, Tab…). */
const isText = (pressedKey) => !NAMED_KEYS.has(pressedKey) && !pressedKey.startsWith('\x1b') && pressedKey >= ' ';

export const initialState = () => ({ collection: null, view: 'day', isoDay: today(), selected: 0, rows: [], message: '', editor: null, query: '', showHelp: false, justTicked: false, partyFrame: null });

/** The current hour (ANAIS_HEURE in the tests). */
const currentHour = () => (process.env.ANAIS_HEURE !== undefined ? Number(process.env.ANAIS_HEURE) : new Date().getHours());

const selectableIndexes = (rows) => rows.map((viewRow, index) => (viewRow.selectable ? index : -1)).filter((index) => index >= 0);

function clampSelection(state) {
  const selectable = selectableIndexes(state.rows);
  if (!selectable.length) return { ...state, selected: 0 };
  return { ...state, selected: selectable.includes(state.selected) ? state.selected : selectable[0] };
}

function refresh(state, journal) {
  const page = journal.pageOf(state.isoDay);
  const companion = companionMood({ page, hour: currentHour(), justTicked: state.justTicked, partyFrame: state.partyFrame });
  return clampSelection({ ...state, ...buildRows(state, journal), companion, moodEmoji: page.mood ? page.mood.emoji : '' });
}

function moveSelection(state, step) {
  const selectable = selectableIndexes(state.rows);
  if (!selectable.length) return state;
  const position = Math.max(0, selectable.indexOf(state.selected));
  return { ...state, selected: selectable[Math.min(selectable.length - 1, Math.max(0, position + step))] };
}

function switchView(state, step) {
  const position = VIEWS.findIndex(([view]) => view === state.view);
  const [view] = VIEWS[(position + step + VIEWS.length) % VIEWS.length];
  return { ...state, view, selected: 0, query: view === 'search' ? state.query : '', collection: null };
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
      if (editor.habit) return `Habitude ajoutée : ${addHabit(journal, editor.text)}`;
      if (editor.newCollection) {
        if (findCollection(journal, editor.text)) throw new Error(`La collection « ${editor.text.trim()} » existe déjà.`);
        saveCollection(journal, { title: editor.text.trim(), items: [] });
        return `Collection créée : ${editor.text.trim()}`;
      }
      if (editor.collectionSlug) {
        addToCollection(journal, editor.collectionTitle, editor.text);
        return 'Ajouté.';
      }
      if (editor.evening) {
        answerEvening(journal, state.isoDay, editor.text);
        return 'Réponse du soir notée.';
      }
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
  if (lower === 'h') return { ...state, view: 'moods', selected: 0 };
  if (lower === 's') {
    const page = journal.pageOf(state.isoDay);
    return { ...state, editor: { evening: true, title: eveningTitle(journal, state.isoDay), text: page.evening ? page.evening.answer : '', multiline: false } };
  }
  if (!viewRow) return state;
  const entry = journal.entriesOf(state.isoDay)[viewRow.index];
  if (pressedKey === 'enter') return { ...state, editor: { index: viewRow.index, title: `Lire et modifier ${KIND_NAMES[entry.kind]}`, text: fullText(entry), multiline: true } };
  if (pressedKey === ' ') {
    const toggled = toggleDone(journal, state.isoDay, viewRow.index);
    if (!toggled) return { ...state, message: 'Seule une tâche se coche.' };
    if (toggled.kind !== 'done') return { ...state, message: `Rouverte : ${toggled.text}` };
    const party = allTasksDone(journal.pageOf(state.isoDay));
    return { ...state, justTicked: true, partyFrame: party ? 0 : null, message: party ? 'Tout est fait pour aujourd’hui ✦' : `Faite : ${toggled.text}` };
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

function handleMoodKey(state, pressedKey, journal) {
  const viewRow = state.rows[state.selected];
  if (pressedKey === 'escape' || pressedKey === 'q' || pressedKey === 'Q') return { ...state, view: 'day', selected: 0 };
  if (pressedKey !== 'enter' || !viewRow) return state;
  setMood(journal, state.isoDay, viewRow.mood);
  return { ...state, view: 'day', selected: 0, message: viewRow.mood ? `Humeur : ${viewRow.mood.emoji} ${viewRow.mood.name}` : 'Humeur retirée.' };
}

function handleHabitKey(state, pressedKey, journal) {
  const viewRow = state.rows[state.selected];
  if (pressedKey.toLowerCase() === 'a') return { ...state, editor: { habit: true, title: 'Nouvelle habitude', text: '', multiline: false } };
  if (pressedKey === 'left' || pressedKey === 'right') return { ...state, isoDay: addDays(state.isoDay, pressedKey === 'left' ? -1 : 1) };
  if (pressedKey === ' ' && viewRow) {
    const done = toggleHabit(journal, state.isoDay, viewRow.habit);
    return { ...state, justTicked: done, message: done ? `Fait : ${viewRow.habit}` : `Décoché : ${viewRow.habit}` };
  }
  return state;
}

function handleCollectionKey(state, pressedKey, journal) {
  const viewRow = state.rows[state.selected];
  const lower = pressedKey.toLowerCase();
  if (!state.collection) {
    if (lower === 'n') return { ...state, editor: { newCollection: true, title: 'Nouvelle collection', text: '', multiline: false } };
    if (pressedKey === 'enter' && viewRow) return { ...state, collection: viewRow.slug, selected: 0 };
    return state;
  }
  if (pressedKey === 'escape') return { ...state, collection: null, selected: 0 };
  if (lower === 't') {
    const title = state.rows[0] ? state.rows[0].text : '';
    return { ...state, editor: { collectionSlug: state.collection, collectionTitle: title, title: `Ajouter à « ${title} »`, text: '', multiline: false } };
  }
  if (pressedKey === ' ' && viewRow) {
    const item = toggleCollectionItem(journal, state.collection, viewRow.itemIndex);
    return item ? { ...state, justTicked: item.done, message: item.done ? `Fait : ${item.text}` : `Rouvert : ${item.text}` } : state;
  }
  return state;
}

/** Applies a key; returns the new state, or null to quit. */
export function handleKey(state, pressedKey, journal) {
  const named = KEYS[pressedKey] || pressedKey;
  let next = { ...state, message: '', justTicked: false, partyFrame: null, showHelp: false };
  if (named === 'quit') return null;
  if (state.showHelp) return refresh(next, journal);
  if (state.editor) next = handleEditorKey(next, named, journal);
  else if (state.view === 'moods') next = state.rows.length && (named === 'up' || named === 'down') ? moveSelection(next, named === 'up' ? -1 : 1) : handleMoodKey(next, named, journal);
  else if (named === '?') next = { ...next, showHelp: true };
  else if (named === 'tab' || named === 'shift-tab') next = switchView(next, named === 'tab' ? 1 : -1);
  else if (named === 'up' || named === 'down') next = moveSelection(next, named === 'up' ? -1 : 1);
  else if (state.view === 'search') next = handleSearchKey(next, named);
  else if (state.view === 'collections' && state.collection && named === 'escape') next = handleCollectionKey(next, named, journal);
  else if (named === 'q' || named === 'Q' || named === 'escape') return null;
  else if (state.view === 'habits') next = handleHabitKey(next, named, journal);
  else if (state.view === 'collections') next = handleCollectionKey(next, named, journal);
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
/** `animations: false` keeps the party still (one frame, no movement). */
export function runScreen(journal, theme, { animations = true } = {}) {
  const { stdin, stdout } = process;
  const memories = memoriesOf(journal, today());
  const memoryMessage = memories.length ? `${memories[0].label} : ${memories[0].mood ? `${memories[0].mood.emoji} ` : ''}${memories[0].firstLine}` : '';
  let state = refresh({ ...initialState(), message: memoryMessage }, journal);
  let partyTimer = null;
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
      if (state.partyFrame === 0 && animations && !partyTimer) {
        partyTimer = setInterval(() => {
          const frame = state.partyFrame === null ? PARTY_FRAMES : state.partyFrame + 1;
          state = refresh({ ...state, partyFrame: frame < PARTY_FRAMES ? frame : null }, journal);
          draw();
          if (state.partyFrame === null) {
            clearInterval(partyTimer);
            partyTimer = null;
          }
        }, PARTY_STEP_MS);
      }
    } catch (error) {
      restore();
      console.error(`anais : ${error.message}`);
      process.exit(1);
    }
  });
  draw();
}
