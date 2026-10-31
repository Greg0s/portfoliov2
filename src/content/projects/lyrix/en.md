---
title: Lyrix
kind: Multiplayer game
role: Concept and development
summary: Find a song from its hidden lyrics, alone or with others in real time.
coverAlt: The Lyrix logo, “Retrouve la chanson du jour à partir de ses paroles cachées”, above orange and grey bars.
---

## Context

A free web game inspired by Pedantix, built on song lyrics instead of Wikipedia articles: you type words to
progressively reveal the lyrics, and the round is won once the title is fully uncovered. You play alone, or with others
in a live room.

![A game of Lyrix on a computer: the title “Les Démons de minuit” found, the lyrics still hidden under orange bars, the guessed words and the hints on the right.](./game.webp 'A round won: the title is found, some lyrics are left to uncover.')

## What I did

The whole project: the React and TypeScript front end, the API on Cloudflare Workers with Hono, the multiplayer rooms,
the proximity hints, the installable app (PWA), the art direction, and the tests, unit and end-to-end.

![Lyrix in its light theme: the song of the day to guess, its verses hidden under pale orange bars, and the field to guess a word.](./light.webp 'The light theme, on the song of the day.')

## Technical challenges

A game that is appealing, easy to pick up and smooth. Playing together in real time. All of the players’ data kept
locally, in the browser.

![The window of a multiplayer room: the room code, Z9YK9N, to share, the list of players and the button to start the game.](./room.webp 'A multiplayer room: a code to share, and everyone’s finds live.')

## Results

- An original game that already wins over many players.
- A new song every day, and the songs of the last 30 days still playable.

![The Lyrix archives: a grid of the last 30 days, the songs found shown in full, the others still to play.](./archives.webp 'The archives: the last 30 days, to catch up on.')
