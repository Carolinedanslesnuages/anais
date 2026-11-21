/** Journal operations shared by the commands and the full-screen interface. */
import { addDays, today } from './dates.mjs';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Adds an entry to a day; returns it with its number on the page. */
export function addEntry(journal, isoDay, kind, text, priority = false) {
  const cleaned = String(text).trim();
  if (!cleaned) throw new Error('Que faut-il noter ? Exemple : anais t appeler la banque');
  const entries = journal.entriesOf(isoDay);
  entries.push({ kind, text: cleaned, priority: kind === 'task' && priority });
  journal.saveDay(isoDay, entries);
  return { entry: entries[entries.length - 1], number: entries.length };
}

function entryAt(entries, index) {
  const entry = entries[index];
  if (!entry) throw new Error(`Pas d'élément n° ${index + 1} ce jour-là. Tapez « anais » pour voir la page.`);
  return entry;
}

/** Marks the task at `index` (0-based) done, cancelled… Only open tasks can change. */
export function setTaskKind(journal, isoDay, index, kind) {
  const entries = journal.entriesOf(isoDay);
  const entry = entryAt(entries, index);
  if (entry.kind !== 'task') throw new Error(`L'élément n° ${index + 1} n'est pas une tâche ouverte.`);
  entry.kind = kind;
  journal.saveDay(isoDay, entries);
  return entry;
}

/** Space in the interface: an open task becomes done, a done task opens again. */
export function toggleDone(journal, isoDay, index) {
  const entries = journal.entriesOf(isoDay);
  const entry = entryAt(entries, index);
  if (entry.kind !== 'task' && entry.kind !== 'done') return null;
  entry.kind = entry.kind === 'task' ? 'done' : 'task';
  journal.saveDay(isoDay, entries);
  return entry;
}

export function togglePriority(journal, isoDay, index) {
  const entries = journal.entriesOf(isoDay);
  const entry = entryAt(entries, index);
  if (entry.kind !== 'task') return null;
  entry.priority = !entry.priority;
  journal.saveDay(isoDay, entries);
  return entry;
}

/** Moves an open task to a later day (tomorrow by default): ">" here, "•" there. */
export function postpone(journal, isoDay, index, target = 'demain') {
  const targetDay = target === 'demain' ? addDays(isoDay, 1) : target;
  if (!ISO_DAY.test(targetDay) || targetDay <= isoDay) throw new Error('Reporter à « demain » ou à un jour futur AAAA-MM-JJ.');
  const entry = setTaskKind(journal, isoDay, index, 'migrated');
  journal.saveDay(targetDay, [...journal.entriesOf(targetDay), { kind: 'task', text: entry.text, priority: entry.priority }]);
  return { entry, targetDay };
}

/** Moves every task still open on a past day to today. Returns the moved tasks with their origin. */
export function migrateOpenTasks(journal, isoDay = today()) {
  const moved = [];
  for (const pastDay of journal.allDays().filter((candidate) => candidate < isoDay)) {
    const entries = journal.entriesOf(pastDay);
    const open = entries.filter((entry) => entry.kind === 'task');
    if (!open.length) continue;
    for (const entry of open) {
      entry.kind = 'migrated';
      moved.push({ text: entry.text, priority: entry.priority, from: pastDay });
    }
    journal.saveDay(pastDay, entries);
  }
  if (moved.length) {
    journal.saveDay(isoDay, [...journal.entriesOf(isoDay), ...moved.map(({ text, priority }) => ({ kind: 'task', text, priority }))]);
  }
  return moved;
}

const withoutAccents = (text) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Entries matching every word, in the whole journal: [{ isoDay, index, entry }]. */
export function searchEntries(journal, query) {
  const terms = withoutAccents(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return journal.allDays().flatMap((isoDay) => journal.entriesOf(isoDay)
    .map((entry, index) => ({ isoDay, index, entry }))
    .filter(({ entry }) => terms.every((term) => withoutAccents(entry.text).includes(term))));
}
