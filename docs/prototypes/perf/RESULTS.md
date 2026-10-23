# Performance measurement: results

- **Date**: 23 October 2026
- **Bench**: `docs/prototypes/perf/` (see its README), runs saved in the artifact's `runs` collection.
- **Decides**: how the office is drawn (main spec §6.5) and how the cards are drawn (main spec §7.4).

## Devices

| Device       | GPU                                    | Screen                     | Browser                         | Runs                  |
| ------------ | -------------------------------------- | -------------------------- | ------------------------------- | --------------------- |
| PC portable  | Intel integrated graphics (Direct3D 11) | 1536 × 960 at ×1.25, 60 Hz | Edge 155, window 949 × 702      | plugged in, on battery |
| Pixel 9      | Mali-G715                              | 412 × 924 at ×2.625, 60 Hz | Claude app (Android WebView 155) | on battery            |

## Frame rates

Frames per second per phase, then the share of frames over 25 ms. Every display ran at 60 Hz.

| Test                          | Laptop, plugged in | Laptop, battery   | Pixel 9            |
| ----------------------------- | ------------------ | ----------------- | ------------------ |
| Office live, arrival          | 60 · 0 %           | 40 · 6 % ¹        | 42 · 3 % ²         |
| Office live, seated           | 60 · 0 %           | 54 · 6 % ¹        | 60 · 0 %           |
| Office live shadows, arrival  | 59 · 1 %           | 54 · 10 %         | 55 · 3 %           |
| Office live shadows, seated   | 60 · 0 %           | 60 · 0 %          | 60 · 0 %           |
| Office layers, arrival        | 60 · 0 %           | 59 · 1 %          | 44 · 27 %          |
| Office layers, seated         | 60 · 0 %           | 60 · 0 %          | 59 · 2 %           |
| Journey CSS, opening          | 58 · 1 %           | 60 · 0 %          | 50 · 13 %          |
| Journey CSS, projects         | 58 · 1 %           | 59 · 1 %          | 46 · 20 %          |
| Journey WebGL, opening        | 60 · 0 %           | 58 · 1 %          | 51 · 15 %          |
| Journey WebGL, projects       | 58 · 1 %           | 60 · 0 %          | 47 · 20 %          |

¹ First test of the battery run, interrupted once (a gap over a second): the laptop was probably still leaving its
power-saving state.
² The median frame is 16.7 ms: the arrival loses its rate to a few long frames (up to 550 ms), not to a slow scene.
The same scene with shadows recomputed at every frame, run just after, does better (55), so these long frames are
first-time costs (shaders, buffer uploads) that the second test no longer pays.

## Load and memory

| Test          | Laptop, plugged in                         | Pixel 9                                     |
| ------------- | ------------------------------------------ | ------------------------------------------- |
| Office live   | town built in 0.56 s, first frame 0.2 s; about 150 MB of GPU memory (65 MB of geometry, 880,000 triangles) | town built in 1.0 s, first frame 0.45 s; about 140 MB |
| Office layers | layers decoded in 0.1 s; 52 MB of decoded images, 638 kB downloaded | 0.65 s; 23 MB, 282 kB downloaded |
| Journey       | planet built in 0.83 s; about 70 MB        | planet built in 1 to 1.9 s; about 50 MB     |

## What the results say

1. **The office can run in real time.** Seated, it holds 60 fps on both devices, shadows frozen or not. The only
   weak point is the arrival on first view, and its long frames come from first-time costs that a warm-up before the
   arrival removes (draw the whole scene once, culling off, while the visitor is still in the journey: `office-live-warm`
   in the bench, where the first frame drops from 450 ms to under 10 ms in headless Chromium).
2. **The layers are not cheaper on the phone.** Their arrival animates four large images with blend modes and drops to
   44 fps with 27 % slow frames on the Pixel 9, worse than the real-time scene. They stay the fallback, not the main
   path.
3. **Shadows recomputed at every frame cost nothing visible on these devices**, but the scene does not move: frozen
   shadows stay the rule, they leave headroom for weaker machines.
4. **CSS and WebGL cards perform the same** on both devices (within 1 fps). The cards stay in HTML and CSS, as in the
   mockup: accessible, clickable, and simpler.
5. **The journey is short of 60 fps on the phone (46 to 51), whatever draws the cards.** The cost is elsewhere:
   the stars, the small worlds blurred in CSS at the phone's full pixel density, or the video. The diagnostic run of
   the bench (`journey-plain`, `journey-novideo`, `journey-noworlds`, `journey-nostars`) isolates it.
6. **Building the town blocks the main thread for 0.6 to 1 s.** Built during the journey it would freeze the scroll.
   It has to be built off the main thread (a worker) or baked at build time into a compressed model.

## Recommendation

- **Office**: real time on every device that keeps up, with the town prepared off the main thread, a warm-up before
  the arrival, frozen shadows, and the automatic switch to the layers (and the light version) when the first seconds
  stay under 40 fps; the layers also serve without WebGL and with reduced motion (main spec §6.5, "mix" option, with
  the switch decided by the measured rate rather than by the kind of device).
- **Cards**: HTML and CSS (main spec §7.4, the default).
- **Journey on phones**: decided by the diagnostic run.
- **Layers budget**: lighten the windows layer (246 kB) to bring a computer set under 500 kB, since the layers remain
  the fallback.
