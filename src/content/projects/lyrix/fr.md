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

## Ce que j’ai fait

Tout le projet : le front-end en React et TypeScript, l’API sur Cloudflare Workers avec Hono, les salons
multijoueurs, le calcul des indices de proximité, l’application installable (PWA), la direction artistique et les
tests, unitaires comme de bout en bout.

## Défis techniques

Un jeu attractif, simple d’accès et fluide. La possibilité de jouer à plusieurs en temps réel. La gestion des données
des joueurs entièrement en local, dans le navigateur.

## Résultats

- Un jeu original, qui séduit déjà de nombreux joueurs.
- Une nouvelle chanson chaque jour, et les chansons des 30 derniers jours toujours jouables.
