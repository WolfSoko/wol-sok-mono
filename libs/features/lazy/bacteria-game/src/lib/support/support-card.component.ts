import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BmcButtonComponent } from './bmc-button.component';
import { GameSupport } from './game-support.service';

/**
 * The ask to support the game, with the way to do it: the Buy Me a Coffee
 * button on the web, a button per Play tip in the app. Shows nothing where
 * there is neither; the heading is the caller's.
 */
@Component({
  selector: 'feat-lazy-bac-game-support-card',
  imports: [BmcButtonComponent, MatButtonModule, MatIconModule],
  template: `
    @if (support.available()) {
      <p class="pitch">
        The game is free and made in my spare time. If it gives you a good
        fight, a coffee keeps the servers running and new levels coming.
      </p>
      @if (support.url(); as url) {
        <feat-lazy-bac-game-bmc-button [url]="url" />
      } @else {
        <div class="tips">
          @for (product of support.tipProducts(); track product.id) {
            <button
              mat-flat-button
              type="button"
              [disabled]="support.busyTip() !== null"
              (click)="support.tip(product.id)"
            >
              <mat-icon>local_cafe</mat-icon>
              {{ product.title }}
              <span class="price">{{ product.price }}</span>
            </button>
          }
        </div>
        @switch (support.tipNotice()) {
          @case ('thanks') {
            <p class="notice" role="status">Thank you for the coffee!</p>
          }
          @case ('failed') {
            <p class="notice" role="alert">
              The purchase did not go through. Please try again.
            </p>
          }
        }
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .pitch {
      margin: 0 0 1rem;
      line-height: 1.5;
      color: var(--bw-soft, inherit);
    }
    .tips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .price {
      margin-left: 0.5rem;
      font-weight: 700;
    }
    .notice {
      margin: 0.75rem 0 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportCardComponent {
  protected readonly support = inject(GameSupport);
}
