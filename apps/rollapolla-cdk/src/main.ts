import { envOrDie } from '@wolsok/spa-cdk-stack';
import { App, RemovalPolicy, Tags } from 'aws-cdk-lib';
import { SpaStack } from './stacks/spa.stack';

const app = new App();
const stackName = 'RollaPolla';

new SpaStack(app, stackName, {
  env: {
    region: 'us-east-1',
    account: '088632064895',
  },
  buildOutputPath: 'dist/apps/rollapolla',
  domainName: 'rollapolla.com',
  bucketRemovalPolicy: RemovalPolicy.DESTROY,
});

const tags: Tags = Tags.of(app);
tags.add('app', stackName);
tags.add('version', envOrDie('RELEASE_VERSION'));
