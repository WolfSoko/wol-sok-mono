import { settleAll } from './settle';

describe('settleAll', () => {
  it('returns the values in order', async () => {
    const [a, b, c] = await settleAll([
      Promise.resolve(1),
      'two',
      Promise.resolve(undefined),
    ]);
    expect([a, b, c]).toEqual([1, 'two', undefined]);
  });

  it('lets every step run, then throws the first failure', async () => {
    const ran: string[] = [];
    const step = (name: string, fail = false) =>
      new Promise<string>((resolve, reject) =>
        setTimeout(() => {
          ran.push(name);
          if (fail) {
            reject(new Error(name));
          } else {
            resolve(name);
          }
        }, 1)
      );
    await expect(
      settleAll([step('a', true), step('b'), step('c', true)])
    ).rejects.toThrow('a');
    expect(ran.sort()).toEqual(['a', 'b', 'c']);
  });
});
