import { App, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as path from 'path';
import { vitest } from 'vitest';
import { SpaStack, SpaStackProps } from './spa/spa.stack';
import { CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';

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

  it('should upload noCacheFiles with no-cache after the hashed bundles', () => {
    const { template } = testStackFactory({
      noCacheFiles: ['test-javascript-asset.js'],
    });
    //then
    template().resourceCountIs('Custom::CDKBucketDeployment', 3);
    const deployments = Object.values(
      template().findResources('Custom::CDKBucketDeployment')
    );
    const cacheControl = deployments.map(
      (deployment) => deployment.Properties.SystemMetadata['cache-control']
    );
    expect(cacheControl).toEqual(['no-cache', 'max-age=31536000', 'no-cache']);
    expect(deployments[2].DependsOn).toEqual(
      expect.arrayContaining([expect.stringMatching(/DeployWithInvalidation2/)])
    );
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
});
