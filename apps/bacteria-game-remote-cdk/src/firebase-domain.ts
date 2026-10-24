import { Stack } from 'aws-cdk-lib';
import { CnameRecord, HostedZone } from 'aws-cdk-lib/aws-route53';

export interface FirebaseDomainProps {
  /** The custom domain of the Firebase Hosting site, in a zone of Route53. */
  domain: string;
  /** The Firebase Hosting site the domain points at. */
  site: string;
}

/**
 * The record Firebase Hosting asks for when a subdomain is added: a CNAME to
 * the site's own address, `<site>.web.app`, which also proves the domain is
 * the site's. A CNAME allows no other record of the same name. It sits on the
 * stack itself under the id it has had since the old site shared the stack:
 * a new id would replace the record, and the domain would be down meanwhile.
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
