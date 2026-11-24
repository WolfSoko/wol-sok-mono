import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { BacteriaSpinnerComponent } from '../busy/bacteria-spinner.component';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ProfileGate } from './profile-gate';

/**
 * Holds the menu screens back while the player profile loads (#3241): its
 * content stays laid out but hidden and out of reach, with the bacteria
 * spinner in its place, and fades in once {@link ProfileGate} opens - so
 * rank, DNA, avatar and colours appear as stored instead of jumping there
 * from their defaults. Hidden, not removed: an open screen keeps its state
 * while a sign-in loads the new player's profile, and the control that
 * had the focus gets it back once the curtain lifts.
 */
@Component({
  selector: 'feat-lazy-bac-game-profile-curtain',
  imports: [BacteriaSpinnerComponent, TranslatePipe],
  template: `
    <div
      #content
      class="content"
      [class.pending]="!gate.ready()"
      [attr.inert]="gate.ready() ? null : ''"
    >
      <ng-content />
    </div>
    @if (!gate.ready()) {
      <feat-lazy-bac-game-bacteria-spinner
        class="spinner"
        [label]="'stage.loadingProfile' | t"
      />
    }
  `,
  styles: `
    :host,
    .content {
      position: absolute;
      inset: 0;
    }

    .content {
      transition: opacity 150ms ease-out;

      &.pending {
        visibility: hidden;
        opacity: 0;
        transition: none;
      }
    }

    .spinner {
      position: absolute;
      top: 50%;
      left: 50%;
      translate: -50% -50%;
    }

    @media (prefers-reduced-motion: reduce) {
      .content {
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileCurtainComponent {
  protected readonly gate = inject(ProfileGate);
  private readonly content =
    viewChild.required<ElementRef<HTMLElement>>('content');
  /** The control that had the focus when the curtain fell. */
  private focused: HTMLElement | null = null;

  public constructor() {
    // Runs before the template makes the content inert, which takes the
    // focus away from it.
    effect(() => {
      if (!this.gate.ready()) {
        const active = document.activeElement;
        this.focused =
          active instanceof HTMLElement &&
          this.content().nativeElement.contains(active)
            ? active
            : null;
      }
    });
    // Runs once the content is no longer inert, so it can take the focus.
    afterRenderEffect(() => {
      if (this.gate.ready()) {
        this.restoreFocus();
      }
    });
  }

  private restoreFocus(): void {
    const control = this.focused;
    this.focused = null;
    if (control?.isConnected && document.activeElement === document.body) {
      control.focus();
    }
  }
}
