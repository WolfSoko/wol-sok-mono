import { CfnOutput, Duration, FileSystem, RemovalPolicy } from 'aws-cdk-lib';
import {
  Certificate,
  CertificateValidation,
  ICertificate,
} from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  Distribution,
  HttpVersion,
  IDistribution,
  ResponseHeadersPolicy,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  ARecord,
  HostedZone,
  IHostedZone,
  RecordTarget,
} from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import {
  BucketDeployment,
  CacheControl,
  ISource,
  Source,
} from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface SpaProps {
  domainName: string;
  buildOutputPath: string;
  bucketRemovalPolicy?: RemovalPolicy;
  extraAllowedOrigins?: string[];
  /**
   * The certificate of the distribution, which CloudFront only takes from
   * us-east-1. Without it the construct creates one, so it must then sit in a
   * us-east-1 stack. SpaStack passes one when its region is another.
   */
  certificate?: ICertificate;
  /**
   * Files that keep their names across releases, such as a service worker,
   * its ngsw.json or an import map, as globs relative to buildOutputPath.
   * They are served with no-cache instead of the one year max-age the hashed
   * bundles get, and are uploaded after those bundles.
   */
  noCacheFiles?: string[];
  /**
   * Files that get their own Cache-Control, and optionally Content-Type,
   * instead of the one year max-age, as globs relative to buildOutputPath.
   * Like noCacheFiles, they are left out of the main deployment and uploaded
   * after it, so each file is written once with one header. Keep the globs
   * of different entries disjoint: a file matched twice is uploaded twice and
   * the later header wins. Wildcards may only appear in the last segment.
   */
  cacheOverrides?: CacheOverride[];
}

interface DeploymentOptions {
  /** @default one year max-age */
  cacheControl?: CacheControl;
  /** Set, the deployment invalidates every path of this distribution once its upload is done. */
  distribution?: IDistribution;
  contentType?: string;
  /** Object metadata; also part of the deployment's properties, so a change reruns it. */
  metadata?: Record<string, string>;
}

export interface CacheOverride {
  /** Globs relative to buildOutputPath, e.g. `assets/manifest*.json`. */
  files: string[];
  cacheControl: CacheControl;
  contentType?: string;
}

/**
 * Exclude globs that keep only `files`. '**' also skips every folder as a
 * whole, so the folders above a nested file are re-included first, and
 * `<glob>/**` keeps the contents of a glob that names a folder.
 */
function onlyInclude(files: string[]): string[] {
  const included = new Set<string>();
  for (const file of files) {
    const folders = file.split('/').slice(0, -1);
    if (folders.some((folder) => /[*?[\]{}]/.test(folder))) {
      // Re-including a folder wildcard such as `assets/*` would also bring
      // back the files it matches, so they would be uploaded twice again.
      throw new Error(
        `Wildcards are only supported in the last segment: ${file}`
      );
    }
    folders.forEach((_, i) => included.add(folders.slice(0, i + 1).join('/')));
    included.add(file);
    included.add(file + '/**');
  }
  return ['**', ...[...included].map((glob) => '!' + glob)];
}

/**
 * The names the certificate of a SPA covers: the main domain, and the site
 * domain as well when it is a subdomain.
 */
export function certificateDomainNames(domainName: string): string[] {
  const mainDomain = domainName.split('.').slice(-2).join('.');
  return mainDomain === domainName ? [mainDomain] : [mainDomain, domainName];
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
  private bucketDeployments: BucketDeployment[] = [];
  private readonly indexDeployment: BucketDeployment;
  private lastUpload: BucketDeployment;
  private readonly bucket: Bucket;
  private readonly distribution: Distribution;

  constructor(
    parent: Construct,
    private readonly spaName: string,
    props: SpaProps
  ) {
    super(parent, spaName);
    const removalPolicy: RemovalPolicy =
      props.bucketRemovalPolicy ?? defaultBucketRemovalPolicy;
    const {
      buildOutputPath,
      extraAllowedOrigins,
      noCacheFiles = [],
      cacheOverrides = [],
    } = props;
    const overrides: CacheOverride[] = [
      ...(noCacheFiles.length > 0
        ? [{ files: noCacheFiles, cacheControl: CacheControl.noCache() }]
        : []),
      ...cacheOverrides,
    ];

    const { mainDomain, siteDomain } = this.extractDomains(props.domainName);

    const zone = HostedZone.fromLookup(this, spaName, {
      privateZone: false,
      domainName: mainDomain,
    });

    new CfnOutput(this, `${spaName}-Site:`, { value: 'https://' + siteDomain });

    const certificate: ICertificate =
      props.certificate ??
      this.createCertificate(zone, ...certificateDomainNames(siteDomain));

    this.bucket = this.createBucket(siteDomain, removalPolicy);

    this.distribution = this.createDistribution(
      siteDomain,
      certificate,
      this.bucket,
      extraAllowedOrigins
    );
    this.createARecord(siteDomain, this.distribution, zone);

    // No deployment prunes: a pruning sync of index.html alone would delete
    // every other file, and an upload whose asset did not change is not run
    // again to restore it. Old bundles stay for tabs still running them.
    // The first deployment owns the handler that all of them share, so the
    // build output comes first and index.html, which waits for the rest, second.
    // The build output's deployments share one invalidation, issued by the
    // index.html deployment: each invalidation is waited for, and one after
    // the last upload covers them all. A fingerprint of the build output in
    // that deployment's metadata reruns it, and with it the invalidation,
    // whenever any file of the build output changed, even if index.html did not.
    this.lastUpload = this.createBucketDeployment([
      Source.asset(buildOutputPath, {
        exclude: ['index.html', ...overrides.flatMap(({ files }) => files)],
      }),
    ]);
    this.bucketDeployments.push(this.lastUpload);

    // index.html goes last, once every file it points at is uploaded.
    this.indexDeployment = this.createBucketDeployment(
      [Source.asset(buildOutputPath, { exclude: ['**', '!index.html'] })],
      {
        cacheControl: CacheControl.noCache(),
        distribution: this.distribution,
        metadata: {
          'build-fingerprint': FileSystem.fingerprint(buildOutputPath),
        },
      }
    );
    this.bucketDeployments.push(this.indexDeployment);
    this.indexDeployment.node.addDependency(this.lastUpload);

    for (const { files, cacheControl, contentType } of overrides) {
      this.addUpload(
        [Source.asset(buildOutputPath, { exclude: onlyInclude(files) })],
        { cacheControl, contentType }
      );
    }
  }

  /**
   * Add some additional assets to the bucket of the SPA, uploaded after the
   * build output and before index.html. Use it for files that are not in
   * buildOutputPath; for those that are, use noCacheFiles or cacheOverrides,
   * or they are uploaded twice. Not being part of the build output, these
   * assets are not covered by its fingerprint, so their deployment invalidates
   * the distribution on its own.
   */
  public addExtraAssets(
    assets: ISource[],
    cacheControl: CacheControl = CacheControl.maxAge(Duration.days(365)),
    contentType?: string
  ): void {
    this.addUpload(assets, {
      cacheControl,
      contentType,
      distribution: this.distribution,
    });
  }

  /** Adds a deployment that runs after the uploads so far and before index.html. */
  private addUpload(sources: ISource[], options: DeploymentOptions): void {
    const deployment = this.createBucketDeployment(sources, options);
    deployment.node.addDependency(this.lastUpload);
    this.lastUpload = deployment;
    this.bucketDeployments.push(deployment);
    this.indexDeployment.node.addDependency(deployment);
  }

  private createBucket(
    siteDomain: string,
    removalPolicy: RemovalPolicy = RemovalPolicy.DESTROY
  ): Bucket {
    // Content bucket
    const siteBucket = new Bucket(this, `Bucket`, {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
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
    certificate: ICertificate,
    siteBucket: IBucket,
    allowedOrigins: string[] = []
  ): Distribution {
    const responseHeadersPolicy = new ResponseHeadersPolicy(
      this,
      'ResponseHeadersPolicy',
      {
        corsBehavior: {
          accessControlAllowCredentials: false,
          accessControlAllowOrigins: [
            ...allowedOrigins,
            'https://' + siteDomain,
            'http://localhost',
            'http://127.0.0.1',
          ],
          accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
          accessControlAllowHeaders: ['*'],
          originOverride: true,
        },
      }
    );
    // CloudFront distribution that provides HTTPS
    const distribution = new Distribution(this, 'Distribution', {
      certificate: certificate,
      defaultRootObject: 'index.html',
      domainNames: [siteDomain],
      httpVersion: HttpVersion.HTTP2_AND_3,
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
        responseHeadersPolicy,
        origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
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
    sources: ISource[],
    {
      cacheControl = CacheControl.maxAge(Duration.days(365)),
      distribution,
      contentType,
      metadata,
    }: DeploymentOptions = {}
  ): BucketDeployment {
    // The construct id is kept for every deployment, invalidating or not, so
    // that existing stacks keep their logical ids; the spec guards it.
    return new BucketDeployment(
      this,
      'DeployWithInvalidation' + (this.bucketDeployments.length + 1),
      {
        sources,
        destinationBucket: this.bucket,
        prune: false,
        memoryLimit: 1024,
        cacheControl: [cacheControl],
        ...(distribution ? { distribution, distributionPaths: ['/*'] } : {}),
        ...(contentType ? { contentType } : {}),
        ...(metadata ? { metadata } : {}),
      }
    );
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
