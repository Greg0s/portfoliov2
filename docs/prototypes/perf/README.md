# Prototype: performance measurement

Step 1 of the main spec (§11). This folder builds a test bench that plays the heaviest moments of the site on a real
device and records the frame rate, slow frames, memory and load times. Its results decide how the office is drawn
(real time, pre-rendered layers or a mix, main spec §6.5) and how the cards are drawn (CSS or WebGL, main spec §7.4).

The bench is published as a private artifact so that Grégoire can run it on his phone and his computer; each run is
saved in the artifact's database, where Claude reads it back.

## The tests

| Test                  | What it plays                                                                                              | Duration |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| `office-live`         | the office scene of `../bureau/scene.js` in real time: the arrival through the window, then the seat with the head moving; the screen and the pictures in HTML, set in perspective at every frame; shadows computed once | 14 s |
| `office-live-shadows` | the same, with the shadow maps recomputed at every frame (the worst case)                                   | 14 s     |
| `office-layers`       | the pre-rendered layers of the mockup (`../bureau/layers.mjs`): the arrival, the head moving each layer by its own amount, windows lighting up, the live sky and its stars | 14 s |
| `journey-css`         | the planet live in Three.js (relief, spot and shadow, bloom, animations, scarf in the wind), three layers of stars, the small worlds and the eight cards in CSS 3D with `filter: blur()`; the sharp card plays its video | 25 s |
| `journey-webgl`       | the same journey with the cards as planes in one WebGL canvas, blurred in the shader, the planet drawn into a texture | 25 s |

The framing follows the screen: portrait uses the mobile framing and layout. The pixel ratio is capped as the site will
cap it (2 on a computer, 1.5 on a phone). The project videos are stand-ins made with ffmpeg (6 s loops at 1280 × 720,
2.5 Mbit/s); the rose on the desk is the simplified one.

## What a run records

For each test and each phase (arrival and seat for the office, opening and projects for the journey): frames per
second, the median, 95th and 99th percentile frame times, the share of frames over 25 ms, and the display's refresh
rate. Then the load (import, scene building, first frame including shader compilation, long tasks on the main
thread), the JavaScript heap (Chromium only), an estimate of the GPU memory (geometry, textures, drawing buffer,
shadow maps), draw calls and triangles, and the bytes transferred.

## Use

```sh
npm install
(cd ../bureau && npm install && npm run serve &) && (cd ../bureau && npm run layers)   # the office layers, once
npm run build        # dist/: the bundles, the model, the layers, the videos, sizes.json
npm run serve        # http://localhost:8767/
npm run check        # every test in headless Chromium, desktop and phone, screenshots in renders/check/
```

Headless Chromium renders WebGL on the CPU: `npm run check` shows that the tests run and what they draw, never how fast
a device is. Only runs on real devices count.

## Publishing the bench

The bench is published at https://claude.ai/artifact/5BV19cwdwXUUwjUDyuKC2W (private). The artifact's page is
`launcher.html`; its files are those of `dist/` (`run.html`, `app/`, `models/`, `layers/`,
`media/`). It declares the `db` capability: each run is a document of the `runs` collection.

## What is already known without a device

Measured on the build and in headless Chromium (23 October 2026), before any run on a real device:

- **Code** (gzip): Three.js core 159 kB, shared by every scene; the real-time office adds 117 kB (`scene.js` and the
  LTC tables of `RectAreaLightUniformsLib`); the planet and the journey add 33 kB (glTF loader, Meshopt decoder,
  bloom). The pre-rendered office adds 2 kB.
- **Real-time office**: about 880,000 triangles and 65 MB of geometry once built, with 10 MB of textures; building
  the town takes about 1.1 s of main-thread work in one block (a long task that would freeze the journey if the scene
  were built while the visitor scrolls). Budget-wise, the code alone (117 kB) fits the office's 500 kB, the geometry
  is built on the device.
- **Pre-rendered office**: one moment and one framing weigh 564 to 601 kB on a computer (over the 500 kB budget, the
  windows layer alone is 246 kB) and 226 to 245 kB on a phone.
- **Planet**: 550 kB of model; building the relief takes 1 to 2 s on the CPU in headless Chromium.
