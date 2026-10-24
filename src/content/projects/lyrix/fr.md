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
multijoueurs, le calcul des indices de proximité, l’application installable et les tests, unitaires comme de bout en
bout.

## Défis techniques

Un jeu où la réponse doit rester secrète, des indices qui comprennent le sens des mots, et des parties partagées en
direct.

:::challenge[Garder les paroles secrètes]
::problem[Si les paroles arrivent dans le navigateur, il suffit d’ouvrir les outils de développement pour gagner.]
::solution[Le Worker garde les paroles et ne renvoie jamais que des mots masqués : il dit seulement où un mot proposé apparaît, jamais quel mot se cache à chaque place.]
::result[La partie reste juste, même pour un joueur qui inspecte le réseau.]
:::

:::challenge[Des indices qui comprennent le sens]
::problem[Un mot absent des paroles devait quand même dire à quel point il est proche, sans faire tourner un modèle de langue à chaque essai.]
::solution[Les proximités sont précalculées hors ligne avec des embeddings de mots français, puis rangées dans Workers KV en une table par chanson ; le score est un rang (80 : parmi les 10 voisins les plus proches d’un mot caché).]
::result[Chaque essai reçoit un indice de sens instantané, et un mot assez proche s’inscrit à la place du mot caché.]
:::

:::challenge[Jouer ensemble en temps réel]
::problem[Les joueurs d’un même salon doivent voir les découvertes des autres au moment où elles arrivent.]
::solution[Chaque salon est un Durable Object de Cloudflare, qui garde l’état de la partie et ses membres reliés par WebSocket.]
::result[Un salon se crée à la volée, et chaque découverte apparaît chez tous les joueurs à la fois.]
:::
