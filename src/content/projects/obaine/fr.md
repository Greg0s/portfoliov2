---
title: Obaine
kind: Front-end
role: Développement front-end
summary: Le front-end d’une plateforme où les fans financent des athlètes en échange de contenus exclusifs.
coverAlt: 'La page d’accueil d’Obaine : « Accédez à des expériences uniques », un athlète dans un cadre et une foule de supporters en silhouettes roses.'
---

## Contexte

Obaine est une plateforme où les fans soutiennent financièrement des athlètes, en échange de contenus et
d’expériences exclusifs. J’en ai développé le front-end à partir des maquettes de l’équipe.

## Ce que j’ai fait

Les pages d’accueil, des actions et de tous les athlètes, avec leurs carrousels, l’en-tête qui change entre ordinateur
et mobile, la connexion à l’API, l’état partagé des athlètes et la navigation entre les pages, en Vue 3 avec Pinia et
Vue Router, testés avec Vitest et livrés dans Docker.

## Défis techniques

Une interface très visuelle, pleine de carrousels, qui devait rester la même d’une page à l’autre.

:::challenge[Les mêmes données sur toutes les pages]
::problem[La liste des athlètes servait à l’accueil, aux carrousels et à la page de tous les athlètes : la charger sur chaque page multipliait les appels.]
::solution[Un store Pinia charge les athlètes une fois depuis l’API et les partage entre les composants et les pages.]
::result[Un seul appel, et des pages qui restent à jour entre elles.]
:::

:::challenge[Des carrousels fidèles aux maquettes]
::problem[Les maquettes prévoyaient des carrousels différents selon les sections et la taille de l’écran.]
::solution[Des composants de carrousel réutilisables, construits sur Swiper et réglés par section, avec une version mobile et une version ordinateur.]
::result[Des pages fidèles aux maquettes, sur téléphone comme sur ordinateur.]
:::
