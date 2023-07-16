import { Stack } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Distribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { ARecord, HostedZone, PublicHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { NetworkStackProps } from './network-stack.props';

export class NetworkStack extends Stack {
  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);
    this.createNetworkStack(props);
  }

  private createNetworkStack({ websiteBucket, domainName }: NetworkStackProps) {
    // Lookup existing domain zone
    const zone = new PublicHostedZone(this, 'RollaPollaZone', { zoneName: domainName });

    // Create a certificate
    const certificate = new Certificate(this, 'RollaPollaCertificate', {
      domainName: domainName,
    });

    // CloudFront distribution that provides HTTPS
    const distribution = new Distribution(this, 'RollaPollaDistribution', {
      defaultBehavior: {
        origin: new S3Origin(websiteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      domainNames: [domainName],
      certificate: certificate,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Route53 alias record for the CloudFront distribution
    new ARecord(this, 'RollaPollaAliasRecord', {
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      zone,
    });
  }
}
