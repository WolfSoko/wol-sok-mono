import { envOrDie, SpaStack } from '@wolsok/spa-cdk-stack';
import { App, RemovalPolicy, Tags } from 'aws-cdk-lib';

const app = new App();

const stackName = 'ShaderExamples';
new SpaStack(app, stackName, {
  env: {
    region: 'us-east-1',
    account: '088632064895',
  },
  buildOutputPath: 'dist/apps/shader-examples-remote',
  domainName: 'shader-examples.wolsok.de',
  bucketRemovalPolicy: RemovalPolicy.DESTROY,
  extraAllowedOrigins: ['https://angularexamples.wolsok.de'],
  // The import map keeps its name across releases.
  noCacheFiles: ['remoteEntry.json'],
});

const tags: Tags = Tags.of(app);
tags.add('app', 'ShaderExamples');
tags.add('version', envOrDie('RELEASE_VERSION'));
