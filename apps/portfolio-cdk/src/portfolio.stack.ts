import { SpaStack } from '@wolsok/spa-cdk-stack';
import { App, RemovalPolicy } from 'aws-cdk-lib';
import { prerenderedPages } from './prerendered-pages';

const STACK_NAME = 'Portfolio';

/**
 * The stack of wolsok.de, serving the prerendered portfolio below
 * `buildOutputPath`.
 *
 * Each prerendered page is at <page>/index.html, which CloudFront in front of
 * S3 does not resolve for /<page> by itself, so the SPA stack's viewer-request
 * function does (`resolveFolderIndex`). A trailing slash (/career/) redirects
 * to the bare path, so each page keeps one URL.
 */
export function createPortfolioStack(
  app: App,
  buildOutputPath: string
): SpaStack {
  const pages = resolvablePages(buildOutputPath);

  return new SpaStack(app, STACK_NAME, {
    env: {
      region: 'eu-central-1',
      account: '088632064895',
    },
    buildOutputPath,
    domainName: 'wolsok.de',
    bucketRemovalPolicy: RemovalPolicy.DESTROY,
    resolveFolderIndex: true,
    redirectTrailingSlash: true,
    // Crawlers and AdSense read these by name; a page changes with each release.
    noCacheFiles: [
      'ads.txt',
      'app-ads.txt',
      'robots.txt',
      'sitemap.xml',
      'favicon.ico',
      ...pages.map((page) => `${page}/index.html`),
    ],
  });
}

/**
 * The prerendered pages, refusing one whose folder name holds a `.`: the
 * folder index is resolved only for a path without one in its last segment,
 * so such a page would deploy and never be reached.
 */
function resolvablePages(buildOutputPath: string): string[] {
  const pages = prerenderedPages(buildOutputPath);
  const unreachable = pages.find((page) =>
    page.split('/').at(-1)?.includes('.')
  );
  if (unreachable !== undefined) {
    throw new Error(
      `The page "${unreachable}" has a "." in its folder name, so ` +
        `/${unreachable} would not be served from its index.html. Rename it.`
    );
  }
  return pages;
}
