---
title: Littérature & Combinatoire
kind: Web · real time · video
role: Mockup, back end, front end and video
summary: An exhibition, a site that generates texts by combination in real time, and its promotional video.
coverAlt: The title Littérature & Combinatoire, in black geometric letters, on a pastel gradient.
---

## Context

A school project for four, with Emma Veauvy, Juliette Jeannin and Lucie Augier, about combinatorial literature: texts
born from combining fragments, in the spirit of Raymond Queneau’s _Hundred Thousand Billion Poems_. The project brought
together an exhibition, an interactive website and a video to promote it.

## What I did

I worked on the mockup, then built with the team the back end (a PHP API on Slim, backed by an SQL database) and the
front end of the site, which composes sonnets, haikus, tales and stories on demand. I also made the promotional video,
from the shoot to the edit in Premiere Pro and After Effects.

## Technical challenges

The same text had to live on an exhibition screen and in the visitors’ hands.

:::challenge[Driving the exhibition screen from a phone]
::problem[In the exhibition, visitors had to shuffle the cards shown on a big screen themselves, without touching the screen.]
::solution[A small Node.js server with Socket.io relays every gesture made on the mobile page to the exhibition page, which draws a new series at once.]
::result[A tap on the phone recomposes the text on the screen, in real time.]
:::

:::challenge[Texts that hold together]
::problem[Combining fragments at random quickly gives lame sentences: each genre had to keep its form, from the sonnet’s lines to the tale’s course.]
::solution[Fragments are stored by genre and by place in the text; the API draws a combination place by place, and each genre has a page explaining its rule.]
::result[Each generation keeps the form of its genre, and visitors understand how it came about.]
:::
