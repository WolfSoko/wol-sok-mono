import { optionalField } from './optional-field';

describe('optionalField', () => {
  it('holds a present value under its key', () => {
    expect(optionalField('bezirk', 'Oberbayern')).toEqual({
      bezirk: 'Oberbayern',
    });
    expect(optionalField('punkte', 0)).toEqual({ punkte: 0 });
  });

  it('leaves an absent value out', () => {
    expect(optionalField('bezirk', undefined)).toEqual({});
    expect('bezirk' in optionalField('bezirk', undefined)).toBe(false);
  });
});
