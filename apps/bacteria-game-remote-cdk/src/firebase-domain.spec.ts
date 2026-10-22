import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { SpaStack } from '@wolsok/spa-cdk-stack';
import { addFirebaseDomain } from './firebase-domain';

describe('addFirebaseDomain', () => {
  function spaStack(): SpaStack {
    return new SpaStack(new App(), 'BacteriaGame', {
      env: { region: 'us-east-1', account: '123456789012' },
      domainName: 'bacteria-game.wolsok.de',
      buildOutputPath: __dirname,
    });
  }

  const stack = spaStack();
  addFirebaseDomain(stack, {
    zoneName: 'wolsok.de',
    domain: 'bacteria-wars.wolsok.de',
    site: 'bacteria-wars',
  });
  const template = Template.fromStack(stack);

  it('points the domain at Firebase Hosting and proves it is the site’s', () => {
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'bacteria-wars.wolsok.de.',
      Type: 'A',
      ResourceRecords: ['199.36.158.100'],
    });
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'bacteria-wars.wolsok.de.',
      Type: 'TXT',
      ResourceRecords: ['"hosting-site=bacteria-wars"'],
    });
  });

  it('leaves the resources of the stack as they were', () => {
    const before = Object.keys(
      Template.fromStack(spaStack()).toJSON()['Resources']
    );
    const after = Object.keys(template.toJSON()['Resources']);

    expect(after).toEqual(expect.arrayContaining(before));
    expect(after).toHaveLength(before.length + 2);
  });
});
