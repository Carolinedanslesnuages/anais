import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openJournal } from '../src/journal.mjs';
import { addEntry } from '../src/actions.mjs';
import { handleKey, buildRows, initialState } from '../src/screen/app.mjs';
import { render, fitWidth, wrapText } from '../src/screen/render.mjs';
import { THEMES, themeNamed } from '../src/screen/themes.mjs';

process.env.ANAIS_DATE = '2026-11-21';
const ARROW_UP = '\x1b[A';
const DOWN = '\x1b[B';
const RIGHT = '\x1b[C';
const ENTER = '\r';
const ESCAPE = '\x1b';
const TAB_KEY = '\t';
const SAVE = '\x13';
const BACKSPACE = '\x7f';
const stripColors = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');

const newJournal = () => openJournal(mkdtempSync(join(tmpdir(), 'anais-screen-')));
const start = (journal) => ({ ...initialState(), ...buildRows(initialState(), journal) });
const press = (state, journal, ...keys) => keys.reduce((current, pressedKey) => handleKey(current, pressedKey, journal), state);
const typeText = (state, journal, text) => press(state, journal, ...[...text]);
const screenText = (state, width = 60, theme = themeNamed('terminal')) => render(state, { width, height: 14 }, theme).map(stripColors);

test('dessin : cadre complet à la bonne largeur, dans les trois thèmes', () => {
  const journal = newJournal();
  addEntry(journal, '2026-11-21', 'task', 'appeler la banque', true);
  addEntry(journal, '2026-11-21', 'event', 'réunion à 14 h');
  const state = press(start(journal), journal, DOWN);
  for (const themeName of Object.keys(THEMES)) {
    const lines = screenText(state, 60, THEMES[themeName]);
    assert.equal(lines.length, 14, themeName);
    assert.ok(lines.every((line) => [...line].length === 60), `${themeName} : toutes les lignes font 60 caractères`);
  }
  const lines = screenText(state);
  assert.match(lines[0], /^╔═ Anaïs \(•‿•\) ═+ samedi 21 novembre ═╗$/);
  assert.match(lines[3], /^║  • ! appeler la banque/);
  assert.match(lines[4], /^║▸ ○ réunion à 14 h/);
  assert.match(lines[13], /^╚═+╝$/);
  assert.equal(fitWidth('abcdef', 4), 'abc…');
  assert.deepEqual(wrapText('un deux trois\nquatre', 8), ['un deux', 'trois', 'quatre']);
});

test('le thème terminal n’impose aucune couleur de fond', () => {
  const lines = render(start(newJournal()), { width: 60, height: 14 }, THEMES.terminal).join('');
  assert.doesNotMatch(lines, /48;5;/);
  assert.match(render(start(newJournal()), { width: 60, height: 14 }, THEMES.ambre).join(''), /48;5;16/);
});

test('tâche sur une ligne : T, le texte, Entrée ; Échap annule', () => {
  const journal = newJournal();
  let state = press(start(journal), journal, 't');
  assert.equal(state.editor.title, 'Nouvelle tâche');
  state = typeText(state, journal, 'écrire à Inès');
  state = press(state, journal, ARROW_UP, BACKSPACE, 's', ENTER);
  assert.equal(state.message, 'Tâche ajoutée.');
  assert.deepEqual(journal.entriesOf('2026-11-21'), [{ kind: 'task', text: 'écrire à Inès', priority: false, body: [] }]);
  state = typeText(press(state, journal, 'e'), journal, 'dentiste');
  state = press(state, journal, ESCAPE);
  assert.equal(journal.entriesOf('2026-11-21').length, 1, 'Échap n’ajoute rien');
});

test('note longue : plusieurs lignes, Ctrl+S, puis Entrée pour la relire et la modifier', () => {
  const journal = newJournal();
  let state = typeText(press(start(journal), journal, 'n'), journal, 'Idée de livre');
  state = press(state, journal, ENTER);
  state = typeText(state, journal, 'Une famille, trois générations.');
  state = press(state, journal, ENTER, ENTER, 'Fin.', SAVE);
  assert.equal(state.message, 'Note ajoutée.');
  assert.deepEqual(journal.entriesOf('2026-11-21')[0].body, ['Une famille, trois générations.', '', 'Fin.']);
  assert.match(readFileSync(join(journal.folder, '2026-11.md'), 'utf8'), /– Idée de livre\n {2}Une famille, trois générations\.\n\n {2}Fin\.\n/);
  assert.match(screenText(state)[3], /– Idée de livre ¶/);
  state = press(state, journal, ENTER);
  assert.equal(state.editor.title, 'Lire et modifier la note');
  assert.equal(state.editor.text, 'Idée de livre\nUne famille, trois générations.\n\nFin.');
  state = press(state, journal, BACKSPACE, BACKSPACE, BACKSPACE, BACKSPACE, ...'À suivre.', SAVE);
  assert.equal(state.message, 'Modifié.');
  assert.deepEqual(journal.entriesOf('2026-11-21')[0].body, ['Une famille, trois générations.', '', 'À suivre.']);
});

test('texte collé : les sauts de ligne restent dans une note, pas dans une tâche', () => {
  const journal = newJournal();
  let state = press(start(journal), journal, 'n', 'Courses\r\npain\r\nlait', SAVE);
  assert.deepEqual(journal.entriesOf('2026-11-21')[0].body, ['pain', 'lait']);
  state = press(state, journal, 't', 'payer\nla cantine', ENTER);
  assert.equal(journal.entriesOf('2026-11-21')[1].text, 'payer la cantine');
});

test('panneau sur le côté : le texte entier de la ligne choisie, seulement sur un écran large', () => {
  const journal = newJournal();
  addEntry(journal, '2026-11-21', 'note', 'Idée de livre\nUne famille sur trois générations, racontée par la cadette.');
  const state = start(journal);
  const wide = screenText(state, 100);
  assert.ok(wide.every((line) => [...line].length === 100));
  assert.match(wide[3], /│ Note/);
  assert.match(wide.slice(3, 10).join('\n'), /│ Une famille sur trois générations/);
  assert.doesNotMatch(screenText(state, 60).join('\n'), /│/);
});

test('recherche dans le contenu des notes, résultat détaillé sur le côté', () => {
  const journal = newJournal();
  addEntry(journal, '2026-11-19', 'note', 'Lecture\nUn passage sur les générations.');
  addEntry(journal, '2026-11-21', 'task', 'ranger le bureau');
  let state = press(start(journal), journal, '\x1b[Z'); // Shift+Tab: from Jour back to Chercher
  assert.equal(state.view, 'search');
  state = typeText(state, journal, 'generations');
  assert.equal(state.rows.length, 2, 'trouvé dans le corps, sans tenir compte des accents');
  assert.match(screenText(state, 100).slice(3, 8).join('\n'), /│ jeudi 19 novembre · Note[\s\S]*│ Un passage sur les générations\./);
  state = press(state, journal, ENTER);
  assert.equal(state.isoDay, '2026-11-19');
});

test('cocher, rouvrir, priorité, abandonner, reporter, jours, migration, quitter', () => {
  const journal = newJournal();
  addEntry(journal, '2026-11-19', 'task', 'ranger le bureau');
  addEntry(journal, '2026-11-21', 'task', 'banque');
  addEntry(journal, '2026-11-21', 'task', 'courses');
  let state = press(start(journal), journal, ' ');
  assert.equal(journal.entriesOf('2026-11-21')[0].kind, 'done');
  state = press(state, journal, ' ', '!');
  assert.equal(journal.entriesOf('2026-11-21')[0].priority, true);
  state = press(state, journal, DOWN, 'r');
  assert.match(state.message, /Reportée à demain : courses/);
  state = press(state, journal, ARROW_UP, 'a');
  assert.equal(journal.entriesOf('2026-11-21')[0].kind, 'cancelled');
  state = press(state, journal, RIGHT);
  assert.equal(state.isoDay, '2026-11-22');
  state = press(state, journal, TAB_KEY, TAB_KEY, 'm');
  assert.equal(state.message, "1 tâche(s) reportée(s) à aujourd'hui.");
  assert.equal(handleKey(state, 'q', journal), null);
  assert.equal(handleKey(state, '\x03', journal), null);
});

test('humeur : H, choisir, Entrée ; affichée dans le titre et le calendrier du mois', () => {
  const journal = newJournal();
  let state = press(start(journal), journal, 'h');
  assert.equal(state.view, 'moods');
  state = press(state, journal, DOWN, ENTER);
  assert.equal(state.message, 'Humeur : 😌 sereine');
  assert.deepEqual(journal.pageOf('2026-11-21').mood, { emoji: '😌', name: 'sereine' });
  const lines = render(state, { width: 60, height: 14 }, THEMES.terminal).map(stripColors);
  assert.match(lines[0], /samedi 21 novembre · 😌 ═╗$/);
  assert.match(lines[3], /humeur : 😌 sereine/);
  state = press(state, journal, TAB_KEY, TAB_KEY);
  assert.equal(state.view, 'month');
  const month = screenText(state, 100).join('\n');
  assert.match(month, /│ Humeurs de novembre 2026/);
  assert.match(month, / L {2}M {2}M {2}J {2}V {2}S {2}D/);
  assert.match(month, /20 😌/, 'le 21 porte l’humeur, à sa place dans la semaine');
  state = press(start(journal), journal, 'h', ...Array(12).fill(DOWN), ENTER);
  assert.equal(state.message, 'Humeur retirée.');
  assert.equal(journal.pageOf('2026-11-21').mood, null);
});

test('les emoji ne décalent pas le cadre', async () => {
  const { displayWidth } = await import('../src/text-width.mjs');
  const journal = newJournal();
  addEntry(journal, '2026-11-21', 'note', 'Anniversaire 🎂 de Léa 🥳 ce soir');
  const state = press(press(start(journal), journal, 'h'), journal, ENTER);
  for (const width of [60, 100]) {
    const lines = render(state, { width, height: 14 }, THEMES.terminal).map(stripColors);
    assert.ok(lines.every((line) => displayWidth(line) === width), `${width} colonnes`);
  }
});

test('question du soir : S, la réponse, Entrée ; la question reste celle du jour', () => {
  const journal = newJournal();
  let state = press(start(journal), journal, 's');
  assert.equal(state.editor.title, 'Qu’aimerais-tu faire autrement demain ?');
  state = typeText(state, journal, 'Me coucher plus tôt.');
  state = press(state, journal, ENTER);
  assert.equal(state.message, 'Réponse du soir notée.');
  assert.deepEqual(journal.pageOf('2026-11-21').evening, { question: 'Qu’aimerais-tu faire autrement demain ?', answer: 'Me coucher plus tôt.' });
  assert.match(screenText(state)[3], /soir : Me coucher plus tôt\./);
  assert.equal(press(state, journal, 's').editor.text, 'Me coucher plus tôt.', 'la réponse se reprend');
});

test('le nuage : endormi le matin, content après une tâche cochée, fête quand tout est fait', () => {
  const journal = newJournal();
  addEntry(journal, '2026-11-21', 'task', 'banque');
  addEntry(journal, '2026-11-21', 'task', 'courses');
  process.env.ANAIS_HEURE = '7';
  let state = start(journal);
  state = press(state, journal, DOWN, ARROW_UP);
  assert.equal(state.companion, 'sleepy');
  process.env.ANAIS_HEURE = '15';
  state = press(state, journal, ' ');
  assert.equal(state.companion, 'happy');
  assert.equal(state.partyFrame, null);
  state = press(state, journal, DOWN, ' ');
  assert.equal(state.message, 'Tout est fait pour aujourd’hui ✦');
  assert.equal(state.partyFrame, 0);
  assert.equal(state.companion, 'party');
  assert.match(screenText(state, 100).join('\n'), /\(  \^‿\^  \)/);
  state = press(state, journal, DOWN);
  assert.equal(state.companion, 'calm', 'la fête ne dure pas');
  delete process.env.ANAIS_HEURE;
});

test('aide complète avec ?, puis n’importe quelle touche pour revenir', () => {
  const journal = newJournal();
  let state = press(start(journal), journal, '?');
  const tall = render(state, { width: 60, height: 24 }, THEMES.terminal).map(stripColors).join('\n');
  assert.match(tall, /H {8}humeur du jour[\s\S]*S {8}question du soir[\s\S]*Q {8}quitter/);
  assert.match(screenText(state).join('\n'), /agrandissez la fenêtre/, 'petit écran : la suite est signalée');
  state = press(state, journal, 'x');
  assert.equal(state.showHelp, false);
  assert.equal(state.view, 'day');
});

test('habitudes : A pour ajouter, Espace pour cocher, le mois en carrés et la série', async () => {
  const journal = newJournal();
  let state = press(start(journal), journal, TAB_KEY, TAB_KEY, TAB_KEY);
  assert.equal(state.view, 'habits');
  state = typeText(press(state, journal, 'a'), journal, 'Eau');
  state = press(state, journal, ENTER);
  assert.equal(state.message, 'Habitude ajoutée : eau');
  const { toggleHabit } = await import('../src/habits.mjs');
  toggleHabit(journal, '2026-11-20', 'eau');
  state = press(state, journal, ' ');
  assert.equal(state.message, 'Fait : eau');
  assert.deepEqual(journal.pageOf('2026-11-21').habits, ['eau']);
  assert.match(state.rows[0].text, /^■ eau {7}·{19}■■ {9} {2}2 j$/);
  assert.match(readFileSync(join(journal.folder, '2026-11.md'), 'utf8'), /## Samedi 21 novembre\n\nhabitudes : eau\n/);
});

test('collections : N pour créer, Entrée pour ouvrir, T pour ajouter, Espace, Échap pour revenir', () => {
  const journal = newJournal();
  let state = press(start(journal), journal, TAB_KEY, TAB_KEY, TAB_KEY, TAB_KEY);
  assert.equal(state.view, 'collections');
  state = typeText(press(state, journal, 'n'), journal, 'Livres à lire');
  state = press(state, journal, ENTER);
  assert.equal(state.message, 'Collection créée : Livres à lire');
  state = press(state, journal, ENTER);
  assert.equal(state.collection, 'livres-a-lire');
  state = typeText(press(state, journal, 't'), journal, 'Les Années');
  state = press(state, journal, ENTER, ' ');
  assert.equal(state.message, 'Fait : Les Années');
  assert.equal(readFileSync(join(journal.folder, 'collections', 'livres-a-lire.md'), 'utf8'), '# Livres à lire\n\n× Les Années\n');
  state = press(state, journal, ESCAPE);
  assert.equal(state.collection, null);
  assert.match(state.rows[0].text, /Livres à lire {2}\(0 sur 1\)/);
  assert.equal(handleKey(state, ESCAPE, journal), null, 'Échap dans la liste quitte, comme ailleurs');
});

test('menu : intitulés courts sur un petit écran', () => {
  const lines = screenText(start(newJournal()), 56);
  assert.match(lines[1], /Jour.*Sem\..*Mois.*Hab\..*Coll\..*Rech\./);
  assert.match(screenText(start(newJournal()), 100)[1], /Semaine.*Habitudes.*Collections.*Chercher/);
});
