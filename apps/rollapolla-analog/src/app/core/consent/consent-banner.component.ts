import {
  ChangeDetectionStrategy,
  Component,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import { ConsentDecision, ConsentPurpose, SiteConsent } from './site-consent';

/** How the banner names a purpose. */
const PURPOSES: Record<
  ConsentPurpose,
  { label: string; wish: string; hint: string }
> = {
  statistics: {
    label: 'Usage statistics',
    wish: 'count visits and which features get used, with Google Analytics',
    hint: 'Google Analytics counts visits and features. It never gets your polls or what you type.',
  },
  ads: {
    label: 'Ads',
    wish: 'show ads from Google AdSense',
    hint: 'Google AdSense shows ads and may use cookies to measure and personalise them.',
  },
};

/**
 * Asks for consent to each purpose (`SiteConsent`), fixed at the bottom of
 * the page: all at once, or one by one after "Choose". Its own surface
 * rather than a snack bar, so other messages can't replace it.
 */
@Component({
  selector: 'rap-consent-banner',
  imports: [MatButtonModule, MatSlideToggleModule, RouterLink],
  template: `
    @if (consent.available && consent.asking()) {
      <section
        class="consent-banner"
        aria-label="Privacy choices"
        data-testid="consent-banner"
      >
        @if (choosing()) {
          <div class="choices">
            @for (option of options; track option.purpose) {
              <mat-slide-toggle
                [checked]="selection()[option.purpose]"
                (change)="select(option.purpose, $event.checked)"
                [attr.data-testid]="'consent-' + option.purpose"
              >
                {{ option.label }}
              </mat-slide-toggle>
              <p class="hint">{{ option.hint }}</p>
            }
          </div>
          <div class="actions">
            <button mat-button data-testid="consent-save" (click)="save()">
              Save choices
            </button>
          </div>
        } @else {
          <p>
            May RollaPolla {{ wish }}? Only if you agree.
            <a routerLink="/privacy" data-testid="consent-privacy-link"
              >Privacy policy</a
            >
          </p>
          <div class="actions">
            <button
              mat-button
              data-testid="consent-decline"
              (click)="consent.decideAll('denied')"
            >
              Decline
            </button>
            <button
              mat-button
              data-testid="consent-choose"
              (click)="choosing.set(true)"
            >
              Choose
            </button>
            <button
              mat-button
              data-testid="consent-accept"
              (click)="consent.decideAll('granted')"
            >
              Accept all
            </button>
          </div>
        }
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
      --mat-slide-toggle-label-text-color: var(--mat-sys-inverse-on-surface);
    }
    p {
      flex: 1 1 16rem;
      margin: 0;
    }
    a {
      color: var(--mat-sys-inverse-primary);
    }
    .choices {
      flex: 1 1 100%;
      display: grid;
      gap: 0.25rem;
      padding-block: 0.5rem;
    }
    .hint {
      margin: 0 0 0.5rem;
      opacity: 0.85;
      font: var(--mat-sys-body-small);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsentBannerComponent {
  protected readonly consent = inject(SiteConsent);
  protected readonly options = this.consent.purposes.map((purpose) => ({
    purpose,
    ...PURPOSES[purpose],
  }));
  protected readonly wish = this.options
    .map((option) => option.wish)
    .join(' and ');
  protected readonly choosing = signal(false);
  /** What "Choose" starts from: the choices in force. */
  protected readonly selection = linkedSignal<ConsentDecision>(() =>
    this.consent.granted()
  );

  protected select(purpose: ConsentPurpose, granted: boolean): void {
    this.selection.update((selection) => ({
      ...selection,
      [purpose]: granted,
    }));
  }

  protected save(): void {
    this.consent.decide(this.selection());
    this.choosing.set(false);
  }
}
