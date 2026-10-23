import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { avatarArt } from './avatar-art';
import { Avatar } from './profile';

/** A player's picture in a circle: a drawn bacterium, a photo or an upload. */
@Component({
  selector: 'feat-lazy-bac-game-avatar',
  template: `
    @let shown = avatar();
    @if (shown.kind === 'preset' || broken() === shown) {
      @let art = preset();
      <svg viewBox="0 0 100 100" role="img" [attr.aria-label]="label()">
        <circle cx="50" cy="50" r="50" class="ground" />
        @if (art; as art) {
          <path
            [attr.d]="art.body"
            [attr.fill]="art.fill"
            [attr.stroke]="art.ink"
            stroke-width="3"
          />
          @for (eye of art.eyes; track $index) {
            <circle [attr.cx]="eye.x" [attr.cy]="eye.y" r="6" fill="#fff" />
            <circle
              [attr.cx]="eye.x"
              [attr.cy]="eye.y + 1"
              r="3"
              [attr.fill]="art.ink"
            />
            @if (art.sleepy) {
              <path
                [attr.d]="'M' + (eye.x - 7) + ' ' + (eye.y - 1) + ' h14'"
                [attr.stroke]="art.ink"
                stroke-width="3"
                stroke-linecap="round"
              />
            }
          }
          <path
            d="M42 62 Q50 69 58 62"
            fill="none"
            [attr.stroke]="art.ink"
            stroke-width="3"
            stroke-linecap="round"
          />
        }
      </svg>
    } @else {
      <img
        [src]="shown.kind === 'photo' ? shown.url : shown.data"
        [alt]="label()"
        referrerpolicy="no-referrer"
        (error)="broken.set(shown)"
      />
    }
  `,
  styles: `
    :host {
      display: inline-block;
      flex: none;
      width: var(--avatar-size, 40px);
      height: var(--avatar-size, 40px);
      border-radius: 50%;
      overflow: hidden;
      background: var(--bw-surface-raised, #1b2430);
    }

    svg,
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .ground {
      fill: var(--bw-surface-raised, #1b2430);
    }
  `,
  host: { '[style.--avatar-size.px]': 'size()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  public readonly avatar = input.required<Avatar>();
  public readonly size = input(40);
  /** Whose picture it is, for screen readers. */
  public readonly label = input('Avatar');

  /** The image that failed to load - a bacterium stands in for it. */
  protected readonly broken = signal<Avatar | null>(null);

  protected readonly preset = computed(() => {
    const avatar = this.avatar();
    return avatarArt(avatar.kind === 'preset' ? avatar.id : 0);
  });
}
