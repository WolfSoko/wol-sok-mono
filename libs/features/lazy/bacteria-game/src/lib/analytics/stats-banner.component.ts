import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../i18n/translate.pipe';
import { StatsConsent } from './stats-consent.service';

/**
 * The main menu's question whether the game may count how it is played.
 * Shown by the menu while `StatsConsent.asking` says so; Settings changes
 * the answer later.
 */
@Component({
  selector: 'feat-lazy-bac-game-stats-banner',
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    @let title = 'support.stats.title' | t;
    <aside class="banner" [attr.aria-label]="title">
      <mat-icon class="badge" aria-hidden="true">insights</mat-icon>
      <div class="text">
        <strong class="title">{{ title }}</strong>
        <p class="note">{{ 'support.stats.note' | t }}</p>
      </div>
      <div class="actions">
        <button
          mat-flat-button
          type="button"
          class="allow primary"
          (click)="consent.decide(true)"
        >
          {{ 'support.stats.allow' | t }}
        </button>
        <button
          mat-button
          type="button"
          class="decline"
          (click)="consent.decide(false)"
        >
          {{ 'support.stats.decline' | t }}
        </button>
      </div>
    </aside>
  `,
  styleUrl: './stats-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsBannerComponent {
  protected readonly consent = inject(StatsConsent);
}
