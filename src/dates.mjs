/** Local calendar dates as "YYYY-MM-DD" strings, with French labels for display. */
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const twoDigits = (number) => String(number).padStart(2, '0');

export function isoDate(date) {
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

/** Today, or the date given by ANAIS_DATE (used by the tests). */
export function today() {
  return process.env.ANAIS_DATE || isoDate(new Date());
}

export function parseIsoDate(text) {
  const [year, month, isoDay] = text.split('-').map(Number);
  return new Date(year, month - 1, isoDay);
}

export function addDays(isoDay, count) {
  const date = parseIsoDate(isoDay);
  date.setDate(date.getDate() + count);
  return isoDate(date);
}

/** "samedi 21 novembre" */
export function dayLabel(isoDay) {
  const date = parseIsoDate(isoDay);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Monday of the day's week. */
export function weekStart(isoDay) {
  const date = parseIsoDate(isoDay);
  return addDays(isoDay, -((date.getDay() + 6) % 7));
}

export const monthOf = (isoDay) => isoDay.slice(0, 7);
