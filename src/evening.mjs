/**
 * The evening question: one per day, the same all day long, chosen from the date. These questions
 * were written for Anaïs.
 */
import { parseIsoDate } from './dates.mjs';

export const EVENING_QUESTIONS = [
  'Qu’est-ce qui t’a fait sourire aujourd’hui ?',
  'Qu’as-tu appris aujourd’hui ?',
  'De quoi es-tu fière aujourd’hui ?',
  'Qu’est-ce qui t’a surprise aujourd’hui ?',
  'Pour quoi dirais-tu merci ce soir ?',
  'Quel moment aimerais-tu garder de cette journée ?',
  'Qu’est-ce qui a été plus facile que prévu ?',
  'Qu’aimerais-tu faire autrement demain ?',
  'Qui as-tu aidé, ou qui t’a aidée, aujourd’hui ?',
  'Qu’est-ce qui t’a donné de l’énergie ?',
  'Qu’est-ce qui t’en a pris ?',
  'Quelle petite chose a rendu la journée meilleure ?',
  'Qu’as-tu remarqué de beau aujourd’hui ?',
  'Quelle idée t’a traversé l’esprit ?',
  'Qu’est-ce que tu as enfin terminé ?',
  'À quoi as-tu dit non, et tant mieux ?',
  'Qu’est-ce qui t’a fait rire ?',
  'Quelle question te trotte dans la tête ?',
  'Qu’as-tu fait juste pour toi ?',
  'Qu’attends-tu de demain ?',
  'Quel mot résume ta journée ?',
  'Qu’est-ce qui t’a rendue curieuse ?',
  'Quelle conversation t’a marquée ?',
  'Qu’est-ce que tu as lâché aujourd’hui ?',
  'Où étais-tu le mieux aujourd’hui ?',
  'Quel son, quelle odeur, quelle couleur retiens-tu ?',
  'Qu’as-tu créé aujourd’hui, même tout petit ?',
  'Quelle erreur t’a appris quelque chose ?',
  'Qu’est-ce qui t’a rendue calme ?',
  'Si cette journée était une chanson, laquelle ?',
  'Qu’as-tu envie de raconter à quelqu’un ?',
];

/** The question of a day: always the same for a given date. */
export function questionOf(isoDay) {
  const daysSinceEpoch = Math.floor(parseIsoDate(isoDay).getTime() / 86400000);
  return EVENING_QUESTIONS[((daysSinceEpoch % EVENING_QUESTIONS.length) + EVENING_QUESTIONS.length) % EVENING_QUESTIONS.length];
}
