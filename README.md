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

## L'écran

Tapez `anais` tout seul : le journal s'ouvre en plein écran, dans le style des anciennes
interfaces en mode texte, en parme et rose. Tout se fait au clavier.

```text
╔═ Anaïs ═══════════════════════ samedi 21 novembre ═╗
║  Jour   Semaine   Mois   Chercher                  ║
╟────────────────────────────────────────────────────╢
║  × écrire le README                                ║
║▸ • ! appeler la banque                             ║
║  ○ réunion à 14 h                                  ║
╟────────────────────────────────────────────────────╢
║ ↑↓ ←→ choisir  Espace fait  ! priorité  R reporter ║
║ T tâche  E événement  N note  Tab vue  Q quitter   ║
╚════════════════════════════════════════════════════╝
```

| Touche | Action |
|---|---|
| ↑ ↓ | Choisir une ligne |
| ← → | Jour précédent ou suivant (semaine précédente ou suivante dans la vue Semaine) |
| Espace | Cocher une tâche, ou la rouvrir |
| ! | Rendre une tâche prioritaire, ou non |
| R | Reporter la tâche à demain |
| A | Abandonner la tâche |
| T, E, N | Ajouter une tâche, un événement, une note |
| Tab | Passer d'une vue à l'autre : Jour, Semaine, Mois, Chercher |
| Entrée | Dans Semaine, Mois ou Chercher : ouvrir le jour choisi |
| M | Dans Mois : reporter à aujourd'hui les tâches restées ouvertes |
| Q, Échap | Quitter |

Un écran plein se lit mal avec un lecteur d'écran : toutes les actions restent possibles avec
les commandes ci-dessous, qui écrivent du texte simple.

## Commandes

| Commande | Ce qu'elle fait |
|---|---|
| `anais jour` | La page du jour, en texte simple (aussi quand la sortie n'est pas un terminal). |
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
