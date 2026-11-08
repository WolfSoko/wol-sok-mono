import { proxyPath, teamSpieleRequest } from './dbb-proxy-routes';

describe('DBB proxy routes', () => {
  it("maps a Team's Spiele to its route and back", () => {
    const request = teamSpieleRequest('313036');

    expect(request).toEqual({ kind: 'team-spiele', teamId: 313036 });
    expect(request && proxyPath(request)).toBe('/api/dbb/team/313036/spiele');
  });

  it.each([undefined, '', 'abc', '-1', '0', '1.5'])(
    'names no read for the id %j',
    (teamId) => {
      expect(teamSpieleRequest(teamId)).toBeUndefined();
    }
  );

  it('has no route for a read the app does not offer yet', () => {
    expect(() => proxyPath({ kind: 'tabelle', ligaId: 54308 })).toThrow(
      'no proxy route for tabelle yet'
    );
  });
});
