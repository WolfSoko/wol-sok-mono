import { venueAddress, venueNavigationUrl, type Venue } from './venue';

const VENUE: Venue = {
  name: 'Basketball Center Hauptsmoor',
  street: 'Hauptsmoorstr. 2',
  postcode: '96129',
  town: 'Strullendorf',
};

describe('Venue', () => {
  it('writes the address on one line', () => {
    expect(venueAddress(VENUE)).toBe('Hauptsmoorstr. 2, 96129 Strullendorf');
  });

  it('leaves out what the DBB lacks', () => {
    expect(venueAddress({ name: 'Weinberghalle', town: 'Ansbach' })).toBe(
      'Ansbach'
    );
    expect(venueAddress({ name: 'Weinberghalle' })).toBe('');
  });

  it('links navigation to the name and address', () => {
    expect(venueNavigationUrl(VENUE)).toBe(
      'https://www.google.com/maps/search/?api=1&query=' +
        'Basketball%20Center%20Hauptsmoor%2C%20Hauptsmoorstr.%202%2C%2096129%20Strullendorf'
    );
  });
});
