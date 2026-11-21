/**
 * Collections: free pages outside the days (« Livres à lire », « Idées »…), one Markdown file each
 * in the journal's collections/ folder:
 *
 *   # Livres à lire
 *
 *   • Les Années
 *   × Le Cri de la mouette
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const folderOf = (journal) => join(journal.folder, 'collections');
const ITEM_LINE = /^([•×])\s+(.*)$/;

/** "Livres à lire" → "livres-a-lire" (the file name). */
export const slugOf = (title) => String(title).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function parseCollection(text, fallbackTitle) {
  const lines = text.split('\n');
  const heading = lines.find((line) => line.startsWith('# '));
  const items = lines.map((line) => ITEM_LINE.exec(line)).filter(Boolean).map((match) => ({ text: match[2].trim(), done: match[1] === '×' }));
  return { title: heading ? heading.slice(2).trim() : fallbackTitle, items };
}

export const formatCollection = (collection) => [`# ${collection.title}`, '', ...collection.items.map((item) => `${item.done ? '×' : '•'} ${item.text}`)].join('\n') + '\n';

/** Every collection: [{ slug, title, items }], sorted by title. */
export function listCollections(journal) {
  if (!existsSync(folderOf(journal))) return [];
  return readdirSync(folderOf(journal))
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ slug: name.slice(0, -3), ...parseCollection(readFileSync(join(folderOf(journal), name), 'utf8'), name.slice(0, -3)) }))
    .sort((left, right) => left.title.localeCompare(right.title, 'fr'));
}

/** A collection found by its title or file name, or null. */
export function findCollection(journal, name) {
  const slug = slugOf(name);
  return listCollections(journal).find((collection) => collection.slug === slug) || null;
}

export function saveCollection(journal, collection) {
  const slug = collection.slug || slugOf(collection.title);
  if (!slug) throw new Error('Le nom de la collection doit contenir au moins une lettre ou un chiffre.');
  mkdirSync(folderOf(journal), { recursive: true });
  writeFileSync(join(folderOf(journal), `${slug}.md`), formatCollection(collection));
  return { ...collection, slug };
}

/** Adds an item to a collection, creating the collection when it does not exist yet. */
export function addToCollection(journal, name, text) {
  const cleaned = String(text).replace(/\s*\n\s*/g, ' ').trim();
  if (!cleaned) throw new Error('Que faut-il ajouter ?');
  const collection = findCollection(journal, name) || { title: String(name).trim(), items: [] };
  return saveCollection(journal, { ...collection, items: [...collection.items, { text: cleaned, done: false }] });
}

export function toggleCollectionItem(journal, slug, index) {
  const collection = listCollections(journal).find((candidate) => candidate.slug === slug);
  if (!collection || !collection.items[index]) return null;
  collection.items[index].done = !collection.items[index].done;
  saveCollection(journal, collection);
  return collection.items[index];
}
