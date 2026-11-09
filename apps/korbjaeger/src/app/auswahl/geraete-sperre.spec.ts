import { geraeteSperre, type Schloesser } from './geraete-sperre';

describe('geraeteSperre', () => {
  it('runs under the Web Lock of its name', async () => {
    const angefragt: string[] = [];
    const schloesser: Schloesser = {
      request: ((name: string, tun: () => unknown) => {
        angefragt.push(name);
        return Promise.resolve(tun());
      }) as Schloesser['request'],
    };

    expect(await geraeteSperre('korbjaeger-auswahl', schloesser)(() => 7)).toBe(
      7
    );
    expect(angefragt).toEqual(['korbjaeger-auswahl']);
  });

  it('runs at once where the browser has no Web Locks', async () => {
    expect(await geraeteSperre('korbjaeger-auswahl', undefined)(() => 7)).toBe(
      7
    );
  });

  it('passes a failure on', async () => {
    await expect(
      geraeteSperre(
        'korbjaeger-auswahl',
        undefined
      )(() => {
        throw new Error('voll');
      })
    ).rejects.toThrow('voll');
  });
});
