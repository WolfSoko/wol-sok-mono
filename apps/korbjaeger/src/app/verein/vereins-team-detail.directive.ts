import { Directive, inject, TemplateRef } from '@angular/core';
import type { VereinsTeamZeile } from './vereins-teams-stand';

/** What a template marked `korbVereinsTeamDetail` is given: the Team's row. */
export interface VereinsTeamDetailContext {
  readonly $implicit: VereinsTeamZeile;
}

/**
 * Marks the `ng-template` a screen puts into `VereinsTeamsComponent` to
 * show below each Team (`<ng-template korbVereinsTeamDetail let-team>`),
 * typing the
 * row it is given.
 */
@Directive({ selector: '[korbVereinsTeamDetail]' })
export class VereinsTeamDetailDirective {
  /** The marked template, to render once per Team. */
  public readonly template =
    inject<TemplateRef<VereinsTeamDetailContext>>(TemplateRef);

  public static ngTemplateContextGuard(
    _directive: VereinsTeamDetailDirective,
    _context: unknown
  ): _context is VereinsTeamDetailContext {
    return true;
  }
}
