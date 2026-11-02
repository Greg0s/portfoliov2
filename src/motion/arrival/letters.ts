/** Splits an element's text into letters (`.l`, inline blocks) kept in words (`.w`), so that lines still break. */
export function splitLetters(element: HTMLElement): HTMLSpanElement[] {
  const letters: HTMLSpanElement[] = [];
  const segmenter = new Intl.Segmenter();
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      const fragment = document.createDocumentFragment();
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          fragment.append(document.createTextNode(' '));
          return;
        }
        const word = document.createElement('span');
        word.className = 'w';
        for (const { segment } of segmenter.segment(part)) {
          const letter = document.createElement('span');
          letter.className = 'l';
          letter.textContent = segment;
          word.append(letter);
          letters.push(letter);
        }
        fragment.append(word);
      });
      node.parentNode?.replaceChild(fragment, node);
      return;
    }
    [...node.childNodes].forEach(walk);
  };
  [...element.childNodes].forEach(walk);
  return letters;
}

/** A stable pseudo-random number in [0, 1) for `n`. */
export function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
