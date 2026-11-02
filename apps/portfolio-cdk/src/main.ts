import { envOrDie, SpaStack } from '@wolsok/spa-cdk-stack';
import { App, RemovalPolicy, Tags } from 'aws-cdk-lib';
import { CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const buildOutputPath = 'dist/apps/portfolio';

// Each prerendered page is at <page>/index.html, but CloudFront in front of
// S3 resolves no folder index: /privacy would fall back to the home page.
// So every page is uploaded once more under its bare path, below.
const pages = readdirSync(buildOutputPath, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((page) =>
    readdirSync(join(buildOutputPath, page)).includes('index.html')
  );

const app = new App();

const stackName = 'Portfolio';
const stack = new SpaStack(app, stackName, {
  env: {
    region: 'eu-central-1',
    account: '088632064895',
  },
  buildOutputPath,
  domainName: 'wolsok.de',
  bucketRemovalPolicy: RemovalPolicy.DESTROY,
  // Crawlers and AdSense read these by name; a page changes with each release.
  noCacheFiles: [
    'ads.txt',
    'robots.txt',
    'sitemap.xml',
    'favicon.ico',
    ...pages.map((page) => `${page}/index.html`),
  ],
});

stack.spa.addExtraAssets(
  pages.map((page) =>
    Source.data(
      page,
      readFileSync(join(buildOutputPath, page, 'index.html'), 'utf8')
    )
  ),
  CacheControl.noCache(),
  'text/html; charset=utf-8'
);

const tags: Tags = Tags.of(app);
tags.add('app', 'Portfolio');
tags.add('version', envOrDie('RELEASE_VERSION'));
