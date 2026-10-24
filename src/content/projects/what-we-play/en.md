---
title: What we play?
kind: Web · CSS 3D
role: Concept, design and development
summary: Find an online game to play together, guided by a TV character that reacts to everything you do.
coverAlt: The What we play? logo in a speech bubble, next to an old Mac with a TV face and four coloured pawns.
---

## Context

A personal project born from a question every game night asks: what do we play, with how many, without installing
anything? The site answers in one key press: give the number of players and it suggests free online games that fit.

## What I did

Everything, from the mockup to going live: a TV character that reacts to what the user does and speaks in its bubble,
a keypad to choose, a 3D mode where the TV becomes a pure-CSS 3D Mac with one animated pawn per player, light and dark
themes, three languages (English, French, Spanish) and a search that ignores accents.

## Technical challenges

A heavily illustrated site that had to stay fast, be found by search engines, and never flicker on load.

:::challenge[Being found in three languages]
::problem[A React app rendered in the browser reaches search engines empty, and every page exists in three languages and for every player count.]
::solution[The 33 pages are prerendered at build time from a single table of typed routes, which also generates canonical links, hreflang alternates, the sitemap and structured data; the build fails if a language misses a key.]
::result[Every page arrives complete and described, and adding a language or a player count updates the whole site at once.]
:::

:::challenge[No flash, no jump on load]
::problem[The dark theme and the 3D mode are remembered in the browser, but React only reads them after the first paint: the page first showed up light and flat.]
::solution[A small inline script in the head reads those preferences before the first render and sets them on the page, with the same logic as the app.]
::result[The page shows up in the right theme and mode straight away, without flickering.]
:::
