/** Where a Spiel is played. */
export interface Halle {
  readonly name: string;
  readonly strasse?: string;
  readonly plz?: string;
  readonly ort?: string;
}

const MAPS_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=';

/** The Halle's address on one line, leaving out what the DBB lacks. */
export function halleAdresse(halle: Halle): string {
  const ortszeile = [halle.plz, halle.ort].filter(isPresent).join(' ');
  return [halle.strasse, ortszeile].filter(isPresent).join(', ');
}

/**
 * A link that opens navigation to the Halle: the maps app on a phone, the
 * map in a browser.
 */
export function halleNavigationUrl(halle: Halle): string {
  const ziel = [halle.name, halleAdresse(halle)].filter(isPresent).join(', ');
  return MAPS_SEARCH_URL + encodeURIComponent(ziel);
}

function isPresent(part: string | undefined): part is string {
  return part !== undefined && part !== '';
}
