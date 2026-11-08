import { envOrDie } from '@wolsok/spa-cdk-stack';
import { App, Stack, Tags } from 'aws-cdk-lib';
import { addFirebaseDomain } from './firebase-domain';
import { KORBJAEGER_DOMAIN, KORBJAEGER_HOSTING_SITE } from './korbjaeger-site';

const app = new App();

// Korbjäger is on Firebase Hosting (firebase.korbjaeger.json); this stack
// only holds its domain's record.
const stack = new Stack(app, 'Korbjaeger', {
  env: {
    region: 'us-east-1',
    account: '088632064895',
  },
});

addFirebaseDomain(stack, {
  domain: KORBJAEGER_DOMAIN,
  site: KORBJAEGER_HOSTING_SITE,
});

const tags: Tags = Tags.of(app);
tags.add('app', 'Korbjaeger');
tags.add('version', envOrDie('RELEASE_VERSION'));
