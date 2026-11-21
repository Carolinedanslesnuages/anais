#!/usr/bin/env node
/** Anaïs: a bullet journal in the terminal. */
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openJournal } from '../src/journal.mjs';
import { today, addDays, weekStart, monthOf, dayLabel } from '../src/dates.mjs';
import { dayBlock, entryLine, pink, muted } from '../src/display.mjs';

const HELP = `Anaïs · ton bullet journal dans le terminal

  anais                      la page du jour
  anais t <texte>            ajoute une tâche          •   (anais t ! <texte> : prioritaire)
  anais e <texte>            ajoute un événement       ○
  anais n <texte>            ajoute une note           –
  anais fait <n>             tâche faite               ×
  anais annule <n>           tâche abandonnée          ~
  anais reporte <n> [jour]   reporte à demain (ou à un jour AAAA-MM-JJ)  >
  anais migrer               reporte à aujourd'hui les tâches restées ouvertes
  anais hier · demain · <AAAA-MM-JJ>   une autre page
  anais semaine · mois       la semaine, le mois
  anais chercher <mots>      dans tout le journal
  anais dossier              où est rangé le journal

Le journal est fait de fichiers Markdown (un par mois), dans ~/.anais ou ANAIS_DOSSIER :
il se lit et se modifie aussi à la main.`;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const KIND_OF_COMMAND = { t: 'task', tache: 'task', e: 'event', evenement: 'event', n: 'note', note: 'note' };
const ADDED_LABEL = { task: 'Tâche ajoutée', event: 'Événement ajouté', note: 'Note ajoutée' };

const journal = openJournal(process.env.ANAIS_DOSSIER || join(homedir(), '.anais'));
const withoutAccents = (text) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function showDay(isoDay) {
  console.log(dayBlock(isoDay, journal.entriesOf(isoDay), { isToday: isoDay === today() }));
}

function addEntry(kind, words) {
  const priority = words[0] === '!';
  const text = (priority ? words.slice(1) : words).join(' ').trim();
  if (!text) throw new Error('Que faut-il noter ? Exemple : anais t appeler la banque');
  const isoDay = today();
  const entries = journal.entriesOf(isoDay);
  entries.push({ kind, text, priority: kind === 'task' && priority });
  journal.saveDay(isoDay, entries);
  console.log(`${ADDED_LABEL[kind]} :\n${entryLine(entries[entries.length - 1], entries.length)}`);
}

/** The task numbered n on today's page. */
function taskAt(entries, numberText) {
  const index = Number(numberText) - 1;
  const entry = entries[index];
  if (!entry) throw new Error(`Pas d'élément n° ${numberText} aujourd'hui. Tapez « anais » pour voir la page.`);
  if (entry.kind !== 'task') throw new Error(`L'élément n° ${numberText} n'est pas une tâche ouverte.`);
  return entry;
}

function changeTask(numberText, newKind, message) {
  const isoDay = today();
  const entries = journal.entriesOf(isoDay);
  const entry = taskAt(entries, numberText);
  entry.kind = newKind;
  journal.saveDay(isoDay, entries);
  console.log(`${message} : ${entry.text}`);
}

function postpone(numberText, target = 'demain') {
  const isoDay = today();
  const targetDay = target === 'demain' ? addDays(isoDay, 1) : target;
  if (!ISO_DAY.test(targetDay) || targetDay <= isoDay) throw new Error('Reporter à « demain » ou à un jour futur AAAA-MM-JJ.');
  const entries = journal.entriesOf(isoDay);
  const entry = taskAt(entries, numberText);
  entry.kind = 'migrated';
  journal.saveDay(isoDay, entries);
  journal.saveDay(targetDay, [...journal.entriesOf(targetDay), { kind: 'task', text: entry.text, priority: entry.priority }]);
  console.log(`Reportée au ${dayLabel(targetDay)} : ${entry.text}`);
}

function migrate() {
  const isoDay = today();
  const moved = [];
  for (const pastDay of journal.allDays().filter((candidate) => candidate < isoDay)) {
    const entries = journal.entriesOf(pastDay);
    const open = entries.filter((entry) => entry.kind === 'task');
    if (!open.length) continue;
    for (const entry of open) {
      entry.kind = 'migrated';
      moved.push({ kind: 'task', text: entry.text, priority: entry.priority, from: pastDay });
    }
    journal.saveDay(pastDay, entries);
  }
  if (!moved.length) return console.log('Aucune tâche ouverte les jours précédents.');
  journal.saveDay(isoDay, [...journal.entriesOf(isoDay), ...moved.map(({ from, ...entry }) => entry)]);
  console.log(`${moved.length} tâche${moved.length > 1 ? 's' : ''} reportée${moved.length > 1 ? 's' : ''} à aujourd'hui :`);
  for (const entry of moved) console.log(`   ${pink('>')} ${entry.text} ${muted(`(${dayLabel(entry.from)})`)}`);
}

function showRange(firstDay, dayCount) {
  const blocks = [];
  for (let offset = 0; offset < dayCount; offset++) {
    const isoDay = addDays(firstDay, offset);
    const entries = journal.entriesOf(isoDay);
    if (entries.length || isoDay === today()) blocks.push(dayBlock(isoDay, entries, { isToday: isoDay === today() }));
  }
  console.log(blocks.length ? blocks.join('\n\n') : muted('Rien de noté sur cette période.'));
}

function showMonth() {
  const month = monthOf(today());
  const days = journal.allDays().filter((isoDay) => isoDay.startsWith(month));
  if (!days.length) return console.log(muted('Rien de noté ce mois-ci.'));
  let openTasks = 0;
  for (const isoDay of days) {
    const entries = journal.entriesOf(isoDay);
    const done = entries.filter((entry) => entry.kind === 'done').length;
    const open = entries.filter((entry) => entry.kind === 'task').length;
    if (isoDay < today()) openTasks += open;
    const events = entries.filter((entry) => entry.kind === 'event').map((entry) => entry.text);
    console.log(`${pink(isoDay.slice(8))} ${muted(dayLabel(isoDay).split(' ')[0].slice(0, 3))}  ${done} ×  ${open} •${events.length ? `  ○ ${events.join(' · ')}` : ''}`);
  }
  if (openTasks) console.log(muted(`\n${openTasks} tâche(s) restée(s) ouverte(s) les jours passés : « anais migrer » les reporte à aujourd'hui.`));
}

function search(words) {
  const terms = withoutAccents(words.join(' ')).split(/\s+/).filter(Boolean);
  if (!terms.length) throw new Error('Que faut-il chercher ? Exemple : anais chercher banque');
  let found = 0;
  for (const isoDay of journal.allDays()) {
    journal.entriesOf(isoDay).forEach((entry, index) => {
      if (!terms.every((term) => withoutAccents(entry.text).includes(term))) return;
      if (!found) console.log(pink(`Pour « ${words.join(' ')} » :`));
      found++;
      console.log(`${muted(isoDay)} ${entryLine(entry, index + 1)}`);
    });
  }
  if (!found) console.log(muted(`Rien trouvé pour « ${words.join(' ')} ».`));
}

function main() {
  const [command, ...words] = process.argv.slice(2);
  if (!command) return showDay(today());
  if (KIND_OF_COMMAND[command]) return addEntry(KIND_OF_COMMAND[command], words);
  if (ISO_DAY.test(command)) return showDay(command);
  switch (command) {
    case 'aide': case '--aide': case '-h': case '--help': return console.log(HELP);
    case 'hier': return showDay(addDays(today(), -1));
    case 'demain': return showDay(addDays(today(), 1));
    case 'fait': return changeTask(words[0], 'done', 'Faite');
    case 'annule': return changeTask(words[0], 'cancelled', 'Abandonnée');
    case 'reporte': return postpone(words[0], words[1]);
    case 'migrer': return migrate();
    case 'semaine': return showRange(weekStart(today()), 7);
    case 'mois': return showMonth();
    case 'chercher': return search(words);
    case 'dossier': return console.log(journal.folder);
    default: throw new Error(`Commande inconnue : ${command}. Tapez « anais aide ».`);
  }
}

try {
  main();
} catch (error) {
  console.error(`anais : ${error.message}`);
  process.exit(1);
}
