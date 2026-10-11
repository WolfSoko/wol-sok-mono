import { envOrDie } from '@wolsok/spa-cdk-stack';
import { App, Aws, RemovalPolicy, Tags } from 'aws-cdk-lib';
import { SpaStack } from './stacks/spa.stack';

const app = new App();

const stackName = 'ShaderExamples';
new SpaStack(app, stackName, {
  env: {
    region: 'us-east-1',
    account: Aws.ACCOUNT_ID,
  },
  buildOutputPath: 'dist/apps/shader-examples-remote',
  domainName: 'shader-examples.wolsok.de',
  bucketRemovalPolicy: RemovalPolicy.DESTROY,
  extraAllowedOrigins: ['https://angularexamples.wolsok.de'],
});

const tags: Tags = Tags.of(app);
tags.add('app', 'ShaderExamples');
tags.add('version', envOrDie('RELEASE_VERSION'));
