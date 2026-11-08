import { ownValue } from './own-value';

describe('ownValue', () => {
  const table = { m: 'männlich' };

  it('finds a key of the table', () => {
    expect(ownValue(table, 'm')).toBe('männlich');
  });

  it.each(['constructor', 'toString', '__proto__', 'x'])(
    'finds nothing for %s',
    (key) => {
      expect(ownValue(table, key)).toBeUndefined();
    }
  );
});
