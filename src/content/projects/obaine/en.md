---
title: Obaine
kind: Front end
role: Front-end development
summary: The front end of a platform where fans fund athletes in exchange for exclusive content.
coverAlt: 'The Obaine home page: “Accédez à des expériences uniques”, an athlete in a frame and a crowd of fans in pink silhouettes.'
---

## Context

Obaine is a platform where fans support athletes financially, in exchange for exclusive content and experiences. I
built its front end from the team’s designs.

## What I did

The home, actions and all-athletes pages, with their carousels, the header that changes between desktop and mobile,
the API connection, the shared athlete state and navigation between pages, in Vue 3 with Pinia and Vue Router, tested
with Vitest and shipped in Docker.

## Technical challenges

A very visual interface, full of carousels, that had to stay consistent from page to page.

:::challenge[The same data on every page]
::problem[The list of athletes fed the home page, the carousels and the all-athletes page: loading it on each page multiplied the calls.]
::solution[A Pinia store loads the athletes once from the API and shares them across components and pages.]
::result[A single call, and pages that stay in step with each other.]
:::

:::challenge[Carousels true to the designs]
::problem[The designs called for different carousels depending on the section and the screen size.]
::solution[Reusable carousel components, built on Swiper and tuned per section, with a mobile and a desktop version.]
::result[Pages true to the designs, on phones as on desktops.]
:::
