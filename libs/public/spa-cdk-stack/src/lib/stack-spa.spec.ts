import { App, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { vitest } from 'vitest';
import { SpaCertificateStack, SpaStack, SpaStackProps } from './spa/spa.stack';
import { CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import {
  ViewerRequestOptions,
  viewerRequestSource,
} from './spa/viewer-request';

// Mock the fromLookup method
vitest.mock('aws-cdk-lib/aws-route53', () => {
  return {
    HostedZone: {
      fromLookup: vitest.fn((domain: string) => ({ superZone: domain })),
    },
    RecordTarget: {
      fromAlias: vitest.fn(),
    },
    ARecord: vitest.fn(),
  };
});
const defaultTestProps: SpaStackProps = {
  env: {
    region: 'us-east-1',
    account: '123456789',
  },
  buildOutputPath: path.join(__dirname, '../../test-build-path'),
  domainName: 'test-domain.com',
};
describe('SpaCdkStack', () => {
  function testStackFactory(props: Partial<SpaStackProps> = defaultTestProps): {
    app: App;
    template: () => Template;
    stack: SpaStack;
  } {
    // GIVEN
    const app = new App();

    // WHEN
    const stack = new SpaStack(app, 'TestSpaStack', {
      ...defaultTestProps,
      ...props,
    });
    const template = () => Template.fromStack(stack);
    return { stack, app, template };
  }

  it('should match snapshot', () => {
    const { template } = testStackFactory();
    expect(template().toJSON()).toMatchSnapshot();
  });

  it('should match snapshot setting bucket removal policy to retain', () => {
    const { template } = testStackFactory({
      bucketRemovalPolicy: RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
    });
    expect(template().toJSON()).toMatchSnapshot();
  });

  it('should use the main domain name even if a subdomain is provided', () => {
    // given, when
    const { template } = testStackFactory({
      domainName: 'subdomain.test-domain.com',
    });

    //then
    expect(template().toJSON()).toMatchSnapshot();
  });

  it('should create an BucketDeployment for the buildOutputPath and index.html', () => {
    const { template } = testStackFactory();
    //then
    template().resourceCountIs('Custom::CDKBucketDeployment', 2);
    template().hasResourceProperties('Custom::CDKBucketDeployment', {
      SourceObjectKeys: Match.arrayEquals([Match.stringLikeRegexp('\\w+.zip')]),
    });
  });

  /** A deployment as the synthesized template holds it. */
  type DeploymentResource = {
    Properties: Record<string, unknown>;
    DependsOn?: string[];
  };

  /** Build output, index.html, a no-cache override and extra assets. */
  function fourDeploymentsFactory(): {
    deployments: Record<string, DeploymentResource>;
    index: string;
    others: string[];
  } {
    const { template, stack } = testStackFactory({
      noCacheFiles: ['test-javascript-asset.js'],
    });
    stack.spa.addExtraAssets([
      Source.asset(path.join(__dirname, '../../extra-assets-path')),
    ]);
    // findResources types every resource as a plain record.
    const deployments = template().findResources(
      'Custom::CDKBucketDeployment'
    ) as Record<string, DeploymentResource>;
    const index = Object.keys(deployments).find((id) =>
      /DeployWithInvalidation2/.test(id)
    ) as string;
    const others = Object.keys(deployments).filter((id) => id !== index);
    return { deployments, index, others };
  }

  it('should deploy index.html last and prune nothing', () => {
    const { deployments, index, others } = fourDeploymentsFactory();
    //then
    expect(others).toHaveLength(3);
    expect(deployments[index].DependsOn).toEqual(
      expect.arrayContaining(others)
    );
    expect(
      Object.values(deployments).map(({ Properties }) => Properties['Prune'])
    ).toEqual([false, false, false, false]);
  });

  it('should invalidate with every deployment and wait only for the last one, index.html', () => {
    const { deployments, index, others } = fourDeploymentsFactory();
    //then
    for (const { Properties } of Object.values(deployments)) {
      expect(Properties['DistributionPaths']).toEqual(['/*']);
    }
    expect(
      deployments[index].Properties['WaitForDistributionInvalidation']
    ).toBe(true);
    for (const id of others) {
      expect(
        deployments[id].Properties['WaitForDistributionInvalidation']
      ).toBe(false);
    }
  });

  it('should create an extra BucketDeployment when using addExtraAssets', () => {
    const { template, stack } = testStackFactory();
    stack.spa.addExtraAssets([
      Source.asset(path.join(__dirname, '../../extra-assets-path')),
    ]);
    //then
    expect(template().toJSON()).toMatchSnapshot();
  });

  it('should create an extra BucketDeployment when using addExtraAssets with cache control', () => {
    const { template, stack } = testStackFactory();
    stack.spa.addExtraAssets(
      [Source.asset(path.join(__dirname, '../../extra-assets-path'))],
      CacheControl.maxAge(Duration.seconds(123456))
    );
    //then
    expect(template().toJSON()).toMatchSnapshot();
  });

  it('should create an extra Custom::CDKBucketDeployment when using addExtraAssets', () => {
    const { template, stack } = testStackFactory();

    //when
    stack.spa.addExtraAssets([
      Source.asset(path.join(__dirname, '../../extra-assets-path')),
    ]);
    //then
    template().resourceCountIs('Custom::CDKBucketDeployment', 3);
    template().hasResourceProperties('Custom::CDKBucketDeployment', {
      SourceObjectKeys: Match.arrayEquals([Match.stringLikeRegexp('\\w+.zip')]),
    });
  });

  describe('extra assets in one call', () => {
    const page = (key: string) => Source.data(key, `<html>${key}</html>`);

    it('should refuse a file and a path below it, as one deployment unpacks them into one folder', () => {
      const { stack } = testStackFactory();

      expect(() =>
        stack.spa.addExtraAssets([page('blog'), page('blog/first-post')])
      ).toThrow(/"blog" is a file in one source and a folder in another/);
    });

    it('should refuse them in either order and below several folders', () => {
      const { stack } = testStackFactory();

      expect(() =>
        stack.spa.addExtraAssets([page('docs/a/b'), page('docs/a')])
      ).toThrow(/"docs\/a"/);
    });

    it('should take the same files in separate calls', () => {
      const { stack, template } = testStackFactory();

      stack.spa.addExtraAssets([page('career'), page('blog')]);
      stack.spa.addExtraAssets([page('blog/first-post')]);

      template().resourceCountIs('Custom::CDKBucketDeployment', 4);
    });

    it('should take sources that share folders but no file', () => {
      const { stack, template } = testStackFactory();

      stack.spa.addExtraAssets([
        page('blog/first-post'),
        page('blog/second-post'),
        Source.asset(path.join(__dirname, '../../extra-assets-path')),
      ]);

      template().resourceCountIs('Custom::CDKBucketDeployment', 3);
    });

    it('should check only what an asset keeps after its excludes', () => {
      const { stack } = testStackFactory();

      expect(() =>
        stack.spa.addExtraAssets([
          page('asset.json/x'),
          Source.asset(path.join(__dirname, '../../extra-assets-path'), {
            exclude: ['asset.json'],
          }),
        ])
      ).not.toThrow();
      expect(() =>
        stack.spa.addExtraAssets([
          page('asset.json/x'),
          Source.asset(path.join(__dirname, '../../extra-assets-path')),
        ])
      ).toThrow(/"asset.json"/);
    });
  });

  describe('viewer-request function', () => {
    it.each<ViewerRequestOptions>([
      { redirectTrailingSlash: true },
      { resolveFolderIndex: true },
      { redirectTrailingSlash: true, resolveFolderIndex: true },
    ])(
      'should add one CloudFront Function on viewer request for %o',
      (options) => {
        const { template } = testStackFactory(options);

        template().resourceCountIs('AWS::CloudFront::Function', 1);
        template().hasResourceProperties('AWS::CloudFront::Function', {
          FunctionConfig: Match.objectLike({ Runtime: 'cloudfront-js-2.0' }),
          FunctionCode: viewerRequestSource(options),
        });
        template().hasResourceProperties('AWS::CloudFront::Distribution', {
          DistributionConfig: Match.objectLike({
            DefaultCacheBehavior: Match.objectLike({
              FunctionAssociations: [
                Match.objectLike({ EventType: 'viewer-request' }),
              ],
            }),
          }),
        });
      }
    );

    it('should add no function by default', () => {
      const { template } = testStackFactory();

      template().resourceCountIs('AWS::CloudFront::Function', 0);
    });
  });

  describe('not-found page', () => {
    let notFoundBuild: string;

    beforeEach(() => {
      notFoundBuild = mkdtempSync(path.join(tmpdir(), 'spa-not-found-'));
      mkdirSync(path.join(notFoundBuild, '404'));
      writeFileSync(path.join(notFoundBuild, 'index.html'), '<html></html>');
      writeFileSync(
        path.join(notFoundBuild, '404/index.html'),
        '<html>Not found</html>'
      );
    });

    afterEach(() => rmSync(notFoundBuild, { recursive: true, force: true }));

    function errorResponses(template: Template): unknown {
      const [distribution] = Object.values(
        template.findResources('AWS::CloudFront::Distribution')
      );
      return distribution['Properties'].DistributionConfig.CustomErrorResponses;
    }

    it('should fall back to index.html with 200 by default', () => {
      const { template } = testStackFactory();

      expect(errorResponses(template())).toEqual([
        {
          ErrorCachingMinTTL: 1800,
          ErrorCode: 403,
          ResponseCode: 200,
          ResponsePagePath: '/index.html',
        },
      ]);
    });

    it('should answer a missing key with the page and 404', () => {
      const { template } = testStackFactory({
        buildOutputPath: notFoundBuild,
        notFoundPage: '404/index.html',
      });

      expect(errorResponses(template())).toEqual(
        [403, 404].map((code) => ({
          ErrorCachingMinTTL: 1800,
          ErrorCode: code,
          ResponseCode: 404,
          ResponsePagePath: '/404/index.html',
        }))
      );
    });

    it('should refuse a page that is not in the build output', () => {
      expect(() =>
        testStackFactory({ notFoundPage: '404/index.html' })
      ).toThrow(
        /notFoundPage "404\/index.html" is not a file in the build output/
      );
    });

    it('should refuse a folder of the build output', () => {
      expect(() =>
        testStackFactory({
          buildOutputPath: notFoundBuild,
          notFoundPage: '404',
        })
      ).toThrow(/notFoundPage "404" is not a file/);
    });

    it.each(['/404/index.html', '', '../index.html'])(
      'should refuse %j, which is no path inside the build output',
      (notFoundPage) => {
        expect(() =>
          testStackFactory({ buildOutputPath: notFoundBuild, notFoundPage })
        ).toThrow(/must be a path inside buildOutputPath/);
      }
    );
  });

  describe('cache overrides', () => {
    const nestedBuildPath = path.join(
      __dirname,
      '../../test-nested-build-path'
    );

    function deployedFiles(props: Partial<SpaStackProps>): {
      cacheControl: string;
      contentType?: string;
      files: string[];
    }[] {
      const { app, template } = testStackFactory({
        buildOutputPath: nestedBuildPath,
        ...props,
      });
      const assemblyDir = app.synth().directory;
      return Object.values(
        template().findResources('Custom::CDKBucketDeployment')
      ).map(({ Properties }) => ({
        cacheControl: Properties['SystemMetadata']['cache-control'],
        contentType: Properties['SystemMetadata']['content-type'],
        files: (Properties['SourceObjectKeys'] as string[]).flatMap((key) => {
          const assetDir = path.join(
            assemblyDir,
            'asset.' + key.replace(/\.zip$/, '')
          );
          return readdirSync(assetDir, { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) =>
              path
                .relative(assetDir, path.join(entry.parentPath, entry.name))
                .replaceAll(path.sep, '/')
            )
            .sort();
        }),
      }));
    }

    it('should deploy every file once, with its own headers', () => {
      expect(
        deployedFiles({
          noCacheFiles: [
            'remoteEntry.json',
            'assets/federation.manifest*.json',
          ],
          cacheOverrides: [
            {
              files: ['fib-wasm/optimized.wasm'],
              cacheControl: CacheControl.maxAge(Duration.days(1)),
              contentType: 'application/wasm',
            },
          ],
        })
      ).toEqual([
        {
          cacheControl: 'max-age=31536000',
          files: ['assets/logo.svg', 'main.js'],
        },
        { cacheControl: 'no-cache', files: ['index.html'] },
        {
          cacheControl: 'no-cache',
          files: ['assets/federation.manifest.json', 'remoteEntry.json'],
        },
        {
          cacheControl: 'max-age=86400',
          contentType: 'application/wasm',
          files: ['fib-wasm/optimized.wasm'],
        },
      ]);
    });

    it('should deploy the contents of a folder named in noCacheFiles', () => {
      expect(deployedFiles({ noCacheFiles: ['assets'] })).toEqual([
        {
          cacheControl: 'max-age=31536000',
          files: ['fib-wasm/optimized.wasm', 'main.js', 'remoteEntry.json'],
        },
        { cacheControl: 'no-cache', files: ['index.html'] },
        {
          cacheControl: 'no-cache',
          files: ['assets/federation.manifest.json', 'assets/logo.svg'],
        },
      ]);
    });

    it.each(['**/federation.manifest.json', 'assets/*/manifest.json'])(
      'should reject the wildcard folder in %s',
      (glob) => {
        expect(() => deployedFiles({ noCacheFiles: [glob] })).toThrow(
          'Wildcards are only supported in the last segment'
        );
      }
    );
  });

  describe('certificate', () => {
    const certificates = (template: Template) =>
      Object.keys(
        template.findResources('AWS::CertificateManager::Certificate')
      );

    it('should create the certificate in the stack itself in us-east-1', () => {
      const { app, template } = testStackFactory();
      expect(certificates(template())).toHaveLength(1);
      expect(
        app.node.children
          .filter(Stack.isStack)
          .map(({ stackName }) => stackName)
      ).toEqual(['TestSpaStack']);
    });

    it('should create the certificate in a us-east-1 stack of its own in another region', () => {
      const { app, stack, template } = testStackFactory({
        env: { region: 'eu-central-1', account: '123456789' },
      });
      const certificateStack = app.node.findChild(
        'TestSpaStackCertificate'
      ) as SpaCertificateStack;

      expect(certificateStack.region).toBe('us-east-1');
      expect(certificates(template())).toHaveLength(0);
      expect(certificates(Template.fromStack(certificateStack))).toHaveLength(
        1
      );
      expect(stack.dependencies).toContain(certificateStack);
      template().hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          ViewerCertificate: Match.objectLike({
            AcmCertificateArn: Match.anyValue(),
          }),
        }),
      });
    });
  });
});
