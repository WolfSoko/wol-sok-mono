/**
 * Who runs the sites (Bacteria Wars, RollaPolla, wolsok.de), for their legal
 * notices (Impressum, § 5 DDG, § 18 MStV) and privacy policies: the
 * controller under the GDPR. `addressLines` is the postal address legal mail
 * reaches (street and number, postal code and town), shown line by line
 * after the name.
 */
export const SITE_OWNER = {
  name: 'Wolfram Sokollek',
  email: 'privacy@wolsok.de',
  addressLines: ['Korte Asper 8', '21565 Wentorf'],
} as const;
