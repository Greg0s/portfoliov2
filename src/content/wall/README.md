# The wall pictures

One folder per frame of the office wall, named after the frame's `id` in `src/lib/wall.ts` (`film`, `painting`,
`poster`, `photo-portrait`, `photo-landscape`, `album`, `desk`). Each picture is a web version (`pnpm optimize-media`
makes them from the originals kept in `.design-assets/wall/`) with a `.yaml` of the same name:

```yaml
image: ./still.webp
title: { fr: Le Voyage de Chihiro, en: Spirited Away } # or a plain string; optional
originalTitle: Sen to Chihiro no Kamikakushi # optional
author: Hayao Miyazaki # optional
place: Louvre, Paris # optional, where a photo was taken
year: 2001 # optional
credit: Studio Ghibli # optional, required by some pictures
focus: 50% 40% # optional, the point kept when cropping
```

The build fails if a picture is under 600 px on its shorter side or does not fit its frame's orientation.
