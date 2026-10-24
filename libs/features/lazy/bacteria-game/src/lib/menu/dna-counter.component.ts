import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { DnaHelixComponent } from './dna-helix.component';

/**
 * The DNA left to spend, in a screen's header: a turning helix, the count
 * and what was earned in all - glowing gold while it buys something. The
 * Evolution and the My Colony screen share it, and the strands of a
 * purchase fly from it.
 */
@Component({
  selector: 'feat-lazy-bac-game-dna-counter',
  imports: [DnaHelixComponent, TranslatePipe],
  template: `
    <feat-lazy-bac-game-dna-helix class="dna-helix" [size]="40" />
    <span class="dna-count">{{ dna() }}</span>
    <span class="dna-text">
      <span class="dna-label">{{ 'evolution.dna.label' | t }}</span>
      <span class="dna-earned">
        @if (loaded()) {
          {{ 'evolution.dna.earned' | t: { count: earned() } }}
        } @else {
          {{ 'evolution.dna.loading' | t }}
        }
      </span>
    </span>
  `,
  styles: `
    @use 'screen';

    :host {
      @include screen.panel;

      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      margin-left: auto;
      padding: 0.35rem 1rem 0.35rem 0.6rem;
      border-radius: 999px;
      background: var(--bw-surface-glass);
    }

    :host(.ready) {
      border-color: var(--bw-gold);
      animation: ready 1.8s ease-in-out infinite;
    }

    .dna-count {
      @include screen.figure;

      font-size: 2rem;
      line-height: 1;
      color: var(--bw-gold);
      font-variant-numeric: tabular-nums;
    }

    .dna-text {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
    }

    .dna-label {
      font-weight: 700;
      letter-spacing: 0.08em;
    }

    .dna-earned {
      font-size: 0.75rem;
      color: var(--bw-muted);
    }

    @keyframes ready {
      0%,
      100% {
        box-shadow: 0 0 0 0 rgb(233 185 73 / 0%);
      }

      50% {
        box-shadow: 0 0 18px 2px rgb(233 185 73 / 45%);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host(.ready) {
        animation: none;
      }
    }
  `,
  host: { class: 'dna', '[class.ready]': 'ready()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DnaCounterComponent {
  /** The DNA left to spend. */
  public readonly dna = input.required<number>();
  /** The DNA earned in all. */
  public readonly earned = input.required<number>();
  /** False while the storage has not told what is held. */
  public readonly loaded = input(true);
  /** True while the DNA buys something here. */
  public readonly ready = input(false);
}
