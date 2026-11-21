import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const PAGE_FILE = 'index.html';

/**
 * The prerendered pages below a build output: every folder, at any depth,
 * that holds an `index.html` (`career`, `blog/<slug>`), as its path from
 * the root with `/` between the segments. The root's own `index.html` is
 * the home page, which CloudFront already serves, so it is not listed.
 */
export function prerenderedPages(root: string, prefix = ''): string[] {
  return readdirSync(join(root, prefix), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const page = prefix ? `${prefix}/${entry.name}` : entry.name;
      const own = readdirSync(join(root, page)).includes(PAGE_FILE)
        ? [page]
        : [];
      return [...own, ...prerenderedPages(root, page)];
    });
}

/**
 * The pages grouped by their depth (`career`, `blog` before
 * `blog/<slug>`), one upload each: a deployment unpacks all its sources
 * into one folder, where the bare-path file `blog` leaves no room for the
 * folder `blog/` that `blog/<slug>` needs (`Not a directory`). Within one
 * depth no page can be the folder of another.
 */
export function pagesByDepth(pages: readonly string[]): string[][] {
  const groups = new Map<number, string[]>();
  for (const page of pages) {
    const depth = page.split('/').length;
    groups.set(depth, [...(groups.get(depth) ?? []), page]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, group]) => group);
}
