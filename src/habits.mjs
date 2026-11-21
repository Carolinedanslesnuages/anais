/**
 * Habits: their names are in reglages.json ("habitudes"), and each day's page lists the habits
 * done that day ("habitudes : eau, marche").
 */
import { readSettings, saveSetting } from './settings.mjs';
import { addDays, monthOf, parseIsoDate } from './dates.mjs';

export const habitNames = (journal) => readSettings(journal.folder).habitudes || [];

export function addHabit(journal, name) {
  const cleaned = String(name).trim().toLowerCase();
  if (!cleaned) throw new Error('Quelle habitude ? Exemple : anais habitudes ajouter eau');
  if (cleaned.includes(',')) throw new Error('Un nom d’habitude ne peut pas contenir de virgule.');
  const names = habitNames(journal);
  if (names.includes(cleaned)) throw new Error(`« ${cleaned} » est déjà une habitude.`);
  saveSetting(journal.folder, 'habitudes', [...names, cleaned]);
  return cleaned;
}

/** Removes a habit from the list. The days where it was done keep it in their page. */
export function removeHabit(journal, name) {
  const names = habitNames(journal);
  const cleaned = String(name).trim().toLowerCase();
  if (!names.includes(cleaned)) throw new Error(`« ${cleaned} » n’est pas une habitude. Habitudes : ${names.join(', ') || 'aucune'}.`);
  saveSetting(journal.folder, 'habitudes', names.filter((habit) => habit !== cleaned));
  return cleaned;
}

/** Ticks or unticks a habit on a day. Returns true when it is now done. */
export function toggleHabit(journal, isoDay, name) {
  const page = journal.pageOf(isoDay);
  const done = page.habits.includes(name);
  journal.savePage(isoDay, { ...page, habits: done ? page.habits.filter((habit) => habit !== name) : [...page.habits, name] });
  return !done;
}

/** Days in a row where the habit was done, ending today (or yesterday, if today is not done yet). */
export function streakOf(journal, name, isoDay) {
  let checkedDay = journal.pageOf(isoDay).habits.includes(name) ? isoDay : addDays(isoDay, -1);
  let count = 0;
  while (journal.pageOf(checkedDay).habits.includes(name)) {
    count++;
    checkedDay = addDays(checkedDay, -1);
  }
  return count;
}

/** One cell per day of the month: "■" done, "□" not done, '·' still to come. */
export function monthGrid(journal, name, isoDay) {
  const month = monthOf(isoDay);
  const date = parseIsoDate(isoDay);
  const dayCount = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  let grid = '';
  for (let dayNumber = 1; dayNumber <= dayCount; dayNumber++) {
    const gridDay = `${month}-${String(dayNumber).padStart(2, '0')}`;
    grid += gridDay > isoDay ? ' ' : journal.pageOf(gridDay).habits.includes(name) ? '■' : '·';
  }
  return grid;
}
