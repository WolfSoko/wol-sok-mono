import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '../i18n/translate.pipe';
import { StageBusy } from './stage-busy';

/**
 * A spinner over the stage while a tap's work is under way (see
 * {@link StageBusy}). It fades in only after a moment, so a quick tap
 * shows none, and its veil keeps another tap from landing meanwhile.
 */
@Component({
  selector: 'feat-lazy-bac-game-stage-busy',
  imports: [MatProgressSpinnerModule, TranslatePipe],
  template: `
    @if (busy.active()) {
      <div class="veil">
        <mat-progress-spinner
          class="spinner"
          mode="indeterminate"
          [diameter]="56"
          [strokeWidth]="5"
          [attr.aria-label]="'stage.busy' | t"
        />
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

    .spinner {
      --mat-progress-spinner-active-indicator-color: var(--bw-player, #fff);

      padding: 0.875rem;
      border: 1px solid #3a4659;
      border-radius: 50%;
      background: #19212c;
      box-shadow: 0 0.25rem 1.5rem rgb(0 0 0 / 50%);
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
