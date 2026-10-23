# Où en est le projet

- **Mis à jour** : 23 octobre 2026 (spec principale à jour avec la v3)
- **À lire en premier** dans une nouvelle conversation, juste après `CLAUDE.md`.

## La maquette v3 est terminée

Grégoire l'a validée le 23 octobre 2026 : c'est la fin de l'étape 0 de la spec principale (section 11).

- **Le canevas** : https://claude.ai/artifact/Qm7HYAAf7d991WuXECGZue (privé). Ses plans de travail : « Parcours — ordinateur » et « Parcours — mobile » (l'accueil d'un bout à l'autre, jusqu'au bureau), « Étude de cas », « Bureau — aube et crépuscule », les composants « Scène », « Bureau » et « Titre animé », le storyboard (laissé tel quel) et la charte « Musée de nuit ».
- **Les décisions** sont dans les specs, qui font référence :
  - `docs/specs/2026-10-14-portfolio-design.md`, la spec principale : contenu, direction artistique, architecture, qualité, mise en ligne, étapes de construction ;
  - `docs/specs/2026-10-20-maquette-v3-parcours.md` : l'accueil en un seul mouvement de caméra à travers les projets ;
  - `docs/specs/2026-10-21-maquette-v3-bureau.md` : le bureau qui termine le parcours, c'est-à-dire la section Contact (écran, mur d'images, cartels, Corbeille).
- **Les images de la maquette** (couches rendues du bureau, captures des pages, logos, images du mur, icône de la Corbeille, fond d'écran) sont dans les fichiers de l'artefact, appelées par leur adresse `/_blob/…` dans le code des composants. Les photos de Grégoire et les images de tiers ne sont jamais versionnées.

## La suite, dans l'ordre

1. ~~Fusionner la pull request #1 dans `main`~~ : fait.
2. **Mettre la spec principale à jour avec la v3** : fait le 23 octobre 2026, à valider par Grégoire. La spec principale reprend le parcours et le bureau (sections 4, 5.4, 5.5, 6.4, 6.5, 7.4), les images du mur et leurs crédits (7.3, 8.2), les budgets du bureau, de l'écran et du mur (9.4), les étapes de construction réécrites (11) et les risques du bureau (12). Les deux points laissés « à l'intégration » par la spec du parcours sont tranchés en 7.4 : cartes en HTML et CSS 3D par défaut, plongée par le routeur d'Astro avec une transition de vue.
3. **Mesurer avant de choisir** (étape 1 de la spec principale). Un prototype de mesure, sur un téléphone et sur un ordinateur de milieu de gamme (images par seconde, poids, mémoire) :
   - le bureau rendu en temps réel par la scène de `docs/prototypes/bureau/` ;
   - le parcours avec ses cartes floutées.

   Le résultat fixe l'architecture du bureau (temps réel partout, couches pré-rendues comme dans la maquette, ou un mélange) et celle des cartes (CSS ou WebGL).
4. **Construire le site** étape par étape (spec principale, section 11), à partir de l'étape 2 : les fondations (Astro, TypeScript strict, ESLint, Prettier, Vitest, Playwright, CI, déploiement).

## Performance et qualité du code

- Le code des composants du canevas sert la maquette et ne sera pas repris : on ne l'optimise pas. Le site est écrit à neuf.
- Les scènes Three.js des prototypes seront reprises : leur coût (nombre d'objets, ombres, génération de la ville) compte, et se mesure au point 3 de la suite.
- Les budgets de la section 9.4 et les vérifications de la section 9 de la spec principale s'appliquent à chaque étape du site, qui se termine avec la CI verte. L'étape 11 fait une passe complète d'accessibilité, de performance et de référencement.

## Ce que Grégoire doit encore fournir

- Les vidéos en boucle des 8 projets, les années et rôles à confirmer (Le Petit Prince, Obaine) et l'adresse en ligne de Lyrix (spec principale, section 8.2).
- Des images pour chaque cadre du mur : au moins 600 px de côté, d'un format proche de celui du cadre, avec le titre, l'auteur et l'année quand il les connaît. Pour l'instant, chaque cadre n'a qu'une image, donc la Corbeille relance un tirage qui ne change rien.
- Les photos et visuels en haute définition des études de cas.

## Les outils

- `docs/prototypes/outils/` : vérifier, rendre et photographier les composants du canevas hors du canevas, et tester leurs interactions (`interactions/`).
- `docs/prototypes/bureau/` et `docs/prototypes/petit-prince/` : les scènes Three.js et leurs rendus ; le README de chaque dossier donne les commandes.
