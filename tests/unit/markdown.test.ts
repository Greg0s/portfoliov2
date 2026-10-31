import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { VFile } from 'vfile';
import { describe, expect, it } from 'vitest';
import { rehypeFigures } from '../../src/lib/markdown/figures';
import { rehypeSections } from '../../src/lib/markdown/sections';

function toHtml(markdown: string, path = 'src/content/projects/lyrix/fr.md'): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeFigures)
      .use(rehypeSections)
      .use(rehypeStringify)
      .processSync(new VFile({ value: markdown, path })),
  );
}

describe('rehypeFigures', () => {
  it('turns a paragraph of one image into a figure, its title the caption', () => {
    const html = toHtml('![The home](./home.webp "The home page.")');
    expect(html).toContain(
      '<figure class="case-figure"><div class="case-figure-media"><img src="./home.webp" alt="The home"',
    );
    expect(html).toContain('<figcaption>The home page.</figcaption></figure>');
    expect(html).not.toContain('title=');
  });

  it('sets the images of a row side by side, sharing the column', () => {
    const html = toHtml('![A](./a.webp "Two phones.") ![B](./b.webp)');
    expect(html).toContain('<figure class="case-figure case-figure-row">');
    expect(html.match(/<img /g)).toHaveLength(2);
    expect(html).toContain('364px');
  });

  it('leaves a paragraph with text alone', () => {
    expect(toHtml('Some text ![A](./a.webp)')).toContain('<p>Some text <img');
  });
});

describe('rehypeSections', () => {
  it('wraps each ## and what follows in a labelled section', () => {
    const html = toHtml('## Ce que j’ai fait\n\nTout.\n\n## Défis techniques\n\nDeux.');
    expect(html).toContain(
      '<section class="case-section" aria-labelledby="ce-que-j-ai-fait"><h2 id="ce-que-j-ai-fait">Ce que j’ai fait</h2><div class="case-body">',
    );
    expect(html).toContain('<h2 id="defis-techniques">Défis techniques</h2>');
  });
});
