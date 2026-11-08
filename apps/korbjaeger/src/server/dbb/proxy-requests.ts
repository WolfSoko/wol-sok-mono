import {
  parseDbbId,
  type DbbRequest,
} from '@wolsok/feat-shared-basketball-data';

/** The Team-Spiele read of `teamId`, or `undefined` for a bad id. */
export function teamSpieleRequest(
  teamId: string | undefined
): DbbRequest | undefined {
  const id = parseDbbId(teamId);
  return id === undefined ? undefined : { kind: 'team-spiele', teamId: id };
}
