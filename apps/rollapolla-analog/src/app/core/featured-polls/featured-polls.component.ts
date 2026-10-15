import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { FEATURED_POLLS } from '../../../shared/featured-polls';

/** RollaPolla's own polls, to try voting right away. */
@Component({
  selector: 'rap-featured-polls',
  imports: [MatIconModule, RouterLink],
  template: `
    <ul class="grid">
      @for (poll of polls; track poll.id) {
        <li>
          <a
            class="card"
            [routerLink]="['/poll', poll.id]"
            [attr.data-testid]="poll.id"
          >
            <span class="question">{{ poll.question }}</span>
            <span class="options">
              @for (option of poll.options; track $index) {
                <span class="option">{{ option }}</span>
              }
            </span>
            <span class="cta">
              Vote now
              <mat-icon aria-hidden="true">arrow_forward</mat-icon>
            </span>
          </a>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
      gap: 1rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
    }
    .card {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      padding: 1.25rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--rap-radius-md);
      background: var(--mat-sys-surface-container-lowest);
      color: inherit;
      text-decoration: none;
      transition:
        border-color 150ms ease,
        transform 150ms ease;

      &:hover,
      &:focus-visible {
        border-color: var(--mat-sys-primary);
        transform: translateY(-2px);
      }
      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }
    }
    .question {
      font: var(--mat-sys-title-large);
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .options {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }
    .option {
      padding: 0.125rem 0.625rem;
      border-radius: 999px;
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-secondary-container);
      background: var(--mat-sys-secondary-container);
    }
    .cta {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      margin-top: auto;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedPollsComponent {
  protected readonly polls = FEATURED_POLLS;
}
