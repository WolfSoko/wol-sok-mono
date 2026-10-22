import { Stack } from 'aws-cdk-lib';
import {
  ARecord,
  HostedZone,
  RecordTarget,
  TxtRecord,
} from 'aws-cdk-lib/aws-route53';

export interface FirebaseDomainProps {
  /** The zone the domain lives in, "wolsok.de". */
  zoneName: string;
  /** The custom domain of the Firebase Hosting site. */
  domain: string;
  /** The Firebase Hosting site the domain points at. */
  site: string;
}

/** Firebase Hosting's address for custom domains. */
const FIREBASE_HOSTING_IP = '199.36.158.100';

/**
 * The records Firebase Hosting asks for when a custom domain is added: the
 * address of its servers and the proof that the domain is the site's. They
 * sit on the stack itself, under ids of their own, so they stay put however
 * the rest of the stack changes.
 */
export function addFirebaseDomain(
  stack: Stack,
  { zoneName, domain, site }: FirebaseDomainProps
): void {
  const zone = HostedZone.fromLookup(stack, 'FirebaseDomainZone', {
    privateZone: false,
    domainName: zoneName,
  });
  new ARecord(stack, 'FirebaseHostingRecord', {
    recordName: domain,
    target: RecordTarget.fromIpAddresses(FIREBASE_HOSTING_IP),
    zone,
  });
  new TxtRecord(stack, 'FirebaseHostingVerification', {
    recordName: domain,
    values: [`hosting-site=${site}`],
    zone,
  });
}
