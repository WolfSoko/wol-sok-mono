import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prerenderedPages, resolvablePages } from './prerendered-pages';

let root: string;

function file(path: string): void {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), '');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'portfolio-'));
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('prerenderedPages', () => {
  it('lists every folder with an index.html, nested ones too', () => {
    file('index.html');
    file('career/index.html');
    file('blog/index.html');
    file('blog/bacteria-wars-turn-relay/index.html');
    file('blog/bacteria-wars-turn-relay/nat-walls.svg');
    file('media/font.woff2');

    expect(prerenderedPages(root).sort()).toEqual([
      'blog',
      'blog/bacteria-wars-turn-relay',
      'career',
    ]);
  });

  it('finds a page below a folder that is none', () => {
    file('docs/guide/index.html');

    expect(prerenderedPages(root)).toEqual(['docs/guide']);
  });
});

describe('resolvablePages', () => {
  it('lists the pages whose folder names hold no dot', () => {
    file('career/index.html');
    file('blog/v1-2/index.html');

    expect(resolvablePages(root).sort()).toEqual(['blog/v1-2', 'career']);
  });

  it('refuses a page whose folder name holds a dot, as /v1.2 is not served from its index.html', () => {
    file('blog/v1.2/index.html');

    expect(() => resolvablePages(root)).toThrow(/"blog\/v1\.2"/);
  });
});
