/** The moods to choose from: one emoji (no joined sequences, shown everywhere) and its name. */
export const MOODS = [
  ['😄', 'radieuse'], ['😌', 'sereine'], ['🥰', 'amoureuse'], ['🥳', 'en fête'],
  ['🧐', 'curieuse'], ['😤', 'déterminée'], ['🤪', 'loufoque'], ['😴', 'fatiguée'],
  ['😬', 'stressée'], ['😢', 'triste'], ['😠', 'en colère'], ['🤒', 'malade'],
].map(([emoji, name]) => ({ emoji, name }));

export function moodNamed(nameOrEmoji) {
  const searched = String(nameOrEmoji).trim().toLowerCase();
  return MOODS.find((mood) => mood.name === searched || mood.emoji === searched) || null;
}
