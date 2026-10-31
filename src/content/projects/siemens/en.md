---
title: Siemens
kind: Web internship · Industry 4.0
role: Web design and development
summary: Making it easier to configure and monitor industrial additive manufacturing processes live.
coverAlt: A robotic welding arm laying metal on a large circular part, under a green light (the WAAM process).
---

## Context

In an international, multidisciplinary team of about twenty people working in English, I helped build live monitoring
tools for metal 3D printing (WAAM and SLM). The goal: detect errors, optimise the process and get it ready to scale to
new production methods.

![The Siemens buildings in Neuperlach-Süd, Munich, behind an avenue lined with trees and yellow flowers.](./campus.webp 'The Siemens site in Neuperlach-Süd, Munich.')

## What I did

- A complete application that generates complex configuration files (JSON) from a node-based interface (React,
  React Flow), validating their structure with JSON Schema.
- Extending the in-house software to monitor a new process (SLM), with modular views to browse stacks of 2D bitmaps.
- Evolving an existing live monitoring interface, connected to an API over WebSockets (Vue.js, Vuex).
- UX and UI improvements, and interactive time-series charts synced with the video at precise points (Plotly).

![A diagram of the node editor: on the left, nodes linked in a graph; on the right, the configuration file they produce.](./node-graph.webp 'How the node editor works: a graph of nodes, a validated configuration file.')

## Technical challenges

Handling tasks on my own in a complex existing project, adapting to a rigorous industrial environment (Docker, Git), and
meeting the specific needs of researchers with very different profiles.

## Results

- A configuration tool the team actively uses to move its research and master’s theses forward.
- New monitoring interfaces built into the shared software, extending live monitoring to other printing processes.
- The interactive time-series charts presented to management in the project’s review meetings.
