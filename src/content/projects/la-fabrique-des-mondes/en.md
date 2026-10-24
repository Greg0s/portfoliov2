---
title: La Fabrique des Mondes
kind: Three.js · generative
role: 3D development, in a team
summary: 'A 3D god game where each element of the world embodies a mathematical process: strange attractors, L-systems, boids…'
lede: 'A 3D god game: you shape your own world, and each element in it embodies a mathematical process.'
coverAlt: A purple platform seen from above, covered with glowing strange attractors, cubes and generated plants.
---

## Context

A school project built as a team: a god game in the browser, where you shape your own world on a 3D platform. The
brief is what made it interesting: every element placed in the world had to embody a complex process.

## What I did

I built the Three.js scene and the interface for creating a world: the palette of objects, each with its own rotating
preview, placing and moving elements on the platform, and the screenshot. The world brings together eight processes:
strange attractors, the Sierpiński triangle, a fitness landscape, the travelling salesman problem, the Menger sponge,
L-systems, Wolfram’s cellular automaton and boids.

## Technical challenges

Eight very different processes had to live in the same scene, stay interactive, and be handled the same way.

:::challenge[Eight processes in one world]
::problem[Each process has its own logic: points following an equation, recursive fractals, a genetic algorithm, agents moving as a flock.]
::solution[Each process lives in its own module, which returns a Three.js object ready to place. The scene only knows that object, and the palette reuses the same module for each element’s animated preview.]
::result[A new process can be added without touching the rest of the world, and the user handles them all the same way.]
:::

:::challenge[Selecting objects made of thousands of lines]
::problem[Clicking a strange attractor or an L-system means aiming at lines a few pixels wide: raycasting against the geometry itself is imprecise and costly.]
::solution[Each element carries a simple, invisible selection box that the raycaster targets; the transform handles attach to it.]
::result[Selecting and moving stay precise and smooth, however complex the object.]
:::
