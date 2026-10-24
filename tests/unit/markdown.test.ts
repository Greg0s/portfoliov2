import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { VFile } from 'vfile';
import { describe, expect, it } from 'vitest';
import { remarkChallenge } from '../../src/lib/markdown/challenge';
import { rehypeSections } from '../../src/lib/markdown/sections';

function toHtml(markdown: string, path = 'src/content/projects/lyrix/fr.md'): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkDirective)
      .use(remarkChallenge)
      .use(remarkRehype)
      .use(rehypeSections)
      .use(rehypeStringify)
      .processSync(new VFile({ value: markdown, path })),
  );
}

const challenge = `:::challenge[Keep the lyrics secret]
::problem[The browser sees everything.]
::solution[The server keeps them.]
::result[Fair games.]
:::`;

describe('the :::challenge directive', () => {
  it('becomes a numbered article in three beats, labelled in the file’s language', () => {
    const html = toHtml(`${challenge}\n\n${challenge}`);
    expect(html).toContain(
      '<article class="challenge"><p class="challenge-number">01</p><h3>Keep the lyrics secret</h3>',
    );
    expect(html).toContain('<p class="challenge-number">02</p>');
    expect(html).toContain('<dl><dt>Problème</dt><dd>The browser sees everything.</dd><dt>Solution</dt>');
    expect(toHtml(challenge, 'src/content/projects/lyrix/en.md')).toContain('<dt>Problem</dt>');
  });

  it('fails on a missing beat or title', () => {
    expect(() => toHtml(':::challenge[Title]\n::problem[A]\n::solution[B]\n:::')).toThrow('has no ::result');
    expect(() => toHtml(':::challenge\n::problem[A]\n::solution[B]\n::result[C]\n:::')).toThrow('needs a title');
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
