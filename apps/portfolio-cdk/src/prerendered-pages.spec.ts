import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pagesByDepth, prerenderedPages } from './prerendered-pages';

describe('prerenderedPages', () => {
  let root: string;

  function file(path: string): void {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), '');
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'portfolio-'));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

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

describe('pagesByDepth', () => {
  const PAGES = [
    'career',
    'blog',
    'blog/bacteria-wars-turn-relay',
    'privacy',
    'docs/a/b',
    'blog/second-post',
  ];

  it('groups the pages by depth, shallowest first', () => {
    expect(pagesByDepth(PAGES)).toEqual([
      ['career', 'blog', 'privacy'],
      ['blog/bacteria-wars-turn-relay', 'blog/second-post'],
      ['docs/a/b'],
    ]);
  });

  it('never puts a page beside a page below it, as one upload unpacks them into one folder', () => {
    for (const group of pagesByDepth(PAGES)) {
      for (const page of group) {
        expect(group.filter((other) => other.startsWith(`${page}/`))).toEqual(
          []
        );
      }
    }
  });

  it('has no group for no pages', () => {
    expect(pagesByDepth([])).toEqual([]);
  });
});
