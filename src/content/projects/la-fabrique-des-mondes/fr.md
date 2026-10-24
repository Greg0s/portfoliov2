---
title: La Fabrique des Mondes
kind: Three.js · génératif
role: Développement 3D, en équipe
summary: 'Un god game en 3D où chaque élément du monde matérialise un procédé mathématique : attracteurs étranges, L-systèmes, boids…'
lede: 'Un god game en 3D : on façonne son propre monde, et chaque élément qui le compose matérialise un procédé mathématique.'
coverAlt: Une plateforme violette vue de haut, couverte d’attracteurs étranges lumineux, de cubes et de plantes générées.
---

## Contexte

Un projet d’école mené en équipe : construire, dans le navigateur, un jeu de simulation divine où l’on façonne son
propre monde sur une plateforme en 3D. La contrainte du sujet donnait tout son sel au projet : chaque élément posé dans
le monde devait être la matérialisation d’un procédé complexe.

## Ce que j’ai fait

J’ai développé la scène Three.js et l’interface qui permet de créer son monde : la palette d’objets avec un aperçu qui
tourne pour chacun, le placement et le déplacement des éléments sur la plateforme, la capture d’écran. Le monde réunit
huit procédés : attracteurs étranges, triangle de Sierpiński, paysage adaptatif, problème du voyageur de commerce,
éponge de Menger, L-systèmes, automate cellulaire de Wolfram et boids.

## Défis techniques

Huit procédés très différents devaient cohabiter dans une même scène, rester interactifs et se manipuler de la même
façon.

:::challenge[Faire cohabiter huit procédés dans un même monde]
::problem[Chaque procédé a sa propre logique : des points qui suivent une équation, des fractales récursives, un algorithme génétique, des agents qui se déplacent en groupe.]
::solution[Chaque procédé vit dans son propre module, qui rend un objet Three.js prêt à poser. La scène ne connaît que cet objet, et la palette réutilise le même module pour l’aperçu animé de chaque élément.]
::result[On ajoute un procédé sans toucher au reste du monde, et l’utilisateur les manipule tous de la même façon.]
:::

:::challenge[Sélectionner des objets faits de milliers de traits]
::problem[Cliquer sur un attracteur étrange ou un L-système revient à viser des lignes de quelques pixels : le lancer de rayon sur la géométrie elle-même est imprécis et coûteux.]
::solution[Chaque élément porte une boîte de sélection invisible, simple, sur laquelle porte le lancer de rayon ; les poignées de transformation s’y accrochent.]
::result[La sélection et le déplacement restent précis et fluides, quelle que soit la complexité de l’objet.]
:::
