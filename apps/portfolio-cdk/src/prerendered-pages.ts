import { servesFolderIndex } from '@wolsok/spa-cdk-stack';
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
 * The prerendered pages, refusing one whose folder name holds a `.`: the
 * folder index is resolved only for a path without one in its last segment,
 * so such a page would deploy and never be reached.
 */
export function resolvablePages(buildOutputPath: string): string[] {
  const pages = prerenderedPages(buildOutputPath);
  const unreachable = pages.find((page) => !servesFolderIndex(`/${page}`));
  if (unreachable !== undefined) {
    throw new Error(
      `The page "${unreachable}" has a "." in its folder name, so ` +
        `/${unreachable} would not be served from its index.html. Rename it.`
    );
  }
  return pages;
}
