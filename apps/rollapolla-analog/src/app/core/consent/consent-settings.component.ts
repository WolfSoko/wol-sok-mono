import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { SiteConsent } from './site-consent';

/**
 * Lets visitors change their choices for usage statistics and ads. Shown
 * only where something asks for consent (the browser in production), and
 * only after hydration, so the server markup stays the same.
 */
@Component({
  selector: 'rap-consent-settings',
  template: `
    @if (consent.available && shown()) {
      <button
        type="button"
        class="consent-settings"
        data-testid="consent-settings"
        (click)="consent.ask()"
      >
        Privacy settings
      </button>
    }
  `,
  styles: `
    .consent-settings {
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsentSettingsComponent {
  protected readonly consent = inject(SiteConsent);
  protected readonly shown = signal(false);

  constructor() {
    afterNextRender(() => this.shown.set(true));
  }
}
