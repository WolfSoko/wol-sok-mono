import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPortfolioStack } from './portfolio.stack';

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

  it('uploads each page once, under the key the build wrote, no-cache', () => {
    const deployments = Object.values(
      synthesize().findResources('Custom::CDKBucketDeployment')
    ).map(({ Properties }) => Properties);

    expect(
      deployments.filter(
        ({ SystemMetadata }) => SystemMetadata?.['content-type'] !== undefined
      )
    ).toEqual([]);
    // The main upload, index.html and the no-cache files (pages included).
    expect(deployments).toHaveLength(3);
    expect(
      deployments.filter(
        ({ SystemMetadata }) => SystemMetadata?.['cache-control'] === 'no-cache'
      )
    ).toHaveLength(2);
  });

  it('refuses a page whose folder name holds a dot, as the folder index of /v1.2 is not resolved', () => {
    file('blog/v1.2/index.html');

    expect(() => synthesize()).toThrow(/"blog\/v1\.2"/);
  });

  it('resolves folder indexes and redirects trailing-slash paths with one viewer-request CloudFront Function', () => {
    const template = synthesize();

    template.resourceCountIs('AWS::CloudFront::Function', 1);
    template.hasResourceProperties('AWS::CloudFront::Function', {
      FunctionCode: Match.stringLikeRegexp(
        'REDIRECT_TRAILING_SLASH = true;\\s+var RESOLVE_FOLDER_INDEX = true;'
      ),
    });
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
