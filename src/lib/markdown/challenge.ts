/**
 * The `:::challenge` directive of the case studies (main spec §4): each technical challenge in three beats, problem,
 * solution and result.
 *
 * ```md
 * :::challenge[Keep the eight processes at 60 fps]
 * ::problem[What went wrong.]
 * ::solution[What I did.]
 * ::result[What it gave.]
 * :::
 * ```
 *
 * It becomes an `<article class="challenge">` with its number, its title and a definition list. The labels follow the
 * language of the file (`fr.md` or `en.md`).
 */
import type { Root, RootContent, PhrasingContent } from 'mdast';
import type { ContainerDirective, LeafDirective } from 'mdast-util-directive';
import type { VFile } from 'vfile';

const beats = ['problem', 'solution', 'result'] as const;
type Beat = (typeof beats)[number];

const labels: Record<'fr' | 'en', Record<Beat, string>> = {
  fr: { problem: 'Problème', solution: 'Solution', result: 'Résultat' },
  en: { problem: 'Problem', solution: 'Solution', result: 'Result' },
};

function localeOf(file: VFile): 'fr' | 'en' {
  return /(?:^|[/\\])en\.md$/.test(file.path) ? 'en' : 'fr';
}

function isLabel(node: RootContent): boolean {
  return node.type === 'paragraph' && 'data' in node && node.data?.directiveLabel === true;
}

/** Turns one challenge container into its article, or throws with the file and what is missing. */
function transform(node: ContainerDirective, index: number, file: VFile): void {
  const locale = localeOf(file);
  const [first, ...rest] = node.children;
  const title: PhrasingContent[] = first && isLabel(first) && first.type === 'paragraph' ? first.children : [];
  const body = title.length > 0 ? rest : node.children;
  if (title.length === 0) file.fail(`A :::challenge needs a title: :::challenge[The title]`, node);

  const found = new Map<Beat, PhrasingContent[]>();
  for (const child of body) {
    const leaf = child as LeafDirective;
    if (child.type !== 'leafDirective' || !beats.includes(leaf.name as Beat)) {
      file.fail(`A :::challenge holds only ::problem[…], ::solution[…] and ::result[…]`, child);
    }
    found.set(leaf.name as Beat, leaf.children);
  }
  for (const beat of beats) {
    if (!found.has(beat)) file.fail(`This :::challenge has no ::${beat}[…]`, node);
  }

  node.data = { hName: 'article', hProperties: { className: ['challenge'] } };
  node.children = [
    {
      type: 'paragraph',
      data: { hName: 'p', hProperties: { className: ['challenge-number'] } },
      children: [{ type: 'text', value: String(index).padStart(2, '0') }],
    },
    { type: 'heading', depth: 3, children: title },
    {
      type: 'paragraph',
      data: { hName: 'dl' },
      children: beats.flatMap((beat) => [
        { type: 'emphasis', data: { hName: 'dt' }, children: [{ type: 'text', value: labels[locale][beat] }] },
        { type: 'emphasis', data: { hName: 'dd' }, children: found.get(beat) ?? [] },
      ]),
    },
  ];
}

export function remarkChallenge() {
  return (tree: Root, file: VFile): void => {
    let count = 0;
    const visit = (parent: { children: RootContent[] }): void => {
      for (const child of parent.children) {
        if (child.type === 'containerDirective' && child.name === 'challenge') {
          count += 1;
          transform(child, count, file);
        } else if ('children' in child) {
          visit(child);
        }
      }
    };
    visit(tree);
  };
}
