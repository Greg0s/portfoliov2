import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { VFile } from 'vfile';
import { describe, expect, it } from 'vitest';
import { rehypeSections } from '../../src/lib/markdown/sections';

function toHtml(markdown: string, path = 'src/content/projects/lyrix/fr.md'): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeSections)
      .use(rehypeStringify)
      .processSync(new VFile({ value: markdown, path })),
  );
}

describe('rehypeSections', () => {
  it('wraps each ## and what follows in a labelled section', () => {
    const html = toHtml('## Ce que j’ai fait\n\nTout.\n\n## Défis techniques\n\nDeux.');
    expect(html).toContain(
      '<section class="case-section" aria-labelledby="ce-que-j-ai-fait"><h2 id="ce-que-j-ai-fait">Ce que j’ai fait</h2><div class="case-body">',
    );
    expect(html).toContain('<h2 id="defis-techniques">Défis techniques</h2>');
  });
});
