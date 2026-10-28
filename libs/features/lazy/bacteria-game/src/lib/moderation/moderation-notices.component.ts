import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import type { PlayerNotice } from '../storage/game-moderation';
import { ModerationService } from './moderation.service';

/**
 * The owner's moderation as the menus show it (ADR 0012): the banner while
 * a ban holds - until when and why, and what it takes away - and the
 * notices the owner's actions left, each dismissed (deleted) by the player.
 */
@Component({
  selector: 'feat-lazy-bac-game-moderation-notices',
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    @if (banner(); as ban) {
      <div class="notice banner" role="alert">
        <mat-icon aria-hidden="true">gpp_bad</mat-icon>
        <span class="text">
          <strong>{{ ban.headline }}</strong>
          @if (ban.reason !== null) {
            {{ ban.reason }}
          }
          <span class="blocked">{{ 'moderation.banner.blocked' | t }}</span>
        </span>
      </div>
    }
    @if (notices().length > 0) {
      <ul class="notices" [attr.aria-label]="'moderation.notices.region' | t">
        @for (notice of notices(); track notice.id) {
          <li class="notice" role="status">
            <mat-icon aria-hidden="true">{{ notice.icon }}</mat-icon>
            <span class="text">{{ notice.text }}</span>
            <button
              mat-icon-button
              type="button"
              [attr.aria-label]="'moderation.notices.dismiss' | t"
              (click)="dismiss(notice.id)"
            >
              <mat-icon>close</mat-icon>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .notices {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .notice {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--bw-gold);
      border-radius: 1rem;
      background: var(--bw-surface-glass);
      color: var(--bw-text);
      pointer-events: auto;
    }

    .text {
      flex: 1 1 auto;
    }

    .blocked {
      display: block;
      color: var(--bw-muted);
      font-size: 0.9rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationNoticesComponent {
  private readonly moderation = inject(ModerationService);
  private readonly i18n = inject(I18nService);

  /** The ban as the banner tells it - null while none holds. */
  protected readonly banner = computed(() => {
    const ban = this.moderation.ban();
    if (ban === null) {
      return null;
    }
    return {
      headline:
        ban.until === null
          ? this.i18n.t('moderation.banner.permanent')
          : this.i18n.t('moderation.banner.until', {
              until: this.format(ban.until),
            }),
      reason:
        ban.reason === null
          ? null
          : this.i18n.t('moderation.banner.reason', {
              reason: this.i18n.t(`moderation.reasons.${ban.reason}`),
            }),
    };
  });

  /** The notices, newest last, as the menus show them. */
  protected readonly notices = computed(() =>
    this.moderation.notices().map((notice) => ({
      id: notice.id,
      icon: notice.type === 'unbanned' ? 'check_circle' : 'info',
      text: this.text(notice),
    }))
  );

  protected dismiss(id: string): void {
    void this.moderation.dismiss(id);
  }

  /**
   * A notice's line: what the owner did - for a ban also why; until when
   * the banner tells while it holds.
   */
  private text(notice: PlayerNotice): string {
    const line = this.i18n.t(`moderation.notices.${notice.type}`);
    return notice.reason === undefined
      ? line
      : `${line} ${this.i18n.t('moderation.banner.reason', {
          reason: this.i18n.t(`moderation.reasons.${notice.reason}`),
        })}`;
  }

  /** A moment as the language writes it, to the minute. */
  private format(millis: number): string {
    return new Intl.DateTimeFormat(this.i18n.locale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(millis);
  }
}
