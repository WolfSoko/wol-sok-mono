import { App, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as path from 'path';
import { vitest } from 'vitest';
import { SpaConstruct, SpaProps } from './spa/spa.construct';
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
class TestSpaStack extends Stack {
  spaConstruct: SpaConstruct;
  constructor(parent: App, name: string, props: SpaProps & StackProps) {
    super(parent, name, props);

    const { domainName, buildOutputPath, bucketRemovalPolicy } = props;
    this.spaConstruct = new SpaConstruct(this, name, {
      domainName,
      buildOutputPath,
      bucketRemovalPolicy: bucketRemovalPolicy,
    });
  }
}

const defaultTestProps: SpaProps & StackProps = {
  env: {
    region: 'us-east-1',
    account: '123456789',
  },
  buildOutputPath: path.join(__dirname, '../../test-build-path'),
  domainName: 'test-domain.com',
};
describe('SpaCdkStack', () => {
  function testStackFactory(
    props: Partial<SpaProps & StackProps> = defaultTestProps
  ): { app: App; template: () => Template; stack: TestSpaStack } {
    // GIVEN
    const app = new App();

    // WHEN
    const stack = new TestSpaStack(app, 'TestSpaStack', {
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

  it('should create an extra BucketDeployment when using addExtraAssets', () => {
    const { template, stack } = testStackFactory();
    stack.spaConstruct.addExtraAssets([
      Source.asset(path.join(__dirname, '../../extra-assets-path')),
    ]);
    //then
    expect(template().toJSON()).toMatchSnapshot();
  });

  it('should create an extra BucketDeployment when using addExtraAssets with cache control', () => {
    const { template, stack } = testStackFactory();
    stack.spaConstruct.addExtraAssets(
      [Source.asset(path.join(__dirname, '../../extra-assets-path'))],
      CacheControl.maxAge(Duration.seconds(123456))
    );
    //then
    expect(template().toJSON()).toMatchSnapshot();
  });

  it('should create an extra Custom::CDKBucketDeployment when using addExtraAssets', () => {
    const { template, stack } = testStackFactory();

    //when
    stack.spaConstruct.addExtraAssets([
      Source.asset(path.join(__dirname, '../../extra-assets-path')),
    ]);
    //then
    template().resourceCountIs('Custom::CDKBucketDeployment', 3);
    template().hasResourceProperties('Custom::CDKBucketDeployment', {
      SourceObjectKeys: Match.arrayEquals([Match.stringLikeRegexp('\\w+.zip')]),
    });
  });
});
