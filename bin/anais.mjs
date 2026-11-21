#!/usr/bin/env node
/** Anaïs: a bullet journal in the terminal. */
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openJournal } from '../src/journal.mjs';
import { today, addDays, weekStart, monthOf, dayLabel } from '../src/dates.mjs';
import { dayBlock, entryLine, pink, muted } from '../src/display.mjs';
import { runScreen } from '../src/screen/app.mjs';
import { THEMES, DEFAULT_THEME, themeNamed } from '../src/screen/themes.mjs';
import { readSettings, saveSetting } from '../src/settings.mjs';
import { MOODS, moodNamed } from '../src/moods.mjs';
import { questionOf } from '../src/evening.mjs';
import { memoriesOf } from '../src/memories.mjs';
import { addEntry, setTaskKind, postpone, migrateOpenTasks, searchEntries, setMood, answerEvening } from '../src/actions.mjs';

const HELP = `Anaïs · ton bullet journal dans le terminal

  anais                      l'écran du journal (↑↓, Espace, T, E, N, Entrée, Tab, Q)
  anais jour                 la page du jour, sans l'écran
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
  anais theme [nom]          les couleurs de l'écran : terminal (défaut), ambre, sauge
  anais humeur [nom]         l'humeur du jour (radieuse, sereine, fatiguée…)
  anais soir [réponse]       la question du soir, et ta réponse
  anais souvenirs            ce que tu notais il y a un mois, il y a un an
  anais animations oui|non   la petite fête du nuage

Le journal est fait de fichiers Markdown (un par mois), dans ~/.anais ou ANAIS_DOSSIER :
il se lit et se modifie aussi à la main.`;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const KIND_OF_COMMAND = { t: 'task', tache: 'task', e: 'event', evenement: 'event', n: 'note', note: 'note' };
const ADDED_LABEL = { task: 'Tâche ajoutée', event: 'Événement ajouté', note: 'Note ajoutée' };

const journal = openJournal(process.env.ANAIS_DOSSIER || join(homedir(), '.anais'));

function showDay(isoDay) {
  console.log(dayBlock(isoDay, journal.entriesOf(isoDay), { isToday: isoDay === today(), page: journal.pageOf(isoDay) }));
}

function addFromCommand(kind, words) {
  const priority = words[0] === '!';
  const { entry, number } = addEntry(journal, today(), kind, (priority ? words.slice(1) : words).join(' '), priority);
  console.log(`${ADDED_LABEL[kind]} :\n${entryLine(entry, number)}`);
}

function changeFromCommand(numberText, kind, message) {
  const entry = setTaskKind(journal, today(), Number(numberText) - 1, kind);
  console.log(`${message} : ${entry.text}`);
}

function postponeFromCommand(numberText, target) {
  const { entry, targetDay } = postpone(journal, today(), Number(numberText) - 1, target);
  console.log(`Reportée au ${dayLabel(targetDay)} : ${entry.text}`);
}

function currentThemeName() {
  return process.env.ANAIS_THEME || readSettings(journal.folder).theme || DEFAULT_THEME;
}

function chooseTheme(name) {
  const names = Object.keys(THEMES);
  if (!name) return console.log(`Thème : ${currentThemeName()}. Thèmes : ${names.join(', ')}.`);
  if (!THEMES[name]) throw new Error(`Thème inconnu : ${name}. Thèmes : ${names.join(', ')}.`);
  saveSetting(journal.folder, 'theme', name);
  console.log(`Thème « ${name} » choisi. Tapez « anais » pour le voir.`);
}

function chooseMood(words) {
  const wanted = words.join(' ');
  if (!wanted) {
    const current = journal.pageOf(today()).mood;
    console.log(current ? `Humeur du jour : ${current.emoji} ${current.name}` : 'Pas encore d’humeur aujourd’hui.');
    return console.log(`Humeurs : ${MOODS.map((mood) => `${mood.emoji} ${mood.name}`).join(' · ')}`);
  }
  if (wanted === 'aucune') return setMood(journal, today(), null) || console.log('Humeur retirée.');
  const mood = moodNamed(wanted);
  if (!mood) throw new Error(`Humeur inconnue : ${wanted}. Tapez « anais humeur » pour la liste.`);
  setMood(journal, today(), mood);
  console.log(`Humeur du jour : ${mood.emoji} ${mood.name}`);
}

function evening(words) {
  if (!words.length) {
    const page = journal.pageOf(today());
    const question = page.evening ? page.evening.question : questionOf(today());
    return console.log(`${question}${page.evening && page.evening.answer ? `\n${muted(page.evening.answer)}` : `\n${muted('Répondre : anais soir <votre réponse>')}`}`);
  }
  const saved = answerEvening(journal, today(), words.join(' '));
  console.log(`${saved.question}\n${muted(saved.answer)}`);
}

function memories() {
  const found = memoriesOf(journal, today());
  if (!found.length) return console.log(muted('Rien de noté à cette date il y a un mois ni il y a un an.'));
  for (const memory of found) console.log(`${pink(memory.label)} (${dayLabel(memory.isoDay)}) : ${memory.mood ? `${memory.mood.emoji} ` : ''}${memory.firstLine}`);
}

function chooseAnimations(choice) {
  if (!['oui', 'non'].includes(choice)) return console.log(`Animations : ${readSettings(journal.folder).animations === false ? 'non' : 'oui'}. « anais animations non » pour un nuage immobile.`);
  saveSetting(journal.folder, 'animations', choice === 'oui');
  console.log(choice === 'oui' ? 'Le nuage fera la fête.' : 'Le nuage restera immobile.');
}

function migrate() {
  const moved = migrateOpenTasks(journal, today());
  if (!moved.length) return console.log('Aucune tâche ouverte les jours précédents.');
  console.log(`${moved.length} tâche${moved.length > 1 ? 's' : ''} reportée${moved.length > 1 ? 's' : ''} à aujourd'hui :`);
  for (const entry of moved) console.log(`   ${pink('>')} ${entry.text} ${muted(`(${dayLabel(entry.from)})`)}`);
}

function showRange(firstDay, dayCount) {
  const blocks = [];
  for (let offset = 0; offset < dayCount; offset++) {
    const isoDay = addDays(firstDay, offset);
    const entries = journal.entriesOf(isoDay);
    if (entries.length || isoDay === today()) blocks.push(dayBlock(isoDay, entries, { isToday: isoDay === today(), page: journal.pageOf(isoDay) }));
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
  const query = words.join(' ');
  if (!query.trim()) throw new Error('Que faut-il chercher ? Exemple : anais chercher banque');
  const results = searchEntries(journal, query);
  if (!results.length) return console.log(muted(`Rien trouvé pour « ${query} ».`));
  console.log(pink(`Pour « ${query} » :`));
  for (const { isoDay, index, entry } of results) console.log(`${muted(isoDay)} ${entryLine(entry, index + 1)}`);
}

function main() {
  const [command, ...words] = process.argv.slice(2);
  if (!command) {
    // The full-screen interface needs a real terminal; otherwise (pipe, script) print the page.
    if (process.stdin.isTTY && process.stdout.isTTY) return runScreen(journal, themeNamed(currentThemeName()), { animations: readSettings(journal.folder).animations !== false });
    return showDay(today());
  }
  if (KIND_OF_COMMAND[command]) return addFromCommand(KIND_OF_COMMAND[command], words);
  if (ISO_DAY.test(command)) return showDay(command);
  switch (command) {
    case 'aide': case '--aide': case '-h': case '--help': return console.log(HELP);
    case 'jour': return showDay(today());
    case 'hier': return showDay(addDays(today(), -1));
    case 'demain': return showDay(addDays(today(), 1));
    case 'fait': return changeFromCommand(words[0], 'done', 'Faite');
    case 'annule': return changeFromCommand(words[0], 'cancelled', 'Abandonnée');
    case 'reporte': return postponeFromCommand(words[0], words[1]);
    case 'migrer': return migrate();
    case 'semaine': return showRange(weekStart(today()), 7);
    case 'mois': return showMonth();
    case 'chercher': return search(words);
    case 'dossier': return console.log(journal.folder);
    case 'theme': return chooseTheme(words[0]);
    case 'humeur': return chooseMood(words);
    case 'soir': return evening(words);
    case 'souvenirs': return memories();
    case 'animations': return chooseAnimations(words[0]);
    default: throw new Error(`Commande inconnue : ${command}. Tapez « anais aide ».`);
  }
}

try {
  main();
} catch (error) {
  console.error(`anais : ${error.message}`);
  process.exit(1);
}
