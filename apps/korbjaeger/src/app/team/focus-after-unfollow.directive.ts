import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { AfterUnfollow } from './after-unfollow';

/**
 * Marks where focus goes once a follow control disappears with the Team it
 * unfollowed (`AfterUnfollow`, which the screen provides): with a Team's
 * id, for that Team (the wizard's row); without, for the screen (the
 * overview's heading, which then needs `tabindex="-1"`).
 */
@Directive({ selector: '[korbFocusAfterUnfollow]' })
export class FocusAfterUnfollowDirective {
  /** The Team this element stands for; empty for the screen as a whole. */
  public readonly korbFocusAfterUnfollow = input<TeamId | ''>('');

  public constructor() {
    const target = {
      element: inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
      team: () => this.korbFocusAfterUnfollow() || undefined,
    };
    inject(DestroyRef).onDestroy(inject(AfterUnfollow).setTarget(target));
  }
}
