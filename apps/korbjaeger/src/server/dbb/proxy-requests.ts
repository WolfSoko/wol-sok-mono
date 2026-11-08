import { isDbbId, type DbbRequest } from '@wolsok/feat-shared-basketball-data';

const DIGITS = /^\d+$/;

/** The id a route param names: digits only, and a DBB id. */
export function dbbIdParam(param: string | undefined): number | undefined {
  if (param === undefined || !DIGITS.test(param)) {
    return undefined;
  }
  const id = Number(param);
  return isDbbId(id) ? id : undefined;
}

/** The Team-Spiele read of `teamId`, or `undefined` for a bad id. */
export function teamSpieleRequest(
  teamId: string | undefined
): DbbRequest | undefined {
  const id = dbbIdParam(teamId);
  return id === undefined ? undefined : { kind: 'team-spiele', teamId: id };
}
