import { reconcile } from './reconcile';

describe('reconcile', () => {
  it('makes an entry for each new key, in the keys’ order', () => {
    const read = vi.fn((key: string) => ({ key }));

    const added = reconcile(new Map(), ['b', 'a'], read, vi.fn());

    expect([...added.keys()]).toEqual(['b', 'a']);
    expect(added.get('a')).toEqual({ key: 'a' });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('keeps the entries of keys still named, as they are', () => {
    const a = { key: 'a' };
    const read = vi.fn((key: string) => ({ key }));

    const added = reconcile(new Map([['a', a]]), ['a', 'b'], read, vi.fn());

    expect(added.get('a')).toBe(a);
    expect(read).toHaveBeenCalledExactlyOnceWith('b');
  });

  it('ends the entries no key names any more, and drops them', () => {
    const a = { key: 'a' };
    const b = { key: 'b' };
    const end = vi.fn();

    const added = reconcile(
      new Map([
        ['a', a],
        ['b', b],
      ]),
      ['b'],
      (key: string) => ({ key }),
      end
    );

    expect([...added.keys()]).toEqual(['b']);
    expect(end).toHaveBeenCalledExactlyOnceWith(a);
  });

  it('takes a key named twice once', () => {
    const read = vi.fn((key: string) => ({ key }));

    const added = reconcile(new Map(), ['a', 'a'], read, vi.fn());

    expect(added.size).toBe(1);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('follows the keys’ new order', () => {
    const a = { key: 'a' };
    const b = { key: 'b' };

    const added = reconcile(
      new Map([
        ['a', a],
        ['b', b],
      ]),
      ['b', 'a'],
      (key: string) => ({ key }),
      vi.fn()
    );

    expect([...added.values()]).toEqual([b, a]);
  });
});
