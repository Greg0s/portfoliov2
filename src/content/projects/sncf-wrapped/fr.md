---
title: SNCF Wrapped
kind: Récit de données
role: Conception, design et développement
summary: Votre année en train racontée écran par écran, sans qu’aucune donnée ne quitte votre navigateur.
coverAlt: L’accueil de SNCF Wrapped, « Le palmarès de vos années de voyage », en blanc sur fond sombre.
cta: Essayer SNCF Wrapped
stats:
  - { value: '0', label: donnée envoyée hors du navigateur }
outcomes:
  - 'La confidentialité : une contrainte vérifiée à chaque modification, pas une promesse.'
  - 'Des chiffres honnêtes, pour un trajet par an comme pour un abonné.'
did:
  - Lecture du fichier et calculs
  - Textes de chaque écran
  - Design et animations
  - Aide pour demander ses données
  - Outils de test sans vraies données
challenges:
  - { title: 'Ne rien envoyer, et le prouver', text: Un test échoue si une API réseau apparaît dans le code. }
  - {
      title: Raconter avec un fichier incomplet,
      text: 'Des distances estimées, et des centaines de profils fictifs testés.',
    }
---

Un projet personnel, non officiel : faire pour le train ce que les bilans de fin d’année font pour la musique. On
importe ses données SNCF Connect, obtenues grâce au RGPD, et le site raconte son année de voyages, écran par écran,
jusqu’à une carte à partager.
