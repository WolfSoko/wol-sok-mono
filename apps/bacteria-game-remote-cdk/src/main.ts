import { envOrDie } from '@wolsok/spa-cdk-stack';
import { App, Stack, Tags } from 'aws-cdk-lib';
import { addFirebaseDomain } from './firebase-domain';

const app = new App();

// The game is on Firebase Hosting at bacteria-wars.wolsok.de (ADR 0008). The
// old site at bacteria-game.wolsok.de is gone: this stack, under its old
// name, only holds the new domain's record, which keeps its id.
const stack = new Stack(app, 'BacteriaGame', {
  env: {
    region: 'us-east-1',
    account: '088632064895',
  },
});

addFirebaseDomain(stack, {
  domain: 'bacteria-wars.wolsok.de',
  site: 'bacteria-wars',
});

const tags: Tags = Tags.of(app);
tags.add('app', 'BacteriaGame');
tags.add('version', envOrDie('RELEASE_VERSION'));
