import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openJournal } from '../src/journal.mjs';
import { addEntry } from '../src/actions.mjs';
import { handleKey, buildRows, initialState } from '../src/screen/app.mjs';
import { render, fitWidth } from '../src/screen/render.mjs';

process.env.ANAIS_DATE = '2026-11-21';
const ARROW_UP = '\x1b[A';
const DOWN = '\x1b[B';
const RIGHT = '\x1b[C';
const ENTER = '\r';
const ESCAPE = '\x1b';
const TAB_KEY = '\t';
const stripColors = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');

function newJournal() {
  const journal = openJournal(mkdtempSync(join(tmpdir(), 'anais-screen-')));
  return journal;
}
const start = (journal) => ({ ...initialState(), ...buildRows(initialState(), journal) });
const press = (state, journal, ...keys) => keys.reduce((current, pressedKey) => handleKey(current, pressedKey, journal), state);
const typeText = (state, journal, text) => press(state, journal, ...[...text]);

test('dessin : cadre complet, à la bonne largeur, ligne choisie marquée', () => {
  const journal = newJournal();
  addEntry(journal, '2026-11-21', 'task', 'appeler la banque', true);
  addEntry(journal, '2026-11-21', 'event', 'réunion à 14 h');
  const lines = render(press(start(journal), journal, DOWN), { width: 60, height: 14 }).map(stripColors);
  assert.equal(lines.length, 14);
  assert.ok(lines.every((line) => [...line].length === 60), 'toutes les lignes font 60 caractères');
  assert.match(lines[0], /^╔═ Anaïs ═+ samedi 21 novembre ═╗$/);
  assert.match(lines[1], /Jour.*Semaine.*Mois.*Chercher/);
  assert.match(lines[4], /^║▸ ○ réunion à 14 h/);
  assert.match(lines[3], /^║  • ! appeler la banque/);
  assert.match(lines[13], /^╚═+╝$/);
  assert.equal(fitWidth('abcdef', 4), 'abc…');
});

test('ajouter au clavier : T, le texte, Entrée ; Échap annule', () => {
  const journal = newJournal();
  let state = press(start(journal), journal, 't');
  assert.equal(state.input.title, 'Nouvelle tâche');
  state = typeText(state, journal, 'écrire à Inès');
  state = press(state, journal, ARROW_UP, '\x7f', 's', ENTER);
  assert.equal(state.message, 'Tâche ajoutée.');
  assert.deepEqual(journal.entriesOf('2026-11-21'), [{ kind: 'task', text: 'écrire à Inès', priority: false }]);
  state = typeText(press(state, journal, 'n'), journal, 'idée');
  state = press(state, journal, ESCAPE);
  assert.equal(journal.entriesOf('2026-11-21').length, 1, 'Échap n’ajoute rien');
});

test('cocher, rouvrir, priorité, abandonner, reporter', () => {
  const journal = newJournal();
  addEntry(journal, '2026-11-21', 'task', 'banque');
  addEntry(journal, '2026-11-21', 'task', 'courses');
  addEntry(journal, '2026-11-21', 'note', 'idée');
  let state = press(start(journal), journal, ' ');
  assert.equal(journal.entriesOf('2026-11-21')[0].kind, 'done');
  state = press(state, journal, ' ');
  assert.equal(journal.entriesOf('2026-11-21')[0].kind, 'task', 'Espace rouvre une tâche faite');
  state = press(state, journal, '!');
  assert.equal(journal.entriesOf('2026-11-21')[0].priority, true);
  state = press(state, journal, DOWN, 'r');
  assert.match(state.message, /Reportée à demain : courses/);
  assert.equal(journal.entriesOf('2026-11-22')[0].text, 'courses');
  state = press(state, journal, DOWN, ' ');
  assert.equal(state.message, 'Seule une tâche se coche.');
  state = press(state, journal, ARROW_UP, ARROW_UP, 'a');
  assert.equal(journal.entriesOf('2026-11-21')[0].kind, 'cancelled');
});

test('jours, vues, recherche, migration, quitter', () => {
  const journal = newJournal();
  addEntry(journal, '2026-11-19', 'task', 'ranger le bureau');
  addEntry(journal, '2026-11-21', 'event', 'dentiste');
  let state = press(start(journal), journal, RIGHT);
  assert.equal(state.isoDay, '2026-11-22');
  state = press(state, journal, TAB_KEY);
  assert.equal(state.view, 'week');
  assert.match(state.rows.find((viewRow) => viewRow.isoDay === '2026-11-21').text, /○ dentiste/);
  state = press(state, journal, TAB_KEY);
  assert.equal(state.view, 'month');
  state = press(state, journal, 'm');
  assert.equal(state.message, "1 tâche(s) reportée(s) à aujourd'hui.");
  state = press(state, journal, TAB_KEY);
  assert.equal(state.view, 'search');
  state = typeText(state, journal, 'qbureau');
  state = press(state, journal, '\x7f', '\x7f', '\x7f', '\x7f', '\x7f', '\x7f', '\x7f', ...'ranger');
  assert.equal(state.query, 'ranger', 'q s’écrit dans la recherche, il ne quitte pas');
  assert.equal(state.rows.length, 3);
  state = press(state, journal, ENTER); // the first result is already selected
  assert.equal(state.view, 'day');
  assert.equal(state.isoDay, '2026-11-19');
  assert.equal(handleKey(state, 'q', journal), null);
  assert.equal(handleKey(state, '\x03', journal), null);
});
