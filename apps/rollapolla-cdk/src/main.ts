import { App } from 'aws-cdk-lib';
import { AppStack } from './stacks/app.stack';

const app = new App();

new AppStack(app, 'RollaPolla', {
  buildOutputPath: 'dist/apps/rollapolla',
  domainName: 'rollapolla.com',
});
