---
title: Siemens
kind: Stage web · Industrie 4.0
role: Conception et développement web
summary: Faciliter la configuration et le monitoring en direct de processus de fabrication additive industrielle.
coverAlt: Un bras robotisé de soudage dépose du métal sur une grande pièce circulaire, sous une lumière verte (procédé WAAM).
---

## Contexte

Intégré à une équipe internationale et pluridisciplinaire d’une vingtaine de personnes travaillant en anglais, j’ai
participé au développement de solutions de suivi en direct pour l’impression 3D métal (WAAM et SLM). L’objectif :
détecter les erreurs, optimiser le processus et préparer sa mise à l’échelle pour de nouvelles méthodes de production.

![Les bâtiments de Siemens à Neuperlach-Süd, à Munich, derrière une avenue bordée d’arbres et de fleurs jaunes.](./campus.webp 'Le site de Siemens à Neuperlach-Süd, à Munich.')

## Ce que j’ai fait

- Une application complète qui génère des fichiers de configuration complexes (JSON) depuis une interface nodale
  (React, React Flow), en validant leur structure avec JSON Schema.
- L’extension du logiciel interne au monitoring d’un nouveau processus (SLM), avec des vues modulaires pour naviguer
  dans des piles de bitmaps 2D.
- L’évolution d’une interface existante de suivi en direct, reliée à une API par WebSockets (Vue.js, Vuex).
- Des améliorations de l’UX et de l’UI, et des graphiques temporels interactifs synchronisés avec la vidéo sur des
  points précis (Plotly).

![Schéma de l’éditeur nodal : à gauche, des nœuds reliés en graphe ; à droite, le fichier de configuration qu’ils produisent.](./node-graph.webp 'Le principe de l’éditeur nodal : un graphe de nœuds, un fichier de configuration validé.')

## Défis techniques

Mener seul des tâches sur un projet existant complexe, m’adapter à un environnement industriel rigoureux (Docker, Git)
et répondre aux besoins précis de chercheurs aux profils variés.

## Résultats

- Un outil de configuration utilisé activement par l’équipe pour faire avancer ses recherches et ses mémoires de
  master.
- De nouvelles interfaces de monitoring intégrées au logiciel commun, qui étendent le suivi en direct à d’autres
  processus d’impression.
- Les graphiques temporels interactifs présentés à la direction, lors des réunions de suivi du projet.
