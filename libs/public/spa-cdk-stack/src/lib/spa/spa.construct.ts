import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  Certificate,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  Distribution,
  OriginAccessIdentity,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { CanonicalUserPrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import {
  ARecord,
  HostedZone,
  IHostedZone,
  RecordTarget,
} from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface SpaProps {
  domainName: string;
  buildOutputPath: string;
  bucketRemovalPolicy?: RemovalPolicy;
}

const defaultBucketRemovalPolicy: RemovalPolicy = RemovalPolicy.DESTROY;

/**
 * SPA infrastructure, which deploys spa content to an S3 bucket.
 *
 * The spa redirects from HTTP to HTTPS, uses a CloudFront distribution,
 * Route53 alias record,
 * and ACM certificate.
 */
export class SpaConstruct extends Construct {
  constructor(
    parent: Construct,
    private readonly spaName: string,
    private readonly props: SpaProps
  ) {
    super(parent, spaName);
    const removalPolicy: RemovalPolicy =
      props.bucketRemovalPolicy ?? defaultBucketRemovalPolicy;
    const { buildOutputPath } = props;

    const { mainDomain, subDomainWildcard, siteDomain } = this.extractDomains(
      props.domainName
    );

    const zone = HostedZone.fromLookup(this, spaName, {
      privateZone: false,
      domainName: mainDomain,
    });

    const cloudfrontOAI = new OriginAccessIdentity(this, 'cloudfront-OAI', {
      comment: `OriginAccessIdentity for ${this.spaName}`,
    });

    new CfnOutput(this, `${spaName}-Site:`, { value: 'https://' + siteDomain });

    let certificate: Certificate;

    if (mainDomain === siteDomain) {
      certificate = this.createCertificate(zone, mainDomain);
    } else {
      certificate = this.createCertificate(zone, mainDomain, subDomainWildcard);
    }

    const bucket = this.createBucket(siteDomain, cloudfrontOAI, removalPolicy);
    const distribution = this.createDistribution(
      siteDomain,
      certificate,
      bucket,
      cloudfrontOAI
    );
    this.createARecord(siteDomain, distribution, zone);
    this.createBucketDeployment(buildOutputPath, bucket, distribution);
  }

  private createBucket(
    siteDomain: string,
    cloudfrontOAI: OriginAccessIdentity,
    removalPolicy: RemovalPolicy = RemovalPolicy.DESTROY
  ): Bucket {
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
      removalPolicy: removalPolicy,

      /**
       * For sample purposes only, if you create an S3 bucket then populate it, stack destruction fails.  This
       * setting will enable full cleanup of the demo.
       */
      autoDeleteObjects: removalPolicy === RemovalPolicy.DESTROY, // Danger not recommended for production code
    });

    // Grant access to cloudfront
    siteBucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [siteBucket.arnForObjects('*')],
        principals: [
          new CanonicalUserPrincipal(
            cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    new CfnOutput(this, `${siteDomain}-Bucket`, {
      value: siteBucket.bucketName,
    });
    return siteBucket;
  }

  private createCertificate(
    zone: IHostedZone,
    ...domainNames: string[]
  ): Certificate {
    const [mainDomain, ...restofDomains] = domainNames;

    // TLS certificate
    const certificate = new Certificate(this, 'Certificate', {
      validation: CertificateValidation.fromDns(zone),
      domainName: mainDomain,
      subjectAlternativeNames: restofDomains,
    });

    new CfnOutput(this, `${this.spaName}-sCertificate`, {
      value: certificate.certificateArn,
    });
    return certificate;
  }

  private createDistribution(
    siteDomain: string,
    certificate: Certificate,
    siteBucket: Bucket,
    cloudfrontOAI: OriginAccessIdentity
  ): Distribution {
    // CloudFront distribution that provides HTTPS
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
        origin: new S3Origin(siteBucket, {
          originAccessIdentity: cloudfrontOAI,
        }),
        compress: true,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });
    new CfnOutput(this, `${this.spaName}-DistributionId`, {
      value: distribution.distributionId,
    });
    return distribution;
  }

  private createARecord(
    siteDomain: string,
    distribution: Distribution,
    zone: IHostedZone
  ): void {
    // Route53 alias record for the CloudFront distribution
    new ARecord(this, 'SiteAliasRecord', {
      recordName: siteDomain,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      zone,
    });
    new CfnOutput(this, `${this.spaName}-ARecord`, { value: siteDomain });
  }

  private createBucketDeployment(
    buildOutputPath: string,
    spaBucket: Bucket,
    distribution: Distribution
  ): void {
    // Deploy site contents to S3 spaBucket
    new BucketDeployment(this, 'DeployWithInvalidation', {
      sources: [Source.asset(buildOutputPath)],
      destinationBucket: spaBucket,
      distribution,
      distributionPaths: ['/*'],
    });
  }

  private extractDomains(domainName: string): {
    subDomainWildcard: string;
    mainDomain: string;
    siteDomain: string;
  } {
    // extract main domain
    const siteDomain = domainName;
    const mainDomain = domainName.split('.').slice(-2).join('.');
    const subDomainWildcard: string =
      mainDomain === siteDomain ? mainDomain : `*.${mainDomain}`;

    // inform user about domain handling
    if (mainDomain !== siteDomain) {
      console.warn(
        `The domain ${siteDomain} is not a top level domain. The certificate will be created for *.${mainDomain}`
      );
    }
    return { siteDomain, mainDomain, subDomainWildcard };
  }
}
