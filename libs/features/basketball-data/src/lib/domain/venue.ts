/** Where a Spiel is played. */
export interface Venue {
  readonly name: string;
  readonly street?: string;
  readonly postcode?: string;
  readonly town?: string;
}

const MAPS_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=';

/** The Halle's address on one line, leaving out what the DBB lacks. */
export function venueAddress(venue: Venue): string {
  const townLine = [venue.postcode, venue.town].filter(isPresent).join(' ');
  return [venue.street, townLine].filter(isPresent).join(', ');
}

/**
 * A link that opens navigation to the Halle: the maps app on a phone, the
 * map in a browser.
 */
export function venueNavigationUrl(venue: Venue): string {
  const destination = [venue.name, venueAddress(venue)]
    .filter(isPresent)
    .join(', ');
  return MAPS_SEARCH_URL + encodeURIComponent(destination);
}

function isPresent(part: string | undefined): part is string {
  return part !== undefined && part !== '';
}
