import { halleAdresse, halleNavigationUrl, type Halle } from './halle';

const HALLE: Halle = {
  name: 'Basketball Center Hauptsmoor',
  strasse: 'Hauptsmoorstr. 2',
  plz: '96129',
  ort: 'Strullendorf',
};

describe('Halle', () => {
  it('writes the address on one line', () => {
    expect(halleAdresse(HALLE)).toBe('Hauptsmoorstr. 2, 96129 Strullendorf');
  });

  it('leaves out what the DBB lacks', () => {
    expect(halleAdresse({ name: 'Weinberghalle', ort: 'Ansbach' })).toBe(
      'Ansbach'
    );
    expect(halleAdresse({ name: 'Weinberghalle' })).toBe('');
  });

  it('links navigation to the name and address', () => {
    expect(halleNavigationUrl(HALLE)).toBe(
      'https://www.google.com/maps/search/?api=1&query=' +
        'Basketball%20Center%20Hauptsmoor%2C%20Hauptsmoorstr.%202%2C%2096129%20Strullendorf'
    );
  });
});
