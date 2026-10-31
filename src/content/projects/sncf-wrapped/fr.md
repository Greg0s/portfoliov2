---
title: SNCF Wrapped
kind: Récit de données
role: Conception, design et développement
summary: Votre année en train racontée écran par écran, sans qu’aucune donnée ne quitte votre navigateur.
coverAlt: L’accueil de SNCF Wrapped, « Le palmarès de vos années de voyage », en blanc sur fond sombre.
---

## Contexte

Un projet personnel, non officiel : faire pour le train ce que les bilans de fin d’année font pour la musique. On
importe l’export de ses données personnelles SNCF Connect, obtenu grâce au RGPD, et le site raconte ses kilomètres, son
budget, ses villes, ses itinéraires et sa façon de réserver, écran par écran, jusqu’à une carte à partager.

## Ce que j’ai fait

Tout le projet : la lecture du fichier, les calculs, l’écriture des textes de chaque écran, le design et les
animations, la page qui aide à demander ses données, et les outils pour tester sans jamais utiliser de vraies données.

## Défis techniques

Des données très personnelles, un fichier incomplet, et des centaines de profils de voyageurs différents.

**Ne rien envoyer, et le prouver.** L’export contient l’identité, l’adresse et le téléphone du voyageur : il ne devait
jamais quitter son navigateur. Pas de serveur, pas de compte, pas de traçage, pas de police tierce : tout se calcule
dans la page. Un test automatique échoue si une API réseau apparaît dans le code de l’application.

**Raconter avec un fichier incomplet.** L’export liste les commandes, mais ni les retards, ni les durées, ni les
distances. Les kilomètres sont estimés à vol d’oiseau entre les gares, majorés de 20 % et présentés comme une
estimation ; des exports fictifs générés au hasard, par centaines, vérifient que chaque écran reste juste quel que soit le profil.

## Résultats

- La confidentialité n’est pas une promesse mais une contrainte vérifiée à chaque modification.
- Des chiffres honnêtes, et un récit qui tient aussi bien pour un trajet par an que pour un abonné.
