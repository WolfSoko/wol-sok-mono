import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { NachEntfolgen } from './nach-entfolgen';

/**
 * Marks where focus goes once a follow control disappears with the Team it
 * unfollowed (`NachEntfolgen`, which the screen provides): with a Team's
 * id, for that Team (the wizard's row); without, for the screen (the
 * overview's heading, which then needs `tabindex="-1"`).
 */
@Directive({ selector: '[korbFokusNachEntfolgen]' })
export class FokusNachEntfolgenDirective {
  /** The Team this element stands for; empty for the screen as a whole. */
  public readonly korbFokusNachEntfolgen = input<TeamId | ''>('');

  public constructor() {
    const ziel = {
      element: inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
      team: () => this.korbFokusNachEntfolgen() || undefined,
    };
    inject(DestroyRef).onDestroy(inject(NachEntfolgen).zielSetzen(ziel));
  }
}
