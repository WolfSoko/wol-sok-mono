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
