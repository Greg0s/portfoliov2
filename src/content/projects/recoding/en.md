---
title: Recoding
kind: Generative art
role: Development, in a pair
summary: Generative and interactive art in p5.js and TypeScript, made as a pair.
coverAlt: A grid of small black shapes made of horizontal and vertical lines, on a white background.
---

## Context

An algorithmic aesthetics project made as a pair with Emma Veauvy: recoding a pioneering work of computer art, Georg
Nees’s _23-Ecke_, then making it interactive.

## What I did

We wrote the program in p5.js and TypeScript: a grid of 23-vertex polygons, each drawn at random within its cell.
Settings change the number of rows, columns and vertices, pick a seed and download the resulting image.

## Technical challenges

Finding the rule behind the image, then handing it over to play with.

:::challenge[Finding Georg Nees’s gesture]
::problem[Each shape of the original work is made only of horizontal and vertical lines, which stay in their cell and close on themselves.]
::solution[Each new vertex changes one coordinate at a time, alternating x and y, drawn within three quarters of the cell; the last line goes back to the first vertex.]
::result[The program finds the look of the 1965 work, and makes endless variations of it.]
:::

:::challenge[Randomness you can replay]
::problem[A random image is lost as soon as it is redrawn, when you want to compare and keep a composition.]
::solution[Randomness starts from a seed chosen in the settings: the same seed gives exactly the same image back, whatever the other settings.]
::result[You explore variations while keeping the ones you like, and can download them.]
:::
