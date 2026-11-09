import { InjectionToken } from '@angular/core';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';

/**
 * Provided by a screen whose follow controls go with their Team (an
 * overview card, a followed row of the wizard): `TeamFolgenComponent`
 * calls it once it unfollowed `team`, so the screen moves focus to what
 * stays, and offers to undo the unfollowing. Screens whose control stays
 * (the Team page, a Verein's Teams) provide none.
 */
export const NACH_ENTFOLGEN = new InjectionToken<(team: TeamId) => void>(
  'NACH_ENTFOLGEN'
);
