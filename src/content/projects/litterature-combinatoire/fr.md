---
title: Littérature & Combinatoire
kind: Web · temps réel · vidéo
role: Maquette, back-end, front-end et vidéo
summary: Une exposition, un site qui génère des textes par combinaison en temps réel, et sa vidéo promotionnelle.
coverAlt: Le titre Littérature & Combinatoire, en lettres géométriques noires, sur un dégradé pastel.
---

## Contexte

Un projet d’école mené à quatre, avec Emma Veauvy, Juliette Jeannin et Lucie Augier, autour de la littérature
combinatoire : des textes qui naissent de la combinaison de fragments, dans l’esprit des _Cent mille milliards de
poèmes_ de Raymond Queneau. Le projet réunissait une exposition, un site interactif et une vidéo pour le faire connaître.

## Ce que j’ai fait

J’ai participé à la maquette, puis développé avec l’équipe le back-end (une API PHP sur Slim, adossée à une base SQL)
et le front-end du site, qui compose à la demande des sonnets, des haïkus, des contes et des récits. J’ai aussi
réalisé la vidéo promotionnelle, du tournage au montage sous Premiere Pro et After Effects.

## Défis techniques

Le même texte devait vivre sur un écran d’exposition et dans la main des visiteurs.

:::challenge[Piloter l’écran de l’exposition depuis un téléphone]
::problem[Dans l’exposition, les visiteurs devaient mélanger eux-mêmes les bristols affichés sur grand écran, sans toucher à l’écran.]
::solution[Un petit serveur Node.js avec Socket.io relaie chaque geste fait sur la page mobile vers la page de l’exposition, qui tire aussitôt une nouvelle série.]
::result[Un toucher sur le téléphone recompose le texte sur l’écran, en temps réel.]
:::

:::challenge[Des textes qui tiennent debout]
::problem[Combiner des fragments au hasard donne vite des phrases bancales : il fallait garder la forme de chaque genre, du vers du sonnet au déroulé du conte.]
::solution[Les fragments sont rangés en base par genre et par place dans le texte ; l’API tire une combinaison place par place, et chaque genre a sa page qui explique sa règle.]
::result[Chaque génération respecte la forme de son genre, et le visiteur comprend comment elle est née.]
:::
