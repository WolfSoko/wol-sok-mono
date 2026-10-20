import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ConsentPrompt } from './consent';

/**
 * Asks for analytics consent, fixed at the bottom of the page. Its own surface
 * rather than a snack bar, so other messages can't replace it.
 */
@Component({
  selector: 'rap-consent-banner',
  imports: [MatButtonModule],
  template: `
    @if (consent?.asking()) {
      <section
        class="consent-banner"
        aria-label="Analytics consent"
        data-testid="consent-banner"
      >
        <p>
          May RollaPolla count your visit with Google Analytics? No ads, no ad
          tracking.
        </p>
        <div>
          <button
            mat-button
            data-testid="consent-decline"
            (click)="consent?.decide('denied')"
          >
            Decline
          </button>
          <button
            mat-button
            data-testid="consent-accept"
            (click)="consent?.decide('granted')"
          >
            Accept
          </button>
        </div>
      </section>
    }
  `,
  styles: `
    .consent-banner {
      position: fixed;
      inset-inline: 1rem;
      bottom: 1rem;
      z-index: 20;
      max-width: 42rem;
      margin-inline: auto;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem 1rem;
      padding: 0.5rem 0.5rem 0.5rem 1rem;
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-inverse-surface);
      color: var(--mat-sys-inverse-on-surface);
      box-shadow: var(--mat-sys-level3);
      font: var(--mat-sys-body-medium);
      --mat-button-text-label-text-color: var(--mat-sys-inverse-primary);
    }
    p {
      flex: 1 1 16rem;
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsentBannerComponent {
  protected readonly consent = inject(ConsentPrompt, { optional: true });
}
