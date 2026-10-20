import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ConsentPrompt } from './consent';

/**
 * Lets visitors change their analytics choice. Shown only where analytics runs
 * (the browser in production), and only after hydration, so the server markup
 * stays the same.
 */
@Component({
  selector: 'rap-consent-settings',
  template: `
    @if (consent && shown()) {
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
  protected readonly consent = inject(ConsentPrompt, { optional: true });
  protected readonly shown = signal(false);

  constructor() {
    afterNextRender(() => this.shown.set(true));
  }
}
