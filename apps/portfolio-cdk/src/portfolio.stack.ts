import { SpaStack } from '@wolsok/spa-cdk-stack';
import { App, RemovalPolicy } from 'aws-cdk-lib';
import { resolvablePages } from './prerendered-pages';

const STACK_NAME = 'Portfolio';

/** The portfolio's prerendered not-found page (`NOT_FOUND_PAGE_PATH`). */
const NOT_FOUND_PAGE = '404/index.html';

/**
 * The stack of wolsok.de, serving the prerendered portfolio below
 * `buildOutputPath`.
 *
 * Each prerendered page is at <page>/index.html, which CloudFront in front of
 * S3 does not resolve for /<page> by itself, so the SPA stack's viewer-request
 * function does (`resolveFolderIndex`). A trailing slash (/career/) redirects
 * to the bare path, so each page keeps one URL. Every path without a page
 * gets the prerendered not-found page with status 404, not the home page.
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
    notFoundPage: NOT_FOUND_PAGE,
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
