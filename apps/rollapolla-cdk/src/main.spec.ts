import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { RollaPollaStack } from './stacks/rolla-polla.stack';

// Mock the fromLookup method
jest.mock('aws-cdk-lib/aws-route53', () => {
  return {
    HostedZone: {
      fromLookup: jest.fn().mockImplementation(() => {
        // Return a mock instance of HostedZone for testing purposes
        return {
          hostedZoneId: '<mocked-hosted-zone-id>',
          zoneName: '<mocked-zone-name>',
        };
      }),
    },
    RecordTarget: {
      fromAlias: jest.fn(),
    },
    ARecord: jest.fn(),
  };
});

describe('RollaPollaStack snapshot', () => {
  let template: Template;
  const envCentral = { account: '2383838383', region: 'eu-central-1' };

  beforeEach(() => {
    // GIVEN
    const app = new App();

    // WHEN
    const stack = new RollaPollaStack(app, 'RollaPolla', {
      buildOutputPath: 'apps/rollapolla-cdk/test-build-path',
      domainName: 'test-domain',
    });
    template = Template.fromStack(stack);
  });

  it('should match snapshot', () => {
    expect(template).toMatchSnapshot();
  });
});
