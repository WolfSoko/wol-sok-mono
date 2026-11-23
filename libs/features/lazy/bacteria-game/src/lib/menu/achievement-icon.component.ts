import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { achievementIconDataUrl } from '@wolsok/feat-shared-bacteria-art';
import { AchievementId } from '@wolsok/feat-shared-bacteria-engine';

/**
 * An achievement's icon, the same picture Play Games shows for it: in colour
 * once earned, greyed out with a lock until then. Decorative - the name
 * beside it says what it is. The consumer sets its size.
 */
@Component({
  selector: 'feat-lazy-bac-game-achievement-icon',
  imports: [MatIconModule],
  template: `
    <img [src]="url()" alt="" decoding="async" />
    @if (!earned()) {
      <mat-icon class="lock" aria-hidden="true">lock</mat-icon>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
      flex: none;
      width: 2.5rem;
      height: 2.5rem;
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
    }

    :host(.locked) img {
      filter: grayscale(1);
      opacity: 0.45;
    }

    .lock {
      position: absolute;
      right: -0.15rem;
      bottom: -0.15rem;
      width: 45%;
      height: 45%;
      font-size: 1rem;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--bw-surface-raised);
      color: var(--bw-faint);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.locked]': '!earned()',
  },
})
export class AchievementIconComponent {
  /** The achievement whose icon to show. */
  public readonly id = input.required<AchievementId>();

  /** False shows the icon locked: greyed out, with a lock on it. */
  public readonly earned = input.required<boolean>();

  /** The icon as a data URL: nothing to fetch, here or inside the shell. */
  protected readonly url = computed(() => achievementIconDataUrl(this.id()));
}
