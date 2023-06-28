import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { RollaPollaStack } from './stacks/rolla-polla.stack';

describe('RollaPollaStack snapshot', () => {
  let template: Template;

  beforeEach(() => {
    // GIVEN
    const app = new App();

    // WHEN
    const stack = new RollaPollaStack(app, 'RollaPolla', { deployDirectory: 'test-deploy-assets' });
    template = Template.fromStack(stack);
  });

  it('should match snapshot', () => {
    expect(template).toMatchSnapshot();
  });
});
