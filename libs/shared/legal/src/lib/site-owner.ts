/**
 * Who runs the sites (Bacteria Wars, RollaPolla), for their legal notices
 * (Impressum, § 5 DDG) and privacy policies: the controller under the GDPR.
 * The address lines are what § 5 DDG asks for beside the name: street and
 * number, postal code and town, country - to fill in before the next
 * release of the sites.
 */
export const SITE_OWNER = {
  name: 'Wolfram Sokollek',
  email: 'privacy@wolsok.de',
  addressLines: [] as readonly string[],
} as const;
