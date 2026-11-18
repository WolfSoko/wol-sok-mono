import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { addFirebaseDomain } from './firebase-domain';

describe('addFirebaseDomain', () => {
  const stack = new Stack(new App(), 'FirebaseDomainSpec', {
    env: { region: 'us-east-1', account: '123456789012' },
  });
  addFirebaseDomain(stack, { domain: 'app.example.com', site: 'my-site' });
  const template = Template.fromStack(stack);

  it('points the domain at the Firebase Hosting site', () => {
    template.resourcePropertiesCountIs(
      'AWS::Route53::RecordSet',
      { Name: 'app.example.com.' },
      1
    );
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'app.example.com.',
      Type: 'CNAME',
      ResourceRecords: ['my-site.web.app'],
    });
  });

  it('creates the record under the logical id the live stacks use', () => {
    // BacteriaGame deployed its CNAME under this id. A different id (or
    // scope) would replace the record and take the domain offline until
    // CloudFormation created the new one.
    expect(Object.keys(template.toJSON()['Resources'])).toEqual([
      'FirebaseHostingRecord7C7772EA',
    ]);
  });
});
