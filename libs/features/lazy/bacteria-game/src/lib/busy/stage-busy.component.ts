import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { BacteriaSpinnerComponent } from './bacteria-spinner.component';
import { StageBusy } from './stage-busy';

/**
 * Bacteria eating each other round a ring, over the stage while a tap's work is under way (see
 * {@link StageBusy}). It fades in only after a moment, so a quick tap
 * shows none, and its veil keeps another tap from landing meanwhile.
 */
@Component({
  selector: 'feat-lazy-bac-game-stage-busy',
  imports: [BacteriaSpinnerComponent, TranslatePipe],
  template: `
    @if (busy.active()) {
      <div class="veil">
        <feat-lazy-bac-game-bacteria-spinner [label]="'stage.busy' | t" />
      </div>
    }
  `,
  styles: `
    /* Out of the stage's grid: the veil covers the stage itself. */
    :host {
      display: contents;
    }

    .veil {
      position: absolute;
      inset: 0;
      z-index: 4;
      display: grid;
      place-items: center;
      background: rgb(0 0 0 / 30%);
      cursor: progress;
      pointer-events: auto;
      touch-action: none;
      animation: show 150ms ease-out 120ms both;
    }

    @keyframes show {
      from {
        opacity: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .veil {
        animation-duration: 0s;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StageBusyComponent {
  protected readonly busy = inject(StageBusy);
}
