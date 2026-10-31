---
title: Lyrix
kind: Jeu multijoueur
role: Conception et développement
summary: Retrouver une chanson à partir de ses paroles cachées, seul ou à plusieurs en temps réel.
coverAlt: Le logo Lyrix, « Retrouve la chanson du jour à partir de ses paroles cachées », au-dessus de barres orange et grises.
---

## Contexte

Un jeu web gratuit inspiré de Pédantix, mais sur des paroles de chansons plutôt que sur des articles de Wikipédia : on
propose des mots pour dévoiler peu à peu les paroles, et la manche est gagnée quand le titre est entièrement découvert.
On y joue seul, ou à plusieurs dans un salon en temps réel.

![Une partie de Lyrix sur ordinateur : le titre « Les Démons de minuit » trouvé, les paroles encore masquées par des barres orange, les mots proposés et les indices à droite.](./game.webp 'Une manche gagnée : le titre est trouvé, il reste des paroles à découvrir.')

## Ce que j’ai fait

Tout le projet : le front-end en React et TypeScript, l’API sur Cloudflare Workers avec Hono, les salons
multijoueurs, le calcul des indices de proximité, l’application installable (PWA), la direction artistique et les
tests, unitaires comme de bout en bout.

![Lyrix en thème clair : la chanson du jour à deviner, ses couplets masqués par des barres orange pâle et le champ pour proposer un mot.](./light.webp 'Le thème clair, sur la chanson du jour.')

## Défis techniques

Un jeu attractif, simple d’accès et fluide. La possibilité de jouer à plusieurs en temps réel. La gestion des données
des joueurs entièrement en local, dans le navigateur.

![La fenêtre d’un salon à plusieurs : le code du salon, Z9YK9N, à partager, la liste des joueurs et le bouton pour lancer la partie.](./room.webp 'Un salon à plusieurs : un code à partager, et les découvertes de chacun en direct.')

## Résultats

- Un jeu original, qui séduit déjà de nombreux joueurs.
- Une nouvelle chanson chaque jour, et les chansons des 30 derniers jours toujours jouables.

![Les archives de Lyrix : une grille des 30 derniers jours, les chansons trouvées affichées en clair, les autres encore à jouer.](./archives.webp 'Les archives : les 30 derniers jours, à rattraper.')
