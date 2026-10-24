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
the proximity hints, the installable app, and the tests, unit and end-to-end.

## Technical challenges

A game whose answer must stay secret, hints that understand meaning, and games shared live.

:::challenge[Keeping the lyrics secret]
::problem[If the lyrics reach the browser, opening the developer tools is enough to win.]
::solution[The Worker keeps the lyrics and only ever sends masked words: it only says where a guessed word appears, never which word hides in each place.]
::result[The game stays fair, even for a player who inspects the network.]
:::

:::challenge[Hints that understand meaning]
::problem[A word missing from the lyrics still had to say how close it is, without running a language model on every guess.]
::solution[Proximities are precomputed offline with French word embeddings, then stored in Workers KV as one table per song; the score is a rank (80: among a hidden word’s 10 nearest neighbours).]
::result[Every guess gets an instant hint about meaning, and a close enough word is written in place of the hidden one.]
:::

:::challenge[Playing together in real time]
::problem[Players in the same room must see each other’s finds as they happen.]
::solution[Each room is a Cloudflare Durable Object, which keeps the game state and its members connected over WebSockets.]
::result[A room is created on the fly, and every find shows up for all players at once.]
:::
