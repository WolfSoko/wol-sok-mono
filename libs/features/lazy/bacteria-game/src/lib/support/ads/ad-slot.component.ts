import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { GameAds } from './game-ads.service';

/**
 * A display ad from whichever network `GameAds` uses. Takes no room until
 * the player has answered the consent banner, and none at all without ads.
 */
@Component({
  selector: 'feat-lazy-bac-game-ad-slot',
  imports: [TranslatePipe],
  template: `
    @if (ads.consentAnswered()) {
      <span class="label" aria-hidden="true">{{ 'support.ad' | t }}</span>
      <div #slot></div>
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
    // Runs again only when the slot element changes; the ad goes with the
    // element, or with the screen.
    afterRenderEffect((onCleanup) => {
      const host = this.slot()?.nativeElement;
      if (host) onCleanup(this.ads.show(host));
    });
  }
}
