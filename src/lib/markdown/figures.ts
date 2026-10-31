/**
 * The images of a case study (main spec §4). A paragraph holding only images becomes a `<figure>`: one image on its
 * own, or several side by side, cropped to the same format. The title of the first image is the caption:
 *
 * ```md
 * ![The home page](./home.webp "The home page, on a computer.")
 *
 * ![Count](./count.webp "On a phone: the players, then the draw.") ![Draw](./draw.webp)
 * ```
 *
 * Each image gets the widths and sizes Astro needs for its `srcset`, and loads lazily.
 */
import type { Element, ElementContent, Root } from 'hast';

/** The widths of the srcset; Astro drops those over the image's own and keeps its own. */
const WIDTHS = [400, 800, 1200, 1600];

/** The text column is 7/10 of 1100 px less the gap, at most; a row shares it. */
function sizesFor(count: number): string {
  const column = Math.round(728 / count);
  return `(width < 768px) calc((100vw - 40px) / ${String(count)}), ${String(column)}px`;
}

function isBlank(node: ElementContent): boolean {
  return node.type === 'text' && node.value.trim() === '';
}

function isImage(node: ElementContent): node is Element {
  return node.type === 'element' && node.tagName === 'img';
}

export function rehypeFigures() {
  return (tree: Root): void => {
    tree.children = tree.children.map((node) => {
      if (node.type !== 'element' || node.tagName !== 'p') return node;
      const content = node.children.filter((child) => !isBlank(child));
      if (content.length === 0 || !content.every(isImage)) return node;

      const caption = content.map((image) => image.properties.title).find((title) => typeof title === 'string');
      for (const image of content) {
        delete image.properties.title;
        // Astro's image step reads these as the options of `getImage`: `widths` is an array there, not an attribute.
        Object.assign(image.properties, { widths: WIDTHS, sizes: sizesFor(content.length), loading: 'lazy' });
      }
      const figure: Element = {
        type: 'element',
        tagName: 'figure',
        properties: { className: content.length > 1 ? ['case-figure', 'case-figure-row'] : ['case-figure'] },
        children: [
          { type: 'element', tagName: 'div', properties: { className: ['case-figure-media'] }, children: content },
        ],
      };
      if (caption) {
        figure.children.push({
          type: 'element',
          tagName: 'figcaption',
          properties: {},
          children: [{ type: 'text', value: caption }],
        });
      }
      return figure;
    });
  };
}
