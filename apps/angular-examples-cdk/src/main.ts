import { App, RemovalPolicy } from 'aws-cdk-lib';
import { SpaStack } from './stacks/spa.stack';

const app = new App();

new SpaStack(app, 'AngularExamples', {
  env: {
    region: 'us-east-1',
    account: '088632064895',
  },
  buildOutputPath: 'dist/production',
  domainName: 'angularexamples.wolsok.de',
  deleteBucketPolicy: RemovalPolicy.DESTROY,
});
