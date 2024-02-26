import { App, RemovalPolicy } from 'aws-cdk-lib';
import { SpaStack } from './stacks/spa.stack';

const app = new App();

new SpaStack(app, 'RollaPolla', {
  env: {
    region: 'eu-central-1',
    account: '088632064895',
  },
  buildOutputPath: 'dist/apps/rollapolla',
  domainName: 'rollapolla.com',
  deleteBucketPolicy: RemovalPolicy.DESTROY,
});
