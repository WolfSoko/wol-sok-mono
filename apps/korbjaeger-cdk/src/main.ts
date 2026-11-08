import { App, Stack, Tags } from 'aws-cdk-lib';
import { addFirebaseDomain } from './firebase-domain';
import { KORBJAEGER_DOMAIN, korbjaegerHostingSite } from './korbjaeger-site';

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
  site: korbjaegerHostingSite(),
});

const tags: Tags = Tags.of(app);
tags.add('app', 'Korbjaeger');
const version = process.env['RELEASE_VERSION'];
if (!version) {
  throw new Error('Environment variable RELEASE_VERSION is required');
}
tags.add('version', version);
