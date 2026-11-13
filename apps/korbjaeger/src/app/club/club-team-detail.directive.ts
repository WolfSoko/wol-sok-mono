import { Directive, inject, TemplateRef } from '@angular/core';
import type { ClubTeamRow } from './club-teams-state';

/** What a template marked `korbClubTeamDetail` is given: the Team's row. */
export interface ClubTeamDetailContext {
  readonly $implicit: ClubTeamRow;
}

/**
 * Marks the `ng-template` a screen puts into `ClubTeamsComponent` to
 * show below each Team (`<ng-template korbClubTeamDetail let-team>`),
 * typing the
 * row it is given.
 */
@Directive({ selector: '[korbClubTeamDetail]' })
export class ClubTeamDetailDirective {
  /** The marked template, to render once per Team. */
  public readonly template =
    inject<TemplateRef<ClubTeamDetailContext>>(TemplateRef);

  public static ngTemplateContextGuard(
    _directive: ClubTeamDetailDirective,
    _context: unknown
  ): _context is ClubTeamDetailContext {
    return true;
  }
}
