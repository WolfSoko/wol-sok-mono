import { Stack } from 'aws-cdk-lib';
import { CnameRecord, HostedZone } from 'aws-cdk-lib/aws-route53';

export interface FirebaseDomainProps {
  /** The custom domain of the Firebase Hosting site, in a zone of Route53. */
  domain: string;
  /** The Firebase Hosting site the domain points at. */
  site: string;
}

/**
 * Adds the record Firebase Hosting asks for when a subdomain is connected: a
 * CNAME from the domain to `<site>.web.app`, the site's default address, which
 * also verifies that the domain belongs to the site. No other record may share
 * a CNAME's name.
 *
 * The record is a direct child of the stack with a constant logical id.
 * Changing the id or the scope makes CloudFormation replace the record, and
 * the domain stops resolving until the replacement exists.
 */
export function addFirebaseDomain(
  stack: Stack,
  { domain, site }: FirebaseDomainProps
): void {
  // The zone is the domain's last two labels.
  const zone = HostedZone.fromLookup(stack, 'FirebaseDomainZone', {
    privateZone: false,
    domainName: domain.split('.').slice(-2).join('.'),
  });
  new CnameRecord(stack, 'FirebaseHostingRecord', {
    recordName: domain,
    domainName: `${site}.web.app`,
    zone,
  });
}
