import { abgleichen } from './abgleichen';

describe('abgleichen', () => {
  it('makes an entry for each new key, in the keys’ order', () => {
    const lesen = vi.fn((key: string) => ({ key }));

    const neu = abgleichen(new Map(), ['b', 'a'], lesen, vi.fn());

    expect([...neu.keys()]).toEqual(['b', 'a']);
    expect(neu.get('a')).toEqual({ key: 'a' });
    expect(lesen).toHaveBeenCalledTimes(2);
  });

  it('keeps the entries of keys still named, as they are', () => {
    const a = { key: 'a' };
    const lesen = vi.fn((key: string) => ({ key }));

    const neu = abgleichen(new Map([['a', a]]), ['a', 'b'], lesen, vi.fn());

    expect(neu.get('a')).toBe(a);
    expect(lesen).toHaveBeenCalledExactlyOnceWith('b');
  });

  it('ends the entries no key names any more, and drops them', () => {
    const a = { key: 'a' };
    const b = { key: 'b' };
    const ende = vi.fn();

    const neu = abgleichen(
      new Map([
        ['a', a],
        ['b', b],
      ]),
      ['b'],
      (key: string) => ({ key }),
      ende
    );

    expect([...neu.keys()]).toEqual(['b']);
    expect(ende).toHaveBeenCalledExactlyOnceWith(a);
  });

  it('takes a key named twice once', () => {
    const lesen = vi.fn((key: string) => ({ key }));

    const neu = abgleichen(new Map(), ['a', 'a'], lesen, vi.fn());

    expect(neu.size).toBe(1);
    expect(lesen).toHaveBeenCalledTimes(1);
  });

  it('follows the keys’ new order', () => {
    const a = { key: 'a' };
    const b = { key: 'b' };

    const neu = abgleichen(
      new Map([
        ['a', a],
        ['b', b],
      ]),
      ['b', 'a'],
      (key: string) => ({ key }),
      vi.fn()
    );

    expect([...neu.values()]).toEqual([b, a]);
  });
});
