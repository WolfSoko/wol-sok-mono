import { Stack, StackProps } from 'aws-cdk-lib';
import {
  Certificate,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import {
  certificateDomainNames,
  SpaConstruct,
  SpaProps,
} from './spa.construct';

export type SpaStackProps = StackProps & SpaProps;

/** CloudFront only takes certificates from this region. */
export const CLOUDFRONT_CERTIFICATE_REGION = 'us-east-1';

/**
 * A stack that holds a single SpaConstruct with the same id as the stack.
 * Extend it and call `spa.addExtraAssets` to deploy further files.
 *
 * In a region other than us-east-1 the certificate goes into a second stack,
 * `<name>Certificate` in us-east-1, which the SPA stack references across
 * regions. Deploy the app with `--all`, or name the SPA stack: CDK deploys
 * the certificate stack first either way.
 */
export class SpaStack extends Stack {
  public readonly spa: SpaConstruct;

  constructor(parent: Construct, name: string, props: SpaStackProps) {
    const region = props.env?.region;
    const certificateElsewhere =
      !props.certificate &&
      region !== undefined &&
      region !== CLOUDFRONT_CERTIFICATE_REGION;
    super(parent, name, {
      ...props,
      crossRegionReferences:
        props.crossRegionReferences || certificateElsewhere,
    });

    const certificate = certificateElsewhere
      ? new SpaCertificateStack(parent, `${name}Certificate`, {
          env: { ...props.env, region: CLOUDFRONT_CERTIFICATE_REGION },
          domainName: props.domainName,
        }).certificate
      : props.certificate;

    // SpaConstruct only reads its own props, so new SpaProps fields pass through.
    this.spa = new SpaConstruct(this, name, { ...props, certificate });
  }
}

export interface SpaCertificateStackProps extends StackProps {
  domainName: string;
}

/** The certificate of a SPA, in a stack that other regions can reference. */
export class SpaCertificateStack extends Stack {
  public readonly certificate: Certificate;

  constructor(
    parent: Construct,
    name: string,
    { domainName, ...props }: SpaCertificateStackProps
  ) {
    super(parent, name, { ...props, crossRegionReferences: true });

    const [mainDomain, ...otherDomains] = certificateDomainNames(domainName);
    const zone = HostedZone.fromLookup(this, 'Zone', {
      privateZone: false,
      domainName: mainDomain,
    });
    this.certificate = new Certificate(this, 'Certificate', {
      validation: CertificateValidation.fromDns(zone),
      domainName: mainDomain,
      subjectAlternativeNames: otherDomains,
    });
  }
}
