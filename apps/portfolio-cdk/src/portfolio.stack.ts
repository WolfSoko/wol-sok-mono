import { SpaStack } from '@wolsok/spa-cdk-stack';
import { App, RemovalPolicy } from 'aws-cdk-lib';
import { CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pagesByDepth, prerenderedPages } from './prerendered-pages';

const STACK_NAME = 'Portfolio';

/**
 * The stack of wolsok.de, serving the prerendered portfolio below
 * `buildOutputPath`.
 *
 * Each prerendered page is at <page>/index.html, but CloudFront in front of
 * S3 resolves no folder index: /privacy would fall back to the home page.
 * So every page, nested ones such as /blog/<slug> too, is uploaded once more
 * under its bare path. A trailing slash (/career/) would miss both and fall
 * back to the home page too, so it redirects to the bare path.
 */
export function createPortfolioStack(
  app: App,
  buildOutputPath: string
): SpaStack {
  const pages = prerenderedPages(buildOutputPath);

  const stack = new SpaStack(app, STACK_NAME, {
    env: {
      region: 'eu-central-1',
      account: '088632064895',
    },
    buildOutputPath,
    domainName: 'wolsok.de',
    bucketRemovalPolicy: RemovalPolicy.DESTROY,
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

  // One upload per depth: in a single one the file `blog` would block the
  // folder `blog/` of `blog/<slug>` (see pagesByDepth).
  for (const group of pagesByDepth(pages)) {
    stack.spa.addExtraAssets(
      group.map((page) =>
        Source.data(
          page,
          readFileSync(join(buildOutputPath, page, 'index.html'), 'utf8')
        )
      ),
      CacheControl.noCache(),
      'text/html; charset=utf-8'
    );
  }
  return stack;
}
