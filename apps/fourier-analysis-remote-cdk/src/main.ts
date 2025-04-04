import { envOrDie } from '@wolsok/spa-cdk-stack';
import { App, RemovalPolicy, Tags } from 'aws-cdk-lib';
import { SpaStack } from './stacks/spa.stack';

const app = new App();

const stackName = 'FourierAnalysis';
new SpaStack(app, stackName, {
  env: {
    region: 'us-east-1',
    account: '088632064895',
  },
  buildOutputPath: 'dist/apps/fourier-analysis-remote',
  domainName: 'fourier-analysis.wolsok.de',
  bucketRemovalPolicy: RemovalPolicy.DESTROY,
  extraAllowedOrigins: ['https://angularexamples.wolsok.de'],
});

const tags: Tags = Tags.of(app);
tags.add('app', 'FourierAnalysis');
tags.add('version', envOrDie('RELEASE_VERSION'));
