import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';

/**
 * The Buy Me a Coffee button in the look of the service's own widget, as a
 * plain link: the widget script would load third-party code into the game.
 * The label is the service's brand phrase (German where the game speaks it),
 * set in its Cookie font.
 */
@Component({
  selector: 'feat-lazy-bac-game-bmc-button',
  imports: [TranslatePipe],
  template: `
    <a
      class="bmc-button"
      [href]="url()"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg class="cup" viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M6 10h17l-2 17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z"
          fill="#FFDD00"
          stroke="#000"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <path
          d="M23 13h2.5a3.5 3.5 0 0 1 0 7H22.2"
          fill="none"
          stroke="#000"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <path
          d="M11 3.5c-1 1.2 1 2.3 0 3.5M15 3.5c-1 1.2 1 2.3 0 3.5M19 3.5c-1 1.2 1 2.3 0 3.5"
          fill="none"
          stroke="#000"
          stroke-width="1.3"
          stroke-linecap="round"
        />
      </svg>
      <span class="label">{{ 'support.buyCoffee' | t }}</span>
    </a>
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .bmc-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 48px;
      padding: 0 18px 0 12px;
      border: 1px solid #000;
      border-radius: 10px;
      background: #ffdd00;
      color: #000;
      text-decoration: none;
      box-shadow: 0 1px 3px rgb(0 0 0 / 20%);
      transition:
        box-shadow 0.15s ease,
        transform 0.15s ease;
    }
    .bmc-button:hover {
      box-shadow: 0 3px 8px rgb(0 0 0 / 35%);
    }
    .bmc-button:active {
      transform: translateY(1px);
    }
    .bmc-button:focus-visible {
      outline: 3px solid var(--bw-gold, #e9b949);
      outline-offset: 2px;
    }
    .cup {
      flex: none;
      width: 28px;
      height: 28px;
    }
    .label {
      font-family: 'Cookie', cursive;
      font-size: 28px;
      line-height: 1;
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BmcButtonComponent {
  public readonly url = input.required<string>();
}
