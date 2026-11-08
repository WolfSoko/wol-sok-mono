import {
  parseDbbId,
  type DbbRequest,
} from '@wolsok/feat-shared-basketball-data';

/**
 * The app's proxy routes (`src/server/routes/api/dbb/`), both ways: the
 * path the browser asks for a read, and the read a route's params name. A
 * read gets its route here, in its route file and in `KorbjaegerData`.
 */
export function proxyPath(request: DbbRequest): string {
  switch (request.kind) {
    case 'team-spiele':
      return `/api/dbb/team/${request.teamId}/spiele`;
    case 'tabelle':
      return `/api/dbb/liga/${request.ligaId}/tabelle`;
    case 'liga-suche':
    case 'liga-seite':
    case 'spielplan':
    case 'vereins-spiele':
    case 'spiel-info':
    case 'spielbericht':
      // unreachable: KorbjaegerData offers no read without a route
      throw new Error(`no proxy route for ${request.kind} yet`);
  }
}

/** The read a route's id param names; `undefined`: 404. */
export type ProxyRouteRead = (id: string | undefined) => DbbRequest | undefined;

/** The read of `GET /api/dbb/team/{teamId}/spiele`. */
export const teamSpieleRequest: ProxyRouteRead = (teamId) => {
  const id = parseDbbId(teamId);
  return id === undefined ? undefined : { kind: 'team-spiele', teamId: id };
};

/** The read of `GET /api/dbb/liga/{ligaId}/tabelle`. */
export const tabelleRequest: ProxyRouteRead = (ligaId) => {
  const id = parseDbbId(ligaId);
  return id === undefined ? undefined : { kind: 'tabelle', ligaId: id };
};
