import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { addFirebaseDomain } from './firebase-domain';

describe('addFirebaseDomain', () => {
  const stack = new Stack(new App(), 'BacteriaGame', {
    env: { region: 'us-east-1', account: '123456789012' },
  });
  addFirebaseDomain(stack, {
    domain: 'bacteria-wars.wolsok.de',
    site: 'bacteria-wars',
  });
  const template = Template.fromStack(stack);

  it('points the domain at the Firebase Hosting site', () => {
    template.resourcePropertiesCountIs(
      'AWS::Route53::RecordSet',
      { Name: 'bacteria-wars.wolsok.de.' },
      1
    );
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'bacteria-wars.wolsok.de.',
      Type: 'CNAME',
      ResourceRecords: ['bacteria-wars.web.app'],
    });
  });

  it('keeps the logical id the record had next to the old site', () => {
    // A new id would replace the record: the domain would go offline in
    // between, as a CNAME may not exist twice.
    expect(Object.keys(template.toJSON()['Resources'])).toEqual([
      expect.stringMatching(/^FirebaseHostingRecord[0-9A-F]{8}$/),
    ]);
  });
});
