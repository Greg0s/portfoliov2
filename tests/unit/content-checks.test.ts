import { describe, expect, it } from 'vitest';
import {
  checkProjectCount,
  checkProjectFiles,
  checkProjectOrder,
  checkWallPictures,
  fitsFrame,
  shapeOf,
} from '../../src/lib/content-checks';
import { frames } from '../../src/lib/wall';

describe('checkProjectFiles', () => {
  it('accepts a project with its data and both texts', () => {
    expect(checkProjectFiles([{ slug: 'lyrix', files: ['project.yaml', 'fr.md', 'en.md', 'cover.jpg'] }])).toEqual([]);
  });

  it('names each missing file and where it belongs', () => {
    expect(checkProjectFiles([{ slug: 'lyrix', files: ['project.yaml', 'en.md'] }])).toEqual([
      'Project "lyrix" has no fr.md (src/content/projects/lyrix/fr.md).',
    ]);
    expect(checkProjectFiles([{ slug: 'obaine', files: ['fr.md', 'en.md'] }])).toEqual([
      'Project "obaine" has no project.yaml (src/content/projects/obaine/project.yaml).',
    ]);
  });
});

describe('checkProjectCount', () => {
  it('accepts as many projects as the journey has anchors, and says where to change it otherwise', () => {
    expect(checkProjectCount(7, 7)).toEqual([]);
    expect(checkProjectCount(8, 7)).toEqual([
      'Found 8 projects, but the journey is built for 7: set PROJECTS in src/scene/journey/anchors.ts.',
    ]);
  });
});

describe('checkProjectOrder', () => {
  it('accepts orders from 1 without a gap, in any file order', () => {
    expect(
      checkProjectOrder([
        { slug: 'b', order: 2 },
        { slug: 'a', order: 1 },
      ]),
    ).toEqual([]);
  });

  it('names the projects sharing an order', () => {
    expect(
      checkProjectOrder([
        { slug: 'a', order: 1 },
        { slug: 'b', order: 2 },
        { slug: 'c', order: 2 },
      ]),
    ).toEqual(['Projects "b" and "c" share order 2.']);
  });

  it('reports a gap once', () => {
    expect(
      checkProjectOrder([
        { slug: 'a', order: 1 },
        { slug: 'b', order: 3 },
        { slug: 'c', order: 4 },
      ]),
    ).toEqual(['Project orders must run from 1 without a gap: found 1, 3, 4.']);
  });
});

describe('the shape of a picture', () => {
  it('sorts aspect ratios into portrait, square, landscape and wide', () => {
    expect(shapeOf(2 / 3)).toBe('portrait');
    expect(shapeOf(1)).toBe('square');
    expect(shapeOf(4 / 3)).toBe('landscape');
    expect(shapeOf(16 / 9)).toBe('wide');
  });

  it('never turns a portrait into a landscape, nor 16:9 into a square, or back', () => {
    expect(fitsFrame(2 / 3, 4 / 5)).toBe(true);
    expect(fitsFrame(3 / 2, 16 / 9)).toBe(true);
    expect(fitsFrame(4 / 5, 4 / 3)).toBe(false);
    expect(fitsFrame(16 / 9, 2 / 3)).toBe(false);
    expect(fitsFrame(16 / 9, 1)).toBe(false);
    expect(fitsFrame(1, 16 / 9)).toBe(false);
  });
});

describe('checkWallPictures', () => {
  it('accepts a large enough picture of the frame’s shape', () => {
    expect(checkWallPictures([{ frame: 'film', file: 'still.webp', width: 1280, height: 720 }], frames)).toEqual([]);
  });

  it('refuses a picture under 600 px on its shorter side', () => {
    expect(checkWallPictures([{ frame: 'album', file: 'cover.webp', width: 500, height: 500 }], frames)).toEqual([
      'src/content/wall/album/cover.webp is 500 × 500 px: wall pictures need at least 600 px on their shorter side.',
    ]);
  });

  it('refuses a portrait picture in a landscape frame', () => {
    expect(checkWallPictures([{ frame: 'film', file: 'poster.jpg', width: 800, height: 1200 }], frames)).toEqual([
      'src/content/wall/film/poster.jpg is portrait (800 × 1200 px) but the "film" frame is wide: a picture never changes orientation.',
    ]);
  });

  it('refuses a folder that is no frame', () => {
    const [error] = checkWallPictures([{ frame: 'ceiling', file: 'a.jpg', width: 900, height: 900 }], frames);
    expect(error).toMatch(/^src\/content\/wall\/ceiling\/a\.jpg: no frame is called "ceiling"/);
  });
});
