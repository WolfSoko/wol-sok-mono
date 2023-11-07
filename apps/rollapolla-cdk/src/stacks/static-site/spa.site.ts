import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  Distribution,
  OriginAccessIdentity,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { CanonicalUserPrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { ARecord, HostedZone, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface StaticSiteProps {
  domainName: string;
  buildOutputPath: string;
}

/**
 * SPA infrastructure, which deploys spa content to an S3 bucket.
 *
 * The spa redirects from HTTP to HTTPS, using a CloudFront distribution,
 * Route53 alias record, and ACM certificate.
 */
export class SpaSite extends Construct {
  constructor(
    parent: Construct,
    private readonly spaName: string,
    private readonly props: StaticSiteProps
  ) {
    super(parent, spaName);
    const zone = HostedZone.fromLookup(this, spaName, {
      privateZone: false,
      domainName: props.domainName,
    });
    // potential room for subdomains here.
    const siteDomain = props.domainName;
    const cloudfrontOAI = new OriginAccessIdentity(this, 'cloudfront-OAI', {
      comment: `OAI for ${this.spaName}`,
    });

    new CfnOutput(this, `${spaName}-Site:`, { value: 'https://' + siteDomain });

    const certificate = this.createCertificate(zone, props.domainName);
    const bucket = this.createBucket(siteDomain, cloudfrontOAI);
    const distribution = this.createDistribution(siteDomain, certificate, bucket, cloudfrontOAI);
    this.createARecord(siteDomain, distribution, zone);
    this.createBucketDeployment(props.buildOutputPath, bucket, distribution);
  }

  private createBucket(siteDomain: string, cloudfrontOAI: OriginAccessIdentity): Bucket {
    // Content bucket
    const siteBucket = new Bucket(this, `Bucket`, {
      bucketName: `${siteDomain}-spa-data`,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      /**
       * The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
       * the new bucket, and it will remain in your account until manually deleted. By setting the policy to
       * DESTROY, cdk destroy will attempt to delete the bucket, but will error if the bucket is not empty.
       */
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code

      /**
       * For sample purposes only, if you create an S3 bucket then populate it, stack destruction fails.  This
       * setting will enable full cleanup of the demo.
       */
      autoDeleteObjects: true, // NOT recommended for production code
    });

    // Grant access to cloudfront
    siteBucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [siteBucket.arnForObjects('*')],
        principals: [new CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)],
      })
    );

    new CfnOutput(this, `${siteDomain}-Bucket`, { value: siteBucket.bucketName });
    return siteBucket;
  }

  private createCertificate(zone: IHostedZone, domainName: string): Certificate {
    // TLS certificate
    const certificate = new Certificate(this, 'Certificate', {
      validation: CertificateValidation.fromEmail(),
      domainName,
    });

    new CfnOutput(this, `${this.spaName}-sCertificate`, { value: certificate.certificateArn });
    return certificate;
  }

  private createDistribution(
    siteDomain: string,
    certificate: Certificate,
    siteBucket: Bucket,
    cloudfrontOAI: OriginAccessIdentity
  ): Distribution {
    // CloudFront distribution that provides HTTPS
    // CloudFront distribution
    const distribution = new Distribution(this, 'Distribution', {
      certificate: certificate,
      defaultRootObject: 'index.html',
      domainNames: [siteDomain],
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(30),
        },
      ],
      defaultBehavior: {
        origin: new S3Origin(siteBucket, { originAccessIdentity: cloudfrontOAI }),
        compress: true,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });
    new CfnOutput(this, `${this.spaName}-DistributionId`, { value: distribution.distributionId });
    return distribution;
  }

  private createARecord(siteDomain: string, distribution: Distribution, zone: IHostedZone): void {
    // Route53 alias record for the CloudFront distribution
    new ARecord(this, 'SiteAliasRecord', {
      recordName: siteDomain,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      zone,
    });
    new CfnOutput(this, `${this.spaName}-ARecord`, { value: siteDomain });
  }

  private createBucketDeployment(buildOutputPath: string, spaBucket: Bucket, distribution: Distribution): void {
    // Deploy site contents to S3 spaBucket
    new BucketDeployment(this, 'DeployWithInvalidation', {
      sources: [Source.asset(buildOutputPath)],
      destinationBucket: spaBucket,
      distribution,
      distributionPaths: ['/*'],
    });
  }
}
