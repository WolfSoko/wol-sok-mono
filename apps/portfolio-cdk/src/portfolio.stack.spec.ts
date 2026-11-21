import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPortfolioStack } from './portfolio.stack';

const HTML_UPLOAD = {
  'cache-control': 'no-cache',
  'content-type': 'text/html; charset=utf-8',
};

describe('createPortfolioStack', () => {
  let buildOutput: string;

  function file(path: string): void {
    mkdirSync(join(buildOutput, path, '..'), { recursive: true });
    writeFileSync(join(buildOutput, path), `<html>${path}</html>`);
  }

  function synthesize(): Template {
    return Template.fromStack(createPortfolioStack(new App(), buildOutput));
  }

  beforeEach(() => {
    buildOutput = mkdtempSync(join(tmpdir(), 'portfolio-build-'));
    file('index.html');
    file('main-ABC123.js');
    file('career/index.html');
    file('privacy/index.html');
    file('blog/index.html');
    file('blog/bacteria-wars-turn-relay/index.html');
    file('blog/bacteria-wars-turn-relay/nat-walls.svg');
  });

  afterEach(() => rmSync(buildOutput, { recursive: true, force: true }));

  it('synthesizes pages below other pages, uploading them one depth at a time, no-cache and as HTML', () => {
    const deployments = Object.values(
      synthesize().findResources('Custom::CDKBucketDeployment')
    ).map(({ Properties }) => Properties);

    const pageUploads = deployments.filter(
      ({ SystemMetadata }) =>
        SystemMetadata?.['content-type'] === HTML_UPLOAD['content-type']
    );
    for (const { SystemMetadata } of pageUploads) {
      expect(SystemMetadata).toEqual(HTML_UPLOAD);
    }
    // career, privacy and blog first, blog/bacteria-wars-turn-relay alone.
    expect(
      pageUploads.map(({ SourceObjectKeys }) => SourceObjectKeys.length)
    ).toEqual([3, 1]);
  });

  it('redirects trailing-slash paths with a viewer-request CloudFront Function', () => {
    const template = synthesize();

    template.resourceCountIs('AWS::CloudFront::Function', 1);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          FunctionAssociations: [
            Match.objectLike({ EventType: 'viewer-request' }),
          ],
        }),
      }),
    });
  });
});
