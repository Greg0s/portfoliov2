---
title: SNCF Wrapped
kind: Data storytelling
role: Concept, design and development
summary: Your year on the train told screen by screen, without any data leaving your browser.
coverAlt: The SNCF Wrapped home, “Le palmarès de vos années de voyage”, in white on a dark background.
---

## Context

A personal, unofficial project: doing for trains what year-end recaps do for music. You import the export of your SNCF
Connect personal data, obtained through the GDPR, and the site tells your distance, budget, cities, routes and booking
habits, screen by screen, down to a card to share.

## What I did

The whole project: reading the file, the calculations, writing the text of each screen, the design and animations, the
page that helps request your data, and the tools to test without ever using real data.

## Technical challenges

Very personal data, an incomplete file, and hundreds of different traveller profiles.

**Sending nothing, and proving it.** The export holds the traveller’s identity, address and phone number: it must never
leave their browser. No server, no account, no tracking, no third-party font: everything is computed in the page. An
automated test fails if a network API shows up in the app’s code.

**Telling a story from an incomplete file.** The export lists bookings, but no delays, durations or distances. Distances
are estimated as the crow flies between stations, plus 20%, and shown as an estimate; hundreds of randomly generated
fake exports check that every screen stays right whatever the profile.

## Results

- Privacy is not a promise but a constraint checked on every change.
- Honest figures, and a story that holds for one trip a year as well as for a commuter.
