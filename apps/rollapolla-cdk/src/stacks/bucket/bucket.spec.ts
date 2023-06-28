import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Bucket } from './bucket';

describe('RollaPolla Bucket', () => {
  let stack: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const rollAPollaStack = new Bucket(app, 'RollAPollaBucket', { buildOutputPath: 'test-build-path' });
    stack = Template.fromStack(rollAPollaStack);
  });

  describe('the included S3 Bucket', () => {
    it('should have the correct name', () => {
      thenBucketHasResourceProperties({
        BucketName: 'roll-a-polla',
      });
    });

    it('should have the correct website index document', () => {
      thenBucketHasResourceProperties({
        WebsiteConfiguration: {
          IndexDocument: 'index.html',
        },
      });
    });

    it('should have public read access policy', () => {
      stack.hasResourceProperties('AWS::S3::BucketPolicy', {
        Bucket: { Ref: Match.stringLikeRegexp('rollAPolla') },
        PolicyDocument: {
          Statement: [
            {
              Action: 's3:GetObject',
              Effect: 'Allow',
              Principal: { AWS: '*' },
            },
          ],
        },
      });
    });

    it('should have the destroy removal policy', () => {
      stack.hasResource('AWS::S3::Bucket', {
        UpdateReplacePolicy: 'Delete',
      });
    });

    function thenBucketHasResourceProperties(props: any) {
      stack.hasResourceProperties('AWS::S3::Bucket', props);
    }
  });

  describe('the included BucketDeployment', () => {
    const expectedBucketDeployment = 'Custom::CDKBucketDeployment';

    it('should include a BucketDeployment', () => {
      stack.resourceCountIs(expectedBucketDeployment, 1);
    });

    it('should deploy to the rollapolla bucket', () => {
      stack.hasResourceProperties(expectedBucketDeployment, {
        DestinationBucketName: { Ref: Match.stringLikeRegexp('rollAPolla') },
      });
    });

    it('should have a source zip object key', () => {
      stack.hasResourceProperties(expectedBucketDeployment, {
        SourceObjectKeys: Match.arrayWith([Match.stringLikeRegexp('.zip')]),
      });
    });
  });
});
