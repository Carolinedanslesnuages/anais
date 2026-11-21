import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMonth, formatMonth } from '../src/journal.mjs';
import { dayLabel, weekStart, addDays } from '../src/dates.mjs';

const BINARY = fileURLToPath(new URL('../bin/anais.mjs', import.meta.url));
const newJournal = () => mkdtempSync(join(tmpdir(), 'anais-'));
const runCli = (folder, day, ...args) => spawnSync(process.execPath, [BINARY, ...args], {
  encoding: 'utf8',
  env: { ...process.env, ANAIS_DOSSIER: folder, ANAIS_DATE: day, NO_COLOR: '1' },
});

test('dates : libellés français, semaine, changement de mois', () => {
  assert.equal(dayLabel('2026-11-21'), 'samedi 21 novembre');
  assert.equal(weekStart('2026-11-22'), '2026-11-16');
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('format : relu puis réécrit à l’identique, lignes libres gardées en notes', () => {
  const text = '# Novembre 2026\n\n## Samedi 21 novembre\n\n• tâche\n• ! urgente\n× faite\n> reportée\n~ abandonnée\n○ événement\n– note\n';
  assert.equal(formatMonth(parseMonth(text, '2026-11'), '2026-11'), text);
  const edited = parseMonth('## Samedi 21 novembre\n- tiret simple\nune ligne écrite à la main\n', '2026-11');
  assert.deepEqual(edited.get('2026-11-21').map((entry) => entry.kind), ['note', 'note']);
});

test('ajouter, numéroter, cocher, abandonner', () => {
  const folder = newJournal();
  runCli(folder, '2026-11-21', 't', 'écrire', 'le', 'README');
  runCli(folder, '2026-11-21', 't', '!', 'appeler', 'la', 'banque');
  runCli(folder, '2026-11-21', 'e', 'réunion', 'à', '14', 'h');
  runCli(folder, '2026-11-21', 'n', 'idée');
  assert.match(runCli(folder, '2026-11-21', 'fait', '1').stdout, /Faite : écrire le README/);
  assert.match(runCli(folder, '2026-11-21', 'annule', '2').stdout, /Abandonnée : appeler la banque/);
  const page = runCli(folder, '2026-11-21').stdout;
  assert.match(page, /samedi 21 novembre · aujourd’hui/);
  assert.match(page, / 1 × écrire le README\n 2 ~ ! appeler la banque\n 3 ○ réunion à 14 h\n 4 – idée/);
  assert.equal(readFileSync(join(folder, '2026-11.md'), 'utf8'), '# Novembre 2026\n\n## Samedi 21 novembre\n\n× écrire le README\n~ ! appeler la banque\n○ réunion à 14 h\n– idée\n');
});

test('erreurs claires : numéro absent, élément qui n’est pas une tâche, texte vide', () => {
  const folder = newJournal();
  runCli(folder, '2026-11-21', 'e', 'réunion');
  assert.match(runCli(folder, '2026-11-21', 'fait', '9').stderr, /Pas d'élément n° 9/);
  assert.match(runCli(folder, '2026-11-21', 'fait', '1').stderr, /n'est pas une tâche ouverte/);
  assert.match(runCli(folder, '2026-11-21', 't').stderr, /Que faut-il noter/);
  assert.match(runCli(folder, '2026-11-21', 'nimporte').stderr, /Commande inconnue/);
});

test('reporter à demain, migrer les tâches ouvertes des jours passés', () => {
  const folder = newJournal();
  runCli(folder, '2026-11-19', 't', 'ranger');
  runCli(folder, '2026-11-20', 't', '!', 'banque');
  runCli(folder, '2026-11-20', 't', 'courses');
  runCli(folder, '2026-11-20', 'fait', '2');
  const migrated = runCli(folder, '2026-11-21', 'migrer').stdout;
  assert.match(migrated, /2 tâches reportées à aujourd'hui/);
  assert.match(runCli(folder, '2026-11-20').stdout, / 1 > ! banque\n 2 × courses/);
  assert.match(runCli(folder, '2026-11-21').stdout, / 1 • ranger\n 2 • ! banque/);
  assert.match(runCli(folder, '2026-11-21', 'migrer').stdout, /Aucune tâche ouverte/);
  assert.match(runCli(folder, '2026-11-21', 'reporte', '1').stdout, /Reportée au dimanche 22 novembre : ranger/);
  assert.match(runCli(folder, '2026-11-22').stdout, / 1 • ranger/);
  assert.match(runCli(folder, '2026-11-21', 'reporte', '2', '2026-11-20').stderr, /jour futur/);
});

test('semaine, mois, chercher, autre jour', () => {
  const folder = newJournal();
  runCli(folder, '2026-11-17', 'e', 'Dentiste');
  runCli(folder, '2026-11-17', 't', 'payer la cantine');
  runCli(folder, '2026-11-21', 't', 'écrire Anaïs');
  const week = runCli(folder, '2026-11-21', 'semaine').stdout;
  assert.match(week, /mardi 17 novembre[\s\S]*samedi 21 novembre · aujourd’hui/);
  assert.doesNotMatch(week, /lundi 16/, 'jours vides cachés');
  const month = runCli(folder, '2026-11-21', 'mois').stdout;
  assert.match(month, /17 mar {2}0 × {2}1 • {2}○ Dentiste/);
  assert.match(month, /1 tâche\(s\) restée\(s\) ouverte\(s\) les jours passés/);
  assert.match(runCli(folder, '2026-11-21', 'chercher', 'ANAIS').stdout, /2026-11-21 {2}1 • écrire Anaïs/);
  assert.match(runCli(folder, '2026-11-21', 'chercher', 'licorne').stdout, /Rien trouvé/);
  assert.match(runCli(folder, '2026-11-21', '2026-11-17').stdout, /mardi 17 novembre\n 1 ○ Dentiste/);
  assert.match(runCli(folder, '2026-11-18', 'hier').stdout, /mardi 17 novembre/);
});

test('un fichier modifié à la main reste lisible', () => {
  const folder = newJournal();
  writeFileSync(join(folder, '2026-11.md'), '# Novembre 2026\n\n## Samedi 21 novembre\n\n• tâche écrite à la main\n- note au tiret simple\n');
  assert.match(runCli(folder, '2026-11-21').stdout, / 1 • tâche écrite à la main\n 2 – note au tiret simple/);
  assert.equal(runCli(folder, '2026-11-21', 'fait', '1').status, 0);
});
