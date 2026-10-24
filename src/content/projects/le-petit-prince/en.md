---
title: Le Petit Prince
kind: 3D animation
role: 3D modelling and animation
summary: 'A short 3D animation made in Blender: the one that opens this site.'
coverAlt: The Little Prince and the fox sitting on his small grey planet, in a blue sky scattered with stars and yellow planets.
---

## Context

A short 3D animation about _The Little Prince_: the prince, the fox and the rose on their planet, in a sky of stars
and planets.

## What I did

I modelled, shaded and animated the scene in Blender: the characters, the planet, the rose in the wind, the floating
scarf, the stars and the shooting star. That planet now opens this portfolio, rendered in real time in the browser.

## Technical challenges

Bringing a scene designed for Blender’s renderer into a web page, without losing its look.

:::challenge[From Blender to the browser]
::problem[The scene’s export weighed 16 MB and 446,000 triangles, far too much to open a website.]
::solution[An optimisation pipeline welds vertices, simplifies each object according to its role (the scenery a lot, the characters not at all), then quantises and compresses the meshes.]
::result[0.56 MB and 56,000 triangles, with no visible difference, and the 26 original animations.]
:::

:::challenge[A material glTF cannot carry]
::problem[The planet’s relief and the curls of the hair came from Blender materials, which the glTF format cannot export.]
::solution[They are generated on load: a bumpy simplex-noise surface and craters for the planet, crumpled curls for the hair, with a fixed seed.]
::result[The planet is always the same, as detailed as in Blender, for a few lines of code.]
:::
