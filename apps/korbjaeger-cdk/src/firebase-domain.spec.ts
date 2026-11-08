import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { addFirebaseDomain } from './firebase-domain';

describe('addFirebaseDomain', () => {
  const stack = new Stack(new App(), 'Korbjaeger', {
    env: { region: 'us-east-1', account: '123456789012' },
  });
  addFirebaseDomain(stack, { domain: 'korb.wolsok.de', site: 'korbjaeger' });
  const template = Template.fromStack(stack);

  it('points the domain at the Firebase Hosting site', () => {
    template.resourcePropertiesCountIs(
      'AWS::Route53::RecordSet',
      { Name: 'korb.wolsok.de.' },
      1
    );
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'korb.wolsok.de.',
      Type: 'CNAME',
      ResourceRecords: ['korbjaeger.web.app'],
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
