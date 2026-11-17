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

  it('keeps the logical id of the record', () => {
    // A new id would replace the record: the domain would go offline in
    // between, as a CNAME may not exist twice.
    expect(Object.keys(template.toJSON()['Resources'])).toEqual([
      expect.stringMatching(/^FirebaseHostingRecord[0-9A-F]{8}$/),
    ]);
  });
});
