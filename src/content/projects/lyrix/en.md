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

## What I did

The whole project: the React and TypeScript front end, the API on Cloudflare Workers with Hono, the multiplayer rooms,
the proximity hints, the installable app (PWA), the art direction, and the tests, unit and end-to-end.

## Technical challenges

A game that is appealing, easy to pick up and smooth. Playing together in real time. All of the players’ data kept
locally, in the browser.

## Results

- An original game that already wins over many players.
- A new song every day, and the songs of the last 30 days still playable.
