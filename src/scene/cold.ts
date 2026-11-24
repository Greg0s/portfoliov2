/**
 * A first visit, again and again (`?froid=1`, and the fast and full-visit measurement runs): the browser keeps the
 * programs it linked in a cache of its own, which makes every later visit fast. A comment that changes at each visit,
 * in the source of each program, makes it miss.
 */
const cold = typeof location !== 'undefined' && /[?&](froid=1|mesure=rapide|mesure=visite)\b/.test(location.search);

/** `source`, with this visit's comment after its first line (where `#version` has to stay), when cold. */
export function coldSource(source: string): string {
  if (!cold) return source;
  const line = source.indexOf('\n') + 1;
  return `${source.slice(0, line)}// ${String(Math.random())}\n${source.slice(line)}`;
}
