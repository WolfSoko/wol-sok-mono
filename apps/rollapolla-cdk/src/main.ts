import { App } from 'aws-cdk-lib';
import { AppStack } from './stacks/app.stack';

const app = new App();

new AppStack(app, 'RollaPolla', {
  env: {
    region: 'us-east-1',
    account: '088632064895',
  },
  buildOutputPath: 'dist/apps/rollapolla',
  domainName: 'rollapolla.com',
});
