/**
 * The journal: one Markdown file per month (2026-11.md), readable and editable by hand.
 *
 *   # Novembre 2026
 *
 *   ## Samedi 21 novembre
 *
 *   humeur : 😄 radieuse                 the mood of the day
 *   habitudes : eau, marche              the habits done that day
 *   soir : Une question ? — Une réponse. the evening question and its answer
 *
 *   • Écrire le README          a task
 *   • ! Appeler la banque       a priority task
 *   × Fusionner les PR          a done task
 *   > Ranger le bureau          a task moved to another day
 *   ~ Racheter du café          a cancelled task
 *   ○ Réunion à 14 h            an event
 *   – Idée : un mode cyberdeck  a note
 *     Une note longue continue     a long note: its next lines are indented by two spaces,
 *     sur les lignes en retrait.   blank lines between them are kept
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MONTHS, dayLabel, parseIsoDate } from './dates.mjs';

export const SYMBOLS = { task: '•', done: '×', migrated: '>', cancelled: '~', event: '○', note: '–' };
const KIND_OF_SYMBOL = Object.fromEntries(Object.entries(SYMBOLS).map(([kind, symbol]) => [symbol, kind]));
const ENTRY_LINE = /^([•×>~○–-])\s+(!\s+)?(.*)$/;
const DAY_HEADING = /^##\s+\S+\s+(\d{1,2})\b/;
const PAGE_LINE = /^(humeur|habitudes|soir)\s*:\s*(.*)$/i;
const ANSWER_SEPARATOR = ' — ';
const graphemes = new Intl.Segmenter('fr', { granularity: 'grapheme' });

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const monthPath = (folder, month) => join(folder, `${month}.md`);

export const emptyPage = () => ({ entries: [], mood: null, habits: [], evening: null });

/** "😄 radieuse" → { emoji, name }. */
function parseMood(text) {
  const [first] = graphemes.segment(text.trim());
  if (!first) return null;
  return { emoji: first.segment, name: text.trim().slice(first.segment.length).trim() };
}

function readPageLine(page, field, value) {
  const lowerField = field.toLowerCase();
  if (lowerField === 'humeur') page.mood = parseMood(value);
  else if (lowerField === 'habitudes') page.habits = value.split(',').map((habit) => habit.trim()).filter(Boolean);
  else {
    const separator = value.indexOf(ANSWER_SEPARATOR);
    page.evening = separator < 0 ? { question: value.trim(), answer: '' } : { question: value.slice(0, separator).trim(), answer: value.slice(separator + ANSWER_SEPARATOR.length).trim() };
  }
}

/**
 * Reads a month: Map of "YYYY-MM-DD" → page { entries, mood, habits, evening }. An entry is
 * { kind, text, priority, body }, `body` holding the extra lines of a long entry. Unknown lines
 * are kept as notes.
 */
export function parseMonth(text, month) {
  const days = new Map();
  let page = null;
  let lastEntry = null;
  let pendingBlankLines = 0;
  for (const line of text.split('\n')) {
    const heading = DAY_HEADING.exec(line);
    if (heading) {
      const isoDay = `${month}-${heading[1].padStart(2, '0')}`;
      if (!days.has(isoDay)) days.set(isoDay, emptyPage());
      page = days.get(isoDay);
      lastEntry = null;
      continue;
    }
    if (!page || line.startsWith('#')) continue;
    if (!line.trim()) {
      if (lastEntry) pendingBlankLines++;
      continue;
    }
    if (lastEntry && /^( {2}|\t)/.test(line)) {
      lastEntry.body.push(...Array(lastEntry.body.length ? pendingBlankLines : 0).fill(''), line.replace(/^( {2}|\t)/, ''));
      pendingBlankLines = 0;
      continue;
    }
    pendingBlankLines = 0;
    const pageLine = !lastEntry && PAGE_LINE.exec(line);
    if (pageLine) {
      readPageLine(page, pageLine[1], pageLine[2]);
      continue;
    }
    const entry = ENTRY_LINE.exec(line);
    lastEntry = entry
      ? { kind: KIND_OF_SYMBOL[entry[1] === '-' ? '–' : entry[1]], text: entry[3].trim(), priority: !!entry[2], body: [] }
      : { kind: 'note', text: line.trim(), priority: false, body: [] };
    page.entries.push(lastEntry);
  }
  return days;
}

/** The whole text of an entry: its first line and the lines of its body. */
export const fullText = (entry) => [entry.text, ...(entry.body || [])].join('\n');

/** Builds an entry's text and body from a typed text (the first line is the title). */
export function splitText(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  while (lines.length > 1 && !lines[lines.length - 1].trim()) lines.pop();
  return { text: lines[0].trim(), body: lines.slice(1).map((line) => line.replace(/\s+$/, '')) };
}

function pageLines(page) {
  const lines = [];
  if (page.mood) lines.push(`humeur : ${page.mood.emoji}${page.mood.name ? ` ${page.mood.name}` : ''}`);
  if (page.habits.length) lines.push(`habitudes : ${page.habits.join(', ')}`);
  if (page.evening) lines.push(`soir : ${page.evening.question}${page.evening.answer ? `${ANSWER_SEPARATOR}${page.evening.answer}` : ''}`);
  return lines;
}

export function formatMonth(days, month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lines = [`# ${capitalize(MONTHS[monthNumber - 1])} ${year}`];
  for (const isoDay of [...days.keys()].sort()) {
    const page = days.get(isoDay);
    lines.push('', `## ${capitalize(dayLabel(isoDay))}`, '');
    const header = pageLines(page);
    if (header.length) lines.push(...header, ...(page.entries.length ? [''] : []));
    for (const entry of page.entries) {
      lines.push(`${SYMBOLS[entry.kind]} ${entry.priority ? '! ' : ''}${entry.text}`);
      for (const bodyLine of entry.body || []) lines.push(bodyLine ? `  ${bodyLine}` : '');
    }
  }
  return lines.join('\n') + '\n';
}

/** The journal folder: ANAIS_DOSSIER, or ~/.anais. */
export function openJournal(folder) {
  const read = (month) => (existsSync(monthPath(folder, month)) ? parseMonth(readFileSync(monthPath(folder, month), 'utf8'), month) : new Map());
  const journal = {
    folder,
    pageOf(isoDay) {
      return read(isoDay.slice(0, 7)).get(isoDay) || emptyPage();
    },
    savePage(isoDay, page) {
      const month = isoDay.slice(0, 7);
      const days = read(month);
      days.set(isoDay, page);
      mkdirSync(folder, { recursive: true });
      writeFileSync(monthPath(folder, month), formatMonth(days, month));
    },
    entriesOf(isoDay) {
      return journal.pageOf(isoDay).entries;
    },
    /** Replaces the entries of a day, keeping its mood, habits and evening answer. */
    saveDay(isoDay, entries) {
      journal.savePage(isoDay, { ...journal.pageOf(isoDay), entries });
    },
    /** Every day with a page, oldest first. */
    allDays() {
      if (!existsSync(folder)) return [];
      return readdirSync(folder)
        .filter((name) => /^\d{4}-\d{2}\.md$/.test(name))
        .flatMap((name) => [...read(name.slice(0, 7)).keys()])
        .filter((isoDay) => !Number.isNaN(parseIsoDate(isoDay).getTime()))
        .sort();
    },
  };
  return journal;
}
