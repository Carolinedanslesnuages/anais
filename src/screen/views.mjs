/**
 * Rows of each view, built from the journal. A row: { text, selectable, muted?, detail?, … };
 * `detail` fills the side panel ({ heading, text } or { heading, lines }).
 */
import { addDays, weekStart, monthOf, dayLabel, parseIsoDate, MONTHS } from '../dates.mjs';
import { fullText } from '../journal.mjs';
import { searchEntries } from '../actions.mjs';
import { MOODS } from '../moods.mjs';
import { questionOf } from '../evening.mjs';
import { entryText } from './render.mjs';
import { fitWidth } from '../text-width.mjs';
import { habitNames, monthGrid, streakOf } from '../habits.mjs';
import { listCollections } from '../collections.mjs';

const KIND_LABELS = { task: 'Tâche', done: 'Tâche faite', migrated: 'Tâche reportée', cancelled: 'Tâche abandonnée', event: 'Événement', note: 'Note' };
const detailHeading = (entry) => `${KIND_LABELS[entry.kind]}${entry.priority ? ' · prioritaire' : ''}`;
const shortDay = (isoDay) => dayLabel(isoDay).split(' ').slice(0, 2).join(' ');
const moodText = (mood) => (mood ? `${mood.emoji} ${mood.name}`.trim() : '');

function dayRows(state, journal) {
  const page = journal.pageOf(state.isoDay);
  const rows = [];
  if (page.mood) rows.push({ text: `humeur : ${moodText(page.mood)}`, selectable: false, muted: true });
  if (page.evening && page.evening.answer) rows.push({ text: `soir : ${page.evening.answer}`, selectable: false, muted: true });
  page.entries.forEach((entry, index) => rows.push({
    text: entryText(entry),
    selectable: true,
    index,
    muted: ['done', 'migrated', 'cancelled'].includes(entry.kind),
    detail: { heading: detailHeading(entry), text: fullText(entry) },
  }));
  return { rows, emptyText: 'Rien pour l’instant. T pour une tâche, E pour un événement, N pour une note.' };
}

function weekRows(state, journal) {
  const firstDay = weekStart(state.isoDay);
  const rows = Array.from({ length: 7 }, (unused, offset) => {
    const isoDay = addDays(firstDay, offset);
    const page = journal.pageOf(isoDay);
    const open = page.entries.filter((entry) => entry.kind === 'task').length;
    const events = page.entries.filter((entry) => entry.kind === 'event').map((entry) => entry.text);
    const mood = page.mood ? page.mood.emoji : '  ';
    return { text: `${mood} ${shortDay(isoDay).padEnd(12)} ${open} •  ${events.length ? `○ ${events.join(' · ')}` : ''}`, selectable: true, isoDay, muted: !page.entries.length && !page.mood };
  });
  return { rows, emptyText: '' };
}

/** The month as a calendar, one mood per day (Monday first). */
export function moodCalendar(journal, month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const dayCount = new Date(year, monthNumber, 0).getDate();
  const offset = (parseIsoDate(`${month}-01`).getDay() + 6) % 7;
  const lines = [' L  M  M  J  V  S  D'];
  let line = '   '.repeat(offset);
  for (let dayNumber = 1; dayNumber <= dayCount; dayNumber++) {
    const page = journal.pageOf(`${month}-${String(dayNumber).padStart(2, '0')}`);
    line += page.mood ? ` ${page.mood.emoji}` : fitWidth(String(dayNumber).padStart(3), 3);
    if ((offset + dayNumber) % 7 === 0 || dayNumber === dayCount) {
      lines.push(line);
      line = '';
    }
  }
  return lines;
}

function monthRows(state, journal) {
  const month = monthOf(state.isoDay);
  const [year, monthNumber] = month.split('-').map(Number);
  const calendar = { heading: `Humeurs de ${MONTHS[monthNumber - 1]} ${year}`, lines: moodCalendar(journal, month) };
  const days = journal.allDays().filter((isoDay) => isoDay.startsWith(month));
  const rows = days.map((isoDay) => {
    const page = journal.pageOf(isoDay);
    const count = (kind) => page.entries.filter((entry) => entry.kind === kind).length;
    const mood = page.mood ? page.mood.emoji : '  ';
    return { text: `${mood} ${shortDay(isoDay).padEnd(12)} ${count('done')} ×  ${count('task')} •  ${count('event')} ○`, selectable: true, isoDay, detail: calendar };
  });
  return { rows, emptyText: 'Rien de noté ce mois-ci.', panelDetail: calendar };
}

function searchRows(state, journal) {
  const results = searchEntries(journal, state.query).map(({ isoDay, entry }) => ({
    text: `${shortDay(isoDay).padEnd(12)} ${entryText(entry)}`,
    selectable: true,
    isoDay,
    detail: { heading: `${dayLabel(isoDay)} · ${detailHeading(entry)}`, text: fullText(entry) },
  }));
  return { rows: [{ text: `Chercher : ${state.query}▌`, selectable: false }, ...results], emptyText: '' };
}

/** The mood picker: the twelve moods, and a line to remove the mood. */
function moodPickerRows(state, journal) {
  const current = journal.pageOf(state.isoDay).mood;
  const rows = MOODS.map((mood) => ({ text: `${mood.emoji} ${mood.name}${current && current.name === mood.name ? '   (actuelle)' : ''}`, selectable: true, mood }));
  rows.push({ text: '   pas d’humeur', selectable: true, mood: null });
  return { rows, emptyText: '' };
}

/** One row per habit: the month as squares, and the current series of days. */
function habitRows(state, journal) {
  const names = habitNames(journal);
  const width = Math.max(8, ...names.map((name) => name.length));
  const rows = names.map((name) => {
    const doneToday = journal.pageOf(state.isoDay).habits.includes(name);
    const streak = streakOf(journal, name, state.isoDay);
    return { text: `${doneToday ? '■' : '□'} ${name.padEnd(width)}  ${monthGrid(journal, name, state.isoDay)}  ${streak ? `${streak} j` : ''}`, selectable: true, habit: name };
  });
  return { rows, emptyText: 'Aucune habitude pour l’instant. A pour en ajouter une (eau, marche, lecture…).' };
}

/** The list of collections, or the items of the open one. */
function collectionRows(state, journal) {
  const collections = listCollections(journal);
  const open = state.collection && collections.find((collection) => collection.slug === state.collection);
  if (open) {
    const rows = open.items.map((item, itemIndex) => ({ text: `${item.done ? '×' : '•'} ${item.text}`, selectable: true, itemIndex, muted: item.done }));
    return { rows: [{ text: open.title, selectable: false }, ...rows], emptyText: '' };
  }
  const rows = collections.map((collection) => {
    const remaining = collection.items.filter((item) => !item.done).length;
    return { text: `${collection.title}  (${remaining} sur ${collection.items.length})`, selectable: true, slug: collection.slug };
  });
  return { rows, emptyText: 'Aucune collection. N pour en créer une (Livres à lire, Idées, Cadeaux…).' };
}

const BUILDERS = { day: dayRows, week: weekRows, month: monthRows, search: searchRows, moods: moodPickerRows, habits: habitRows, collections: collectionRows };

export function buildRows(state, journal) {
  return { panelDetail: null, ...BUILDERS[state.view](state, journal) };
}

export const eveningTitle = (journal, isoDay) => {
  const page = journal.pageOf(isoDay);
  return page.evening ? page.evening.question : questionOf(isoDay);
};
