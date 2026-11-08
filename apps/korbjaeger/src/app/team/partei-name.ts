import type { SpielPartei } from '@wolsok/feat-shared-basketball-data';

/** A Team's name, or the name of the slot a Liga keeps for one. */
export function parteiName(partei: SpielPartei): string {
  return partei.art === 'team' ? partei.team.name : partei.bezeichnung;
}
