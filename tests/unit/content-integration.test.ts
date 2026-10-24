import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findContentErrors } from '../../src/integrations/content-checks';

const roots: string[] = [];

/** A copy of the real projects, to break one at a time. */
function copyOfContent(): string {
  const root = mkdtempSync(join(tmpdir(), 'content-'));
  roots.push(root);
  cpSync('src/content/projects', join(root, 'src/content/projects'), { recursive: true });
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('the content checks on the real content', () => {
  it('find nothing wrong with the projects as they are', async () => {
    expect(await findContentErrors(process.cwd())).toEqual([]);
  });

  it('fail when a project loses its fr.md', async () => {
    const root = copyOfContent();
    rmSync(join(root, 'src/content/projects/lyrix/fr.md'));
    expect(await findContentErrors(root)).toEqual(['Project "lyrix" has no fr.md (src/content/projects/lyrix/fr.md).']);
  });
});
