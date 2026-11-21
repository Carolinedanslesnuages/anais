/** "Il y a un mois", "il y a un an": what was written on the same date before. */
import { parseIsoDate, isoDate } from './dates.mjs';
import { fullText } from './journal.mjs';

function sameDateBefore(isoDay, monthsBack) {
  const date = parseIsoDate(isoDay);
  const target = new Date(date.getFullYear(), date.getMonth() - monthsBack, date.getDate());
  // The 31st has no equivalent in a shorter month: no memory rather than a wrong date.
  return target.getDate() === date.getDate() ? isoDate(target) : null;
}

/** The memories of a day, newest first: [{ label, isoDay, mood, firstLine }]. */
export function memoriesOf(journal, isoDay) {
  const memories = [];
  for (const [monthsBack, label] of [[1, 'Il y a un mois'], [12, 'Il y a un an']]) {
    const pastDay = sameDateBefore(isoDay, monthsBack);
    if (!pastDay) continue;
    const page = journal.pageOf(pastDay);
    const firstEntry = page.entries.find((entry) => entry.kind !== 'migrated');
    if (!page.mood && !firstEntry) continue;
    memories.push({ label, isoDay: pastDay, mood: page.mood, firstLine: firstEntry ? fullText(firstEntry).split('\n')[0] : '' });
  }
  return memories;
}
