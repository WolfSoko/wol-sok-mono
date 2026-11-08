import {
  proxyPath,
  tabelleRequest,
  teamSpieleRequest,
} from './dbb-proxy-routes';

describe('DBB proxy routes', () => {
  it("maps a Team's Spiele to its route and back", () => {
    const request = teamSpieleRequest('313036');

    expect(request).toEqual({ kind: 'team-spiele', teamId: 313036 });
    expect(request && proxyPath(request)).toBe('/api/dbb/team/313036/spiele');
  });

  it("maps a Liga's Tabelle to its route and back", () => {
    const request = tabelleRequest('54862');

    expect(request).toEqual({ kind: 'tabelle', ligaId: 54862 });
    expect(request && proxyPath(request)).toBe('/api/dbb/liga/54862/tabelle');
  });

  it.each([undefined, '', 'abc', '-1', '0', '1.5'])(
    'names no read for the id %j',
    (id) => {
      expect(teamSpieleRequest(id)).toBeUndefined();
      expect(tabelleRequest(id)).toBeUndefined();
    }
  );

  it('has no route for a read the app does not offer yet', () => {
    expect(() => proxyPath({ kind: 'spielplan', ligaId: 54308 })).toThrow(
      'no proxy route for spielplan yet'
    );
  });
});
