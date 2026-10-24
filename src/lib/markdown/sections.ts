/**
 * Wraps each `##` section of a case study in a `<section>`: the heading on one side, its content on the other, as in
 * the mockup's case study (Context, What I did, Technical challenges).
 */
import type { Element, ElementContent, Root, RootContent } from 'hast';

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

export function rehypeSections() {
  return (tree: Root): void => {
    const children: RootContent[] = [];
    let body: Element | undefined;
    for (const node of tree.children) {
      if (node.type === 'element' && node.tagName === 'h2') {
        const id = slugify(node.children.map(textOf).join(''));
        node.properties = { ...node.properties, id };
        body = { type: 'element', tagName: 'div', properties: { className: ['case-body'] }, children: [] };
        children.push({
          type: 'element',
          tagName: 'section',
          properties: { className: ['case-section'], ariaLabelledBy: [id] },
          children: [node, body],
        });
      } else if (body) {
        body.children.push(node as ElementContent);
      } else {
        children.push(node);
      }
    }
    tree.children = children;
  };
}
