/**
 * The little cloud companion (the cloud of carolinedanslesnuages.github.io, drawn in characters).
 * Its face follows the day: sleepy in the morning, happy after a ticked task, sad with a sad mood,
 * and a short party (about two seconds) when every task of the day is done.
 */
const FACES = {
  calm: '•‿•',
  sleepy: '-‿-',
  happy: '◕‿◕',
  sad: '•ᴖ•',
  busy: '°o°',
  party: '^‿^',
};
const SAD_MOODS = new Set(['triste', 'en colère', 'malade', 'stressée']);
const PARTY_SPARKLES = [['✦', '✧'], ['✧', '✦'], ['·', '✦'], ['✦', '·']];
export const PARTY_FRAMES = PARTY_SPARKLES.length * 2;
export const PARTY_STEP_MS = 280;

/** Which face to show, from the day's page and what just happened. */
export function companionMood({ page, hour, justTicked = false, partyFrame = null }) {
  if (partyFrame !== null) return 'party';
  if (justTicked) return 'happy';
  if (page.mood && SAD_MOODS.has(page.mood.name)) return 'sad';
  if (page.mood && page.mood.name === 'fatiguée') return 'sleepy';
  if (hour < 9) return 'sleepy';
  if (page.entries.filter((entry) => entry.kind === 'task').length >= 5) return 'busy';
  return 'calm';
}

export const faceOf = (companion) => `(${FACES[companion]})`;

/** The cloud on three lines, with sparkles around it during the party. */
export function cloudLines(companion, partyFrame = null) {
  const [left, right] = partyFrame === null ? [' ', ' '] : PARTY_SPARKLES[partyFrame % PARTY_SPARKLES.length];
  return [
    `${left}  .-~~~-.  ${right}`,
    `  (  ${FACES[companion]}  )  `,
    `${right}  \`-...-´  ${left}`,
  ];
}

/** True when the day had tasks and none is left open. */
export const allTasksDone = (page) => page.entries.some((entry) => entry.kind === 'done') && !page.entries.some((entry) => entry.kind === 'task');
