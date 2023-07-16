import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AppStack } from './stacks/app.stack';

// Mock the fromLookup method
jest.mock('aws-cdk-lib/aws-route53', () => {
  return {
    HostedZone: { fromLookup: jest.fn((domain: string) => ({ superZone: domain })) },
    RecordTarget: {
      fromAlias: jest.fn(),
    },
    ARecord: jest.fn(),
  };
});

describe('RollaPollaStack snapshot', () => {
  let template: Template;

  beforeEach(() => {
    // GIVEN
    const app = new App();

    // WHEN
    const stack = new AppStack(app, 'RollaPolla', {
      buildOutputPath: 'apps/rollapolla-cdk/test-build-path',
      domainName: 'test-domain',
    });
    template = Template.fromStack(stack);
  });

  it('should match snapshot', () => {
    expect(template).toMatchSnapshot();
  });
});
