/**
 * Who runs the sites (Bacteria Wars, RollaPolla, wolsok.de), for their legal
 * notices (Impressum, § 5 DDG, § 18 MStV) and privacy policies: the
 * controller under the GDPR. `addressLines` is the postal address legal mail
 * reaches (street and number, postal code and town), shown line by line
 * after the name. `vatId` is the VAT identification number (§ 27a UStG),
 * which the legal notices name (§ 5 Abs. 1 Nr. 6 DDG).
 */
export const SITE_OWNER = {
  name: 'Wolfram Sokollek',
  email: 'privacy@wolsok.de',
  addressLines: ['Korte Asper 8', '21565 Wentorf'],
  vatId: 'DE292089296',
} as const;
