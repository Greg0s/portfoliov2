---
title: What we play?
kind: Web · 3D en CSS
role: Conception, design et développement
summary: Trouver un jeu en ligne à plusieurs, guidé par une TV-personnage qui réagit à chacun de vos gestes.
coverAlt: Le logo What we play? dans une bulle de dialogue, à côté d’un vieux Mac au visage de télé et de quatre pions de couleur.
---

## Contexte

Un projet personnel né d’une question qui revient à chaque soirée : à quoi joue-t-on, à combien, et sans rien
installer ? Le site répond en une touche : on donne le nombre de joueurs, il propose des jeux en ligne gratuits qui
conviennent.

## Ce que j’ai fait

Tout, de la maquette à la mise en ligne : une TV-personnage qui réagit à ce que fait l’utilisateur et parle dans sa
bulle, un clavier de sélection, un mode 3D où la TV devient un Mac en 3D en CSS pur avec un pion animé par joueur, un
thème clair et sombre, trois langues (anglais, français, espagnol) et une recherche qui ignore les accents.

## Défis techniques

Un site très illustré qui devait rester rapide, se trouver dans les moteurs de recherche, et ne jamais clignoter au
chargement.

:::challenge[Être trouvé dans trois langues]
::problem[Une application React rendue dans le navigateur arrive vide aux moteurs de recherche, et chaque page existe en trois langues et pour chaque nombre de joueurs.]
::solution[Les 33 pages sont pré-rendues au build à partir d’une seule table de routes typées, qui génère aussi les liens canoniques, les alternatives hreflang, le plan du site et les données structurées ; le build échoue si une langue n’a pas toutes ses clés.]
::result[Chaque page arrive complète et décrite, et ajouter une langue ou un nombre de joueurs met tout le site à jour d’un coup.]
:::

:::challenge[Ni flash ni saut au chargement]
::problem[Le thème sombre et le mode 3D sont mémorisés dans le navigateur, mais React ne les lit qu’après le premier affichage : la page apparaissait d’abord claire et à plat.]
::solution[Un petit script en ligne dans l’en-tête relit ces préférences avant le premier rendu et les pose sur la page, avec la même logique que l’application.]
::result[La page s’affiche directement dans le bon thème et le bon mode, sans clignotement.]
:::
