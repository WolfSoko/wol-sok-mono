import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { RollaPollaStack } from './stacks/rolla-polla.stack';

describe('RollaPollaStack snapshot', () => {
  let template: Template;

  beforeEach(() => {
    // GIVEN
    const app = new App();

    // WHEN
    const stack = new RollaPollaStack(app, 'RollaPolla', { buildOutputPath: 'test-build-path' });
    template = Template.fromStack(stack);
  });

  it('should match snapshot', () => {
    expect(template).toMatchSnapshot();
  });
});
