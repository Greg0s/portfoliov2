---
title: Recoding
kind: Art génératif
role: Développement, en binôme
summary: Art génératif et interactif en p5.js et TypeScript, réalisé en binôme.
coverAlt: Une grille de petites formes noires faites de traits horizontaux et verticaux, sur fond blanc.
---

## Contexte

Un projet d’esthétique algorithmique mené en binôme avec Emma Veauvy : recoder une œuvre pionnière de l’art par
ordinateur, _23-Ecke_ de Georg Nees, puis la rendre interactive.

## Ce que j’ai fait

Nous avons écrit le programme en p5.js et TypeScript : une grille de polygones à 23 sommets, chacun tiré au hasard
dans sa case. Des réglages permettent de changer le nombre de lignes, de colonnes et de sommets, de choisir une graine
et de télécharger l’image obtenue.

## Défis techniques

Retrouver la règle derrière l’image, puis la donner à manipuler.

:::challenge[Retrouver le geste de Georg Nees]
::problem[Chaque forme de l’œuvre originale n’est faite que de traits horizontaux et verticaux, qui restent dans leur case et se referment sur eux-mêmes.]
::solution[Chaque nouveau sommet ne change qu’une coordonnée à la fois, en alternant x et y, tirée dans les trois quarts de la case ; le dernier trait revient au premier sommet.]
::result[Le programme retrouve l’allure de l’œuvre de 1965, et en produit des variations à l’infini.]
:::

:::challenge[Un hasard qu’on peut rejouer]
::problem[Une image tirée au hasard est perdue dès qu’on la redessine, alors qu’on veut pouvoir comparer et garder une composition.]
::solution[Le hasard part d’une graine choisie dans les réglages : la même graine redonne exactement la même image, quels que soient les autres paramètres.]
::result[On explore les variations en gardant celles qu’on aime, et on peut les télécharger.]
:::
