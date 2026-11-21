# Anaïs

Un bullet journal dans le terminal.

```text
$ anais t ! appeler la banque
$ anais e réunion à 14 h
$ anais
samedi 21 novembre · aujourd’hui
 1 × écrire le README
 2 • ! appeler la banque
 3 ○ réunion à 14 h
 4 – idée : un mode cyberdeck
```

La méthode du bullet journal (*bujo*) : on note vite, avec un signe par type de ligne, et on
reporte chaque jour ce qui n'est pas fait. Anaïs garde l'affichage étroit, pour tenir sur le
petit écran d'un cyberdeck.

| Signe | Sens | Commande |
|---|---|---|
| • | tâche | `anais t <texte>` (`anais t ! <texte>` : prioritaire) |
| × | tâche faite | `anais fait <n>` |
| ~ | tâche abandonnée | `anais annule <n>` |
| > | tâche reportée | `anais reporte <n> [AAAA-MM-JJ]` (défaut : demain) |
| ○ | événement | `anais e <texte>` |
| – | note | `anais n <texte>` |

## Commandes

| Commande | Ce qu'elle fait |
|---|---|
| `anais` | La page du jour. |
| `anais hier`, `anais demain`, `anais 2026-11-17` | Une autre page. |
| `anais migrer` | Reporte à aujourd'hui toutes les tâches restées ouvertes les jours passés. |
| `anais semaine` | Les jours de la semaine où quelque chose est noté. |
| `anais mois` | Une ligne par jour : faites, ouvertes, événements. |
| `anais chercher <mots>` | Dans tout le journal, sans tenir compte des accents ni des majuscules. |
| `anais dossier` | Où le journal est rangé. |

## Installation

```sh
npm install -g github:Carolinedanslesnuages/anais
```

Node 20 ou plus, aucune dépendance.

## Le journal

Un fichier Markdown par mois (`2026-11.md`) dans `~/.anais`, ou dans le dossier indiqué par
`ANAIS_DOSSIER`. Il se lit et se modifie à la main, dans n'importe quel éditeur :

```markdown
# Novembre 2026

## Samedi 21 novembre

× écrire le README
• ! appeler la banque
○ réunion à 14 h
– idée : un mode cyberdeck
```

**Votre journal reste sur votre ordinateur.** Anaïs n'envoie rien nulle part, et ce dépôt ne
contient que l'outil. Pour le retrouver sur plusieurs machines, rangez le dossier dans un
espace synchronisé que vous contrôlez, ou un dépôt Git **privé**.

Les couleurs s'éteignent avec `NO_COLOR=1`, ou quand la sortie n'est pas un terminal.

## Pourquoi Anaïs

[Anaïs Nin](https://fr.wikipedia.org/wiki/Ana%C3%AFs_Nin) (1903-1977), née à Neuilly-sur-Seine,
a tenu son journal pendant plus de soixante ans, de ses onze ans à sa mort. Publié de son
vivant, il a fait d'elle l'une des diaristes les plus célèbres du XXᵉ siècle.

## Développer Anaïs

```sh
npm test
```

Les tests écrivent dans un journal jetable, à une date fixée (`ANAIS_DATE`) : ajout,
numérotation, report, migration, semaine, mois, recherche, et fichier modifié à la main.

## Licence

[MIT](LICENSE).
