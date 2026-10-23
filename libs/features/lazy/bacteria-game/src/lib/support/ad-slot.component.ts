import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { GameAds } from './game-ads.service';

/**
 * A responsive AdSense display ad. Takes no room until the player has
 * answered the consent banner, and none at all without ads.
 */
@Component({
  selector: 'feat-lazy-bac-game-ad-slot',
  template: `
    @if (ads.ready() && ads.ad; as ad) {
      <span class="label" aria-hidden="true">Ad</span>
      <ins
        #slot
        class="adsbygoogle"
        style="display: block"
        data-ad-format="auto"
        data-full-width-responsive="true"
        [attr.data-ad-client]="ad.client"
        [attr.data-ad-slot]="ad.slot"
        [attr.data-npa]="ads.personalised() ? null : '1'"
      ></ins>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .label {
      display: block;
      margin-bottom: 4px;
      font-size: 0.75rem;
      color: var(--bw-faint, #5b6878);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdSlotComponent {
  protected readonly ads = inject(GameAds);
  private readonly slot = viewChild<ElementRef<HTMLElement>>('slot');

  public constructor() {
    let filled: HTMLElement | null = null;
    afterRenderEffect(() => {
      const slot = this.slot()?.nativeElement ?? null;
      if (!slot || slot === filled) return;
      filled = slot;
      this.ads.fill();
    });
  }
}
