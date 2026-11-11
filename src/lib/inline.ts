/**
 * The inline links of a short text: `[label](https://…)`. The case studies' one-sentence results may hold them (the
 * OULIPO's site); the schema measures the text a reader sees, without the addresses.
 */
export interface InlinePart {
  text: string;
  href?: string | undefined;
}

const link = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

/** The text split into plain parts and links, in order. */
export function inlineParts(source: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of source.matchAll(link)) {
    if (match.index > last) parts.push({ text: source.slice(last, match.index) });
    parts.push({ text: match[1] ?? '', href: match[2] });
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ text: source.slice(last) });
  return parts;
}

/** What a reader sees: the text without the links' addresses. */
export function plainText(source: string): string {
  return inlineParts(source)
    .map((part) => part.text)
    .join('');
}
