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
interfaces en mode texte. Tout se fait au clavier. Sur un écran assez large (84 colonnes ou
plus), un panneau à droite affiche le texte entier de la ligne choisie.

```text
╔═ Anaïs ════════════════════════════════════════════════ samedi 21 novembre ═╗
║  Jour   Semaine   Mois   Chercher                                           ║
╟─────────────────────────────────────────────────────────────────────────────╢
║  × écrire le README                    │ Note                               ║
║  • ! appeler la banque                 │                                    ║
║▸ – Idée de livre ¶                     │ Idée de livre                      ║
║  ○ réunion à 14 h                      │ Une famille sur trois générations, ║
║                                        │ racontée par la cadette.           ║
╟─────────────────────────────────────────────────────────────────────────────╢
║ ↑↓ ←→ choisir  Espace fait  ! priorité  R reporter                          ║
║ T E N ajouter  Entrée lire  Tab vue  Q quitter                              ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

| Touche | Action |
|---|---|
| ↑ ↓ | Choisir une ligne |
| ← → | Jour précédent ou suivant (semaine précédente ou suivante dans la vue Semaine) |
| Espace | Cocher une tâche, ou la rouvrir |
| ! | Rendre une tâche prioritaire, ou non |
| R | Reporter la tâche à demain |
| A | Abandonner la tâche |
| T, E | Ajouter une tâche, un événement (une ligne, Entrée pour noter) |
| N | Écrire une note, sur autant de lignes que vous voulez : Entrée passe à la ligne, Ctrl+S enregistre |
| Entrée | Lire et modifier la ligne choisie (Ctrl+S enregistre) ; dans Semaine, Mois ou Chercher : ouvrir le jour |
| Tab | Passer d'une vue à l'autre : Jour, Semaine, Mois, Chercher |
| M | Dans Mois : reporter à aujourd'hui les tâches restées ouvertes |
| H | Humeur du jour |
| S | Question du soir |
| ? | Toutes les touches |
| Q, Échap | Quitter |

Une ligne marquée ¶ a une suite. La recherche porte sur tout le texte, suite comprise, et le
résultat choisi s'affiche en entier dans le panneau.

### L'humeur, le soir, les souvenirs et le petit nuage

- **H** choisit l'humeur du jour parmi douze (😄 radieuse, 😌 sereine, 😴 fatiguée…). Elle
  s'affiche à côté de la date, et la vue **Mois** devient un calendrier des humeurs.
- **S** ouvre la question du soir, une par jour (« Qu'est-ce qui t'a fait sourire
  aujourd'hui ? »…). Ces questions ont été écrites pour Anaïs.
- En ouvrant Anaïs, un rappel de ce que vous notiez **il y a un mois** ou **il y a un an**.
- Le **petit nuage** (celui de carolinedanslesnuages.github.io) change de tête : endormi avant
  9 h, content quand vous cochez une tâche, triste avec une humeur triste, et il fait une petite
  fête de deux secondes quand toutes les tâches du jour sont faites. `anais animations non` le
  garde immobile.
- **?** affiche toutes les touches.

En ligne de commande : `anais humeur radieuse`, `anais soir <réponse>`, `anais souvenirs`.

### Les couleurs

```sh
anais theme            # le thème actuel
anais theme ambre      # ou terminal, sauge
```

| Thème | Couleurs |
|---|---|
| `terminal` (défaut) | Celles de votre terminal : aucun fond imposé, cadres atténués, ligne choisie en inversé. Lisible avec un thème clair comme sombre. |
| `ambre` | Ambre sur fond noir, comme un ancien écran à phosphore. |
| `sauge` | Vert doux sur fond gris sombre. |

Le choix est rangé dans `reglages.json`, à côté du journal. `ANAIS_THEME` le remplace le temps
d'une session.

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
| `anais theme [nom]` | Les couleurs de l'écran : `terminal`, `ambre`, `sauge`. |
| `anais humeur [nom]` | L'humeur du jour (sans nom : la liste). `anais humeur aucune` la retire. |
| `anais soir [réponse]` | La question du soir, et votre réponse. |
| `anais souvenirs` | Ce que vous notiez il y a un mois, il y a un an. |
| `anais animations oui\|non` | La petite fête du nuage. |

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

humeur : 😄 radieuse
soir : Qu'est-ce qui t'a fait sourire aujourd'hui ? — Le chat sur le radiateur.

× écrire le README
• ! appeler la banque
○ réunion à 14 h
– Idée de livre
  Une famille sur trois générations,
  racontée par la cadette.

  Commencer par la maison de Bretagne.
```

Une note longue continue sur les lignes en retrait de deux espaces ; les lignes vides entre
elles sont gardées.

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
