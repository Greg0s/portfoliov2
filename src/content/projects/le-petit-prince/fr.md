---
title: Le Petit Prince
kind: Animation 3D
role: Modélisation et animation 3D
summary: 'Une courte animation 3D réalisée sous Blender : celle qui ouvre ce site.'
coverAlt: Le Petit Prince et le renard assis sur sa petite planète grise, dans un ciel bleu semé d’étoiles et de planètes jaunes.
---

## Contexte

Une courte animation en 3D sur le thème du _Petit Prince_ : le prince, le renard et la rose sur leur planète, dans un
ciel d’étoiles et de planètes.

## Ce que j’ai fait

J’ai modélisé, mis en matière et animé la scène sous Blender : les personnages, la planète, la rose sous le vent,
l’écharpe qui flotte, le décor d’étoiles et l’étoile filante. C’est cette planète qui ouvre aujourd’hui ce portfolio,
rendue en temps réel dans le navigateur.

## Défis techniques

Faire passer une scène pensée pour le rendu de Blender dans une page web, sans rien perdre de son allure.

:::challenge[De Blender au navigateur]
::problem[L’export de la scène pesait 16 Mo et 446 000 triangles, bien trop pour ouvrir un site.]
::solution[Une chaîne d’optimisation soude les sommets, simplifie chaque objet selon son rôle (le décor beaucoup, les personnages pas du tout), puis quantifie et compresse les maillages.]
::result[0,56 Mo et 56 000 triangles, sans différence visible, avec les 26 animations d’origine.]
:::

:::challenge[Retrouver une matière que le glTF ne transporte pas]
::problem[Le relief de la planète et les boucles des cheveux venaient de matériaux de Blender, que le format glTF ne sait pas exporter.]
::solution[Ils sont générés au chargement : une surface bosselée par un bruit simplex et des cratères pour la planète, des boucles froissées pour les cheveux, avec un tirage fixe.]
::result[La planète est toujours la même, aussi détaillée que dans Blender, pour quelques lignes de code.]
:::
