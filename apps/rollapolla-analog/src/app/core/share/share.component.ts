import { Clipboard } from '@angular/cdk/clipboard';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  linkedSignal,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SITE_URL } from '../../../shared/site-url';
import {
  SHARE_ICON_NAMESPACE,
  SHARE_TARGETS,
  ShareContent,
  ShareIcon,
  ShareTarget,
} from '../../ports/share-target.port';

const LINK_COPIED_RESET_MS = 2000;

/** `failed`: the browser refused to copy, the link is shown to copy by hand. */
type CopyState = 'idle' | 'copied' | 'failed';

type ShareLink = {
  id: string;
  label: string;
  href: string;
  /** Web links open in a new tab, mailto: and app links in place. */
  newTab: boolean;
  icon: ShareIcon;
  /** The registered name, for SVG icons. */
  svgIcon: string;
};

/**
 * The origin to build shared links on: the page's own in the browser, the
 * site's on the server. Call in an injection context.
 */
export function injectShareOrigin(): string {
  return isPlatformBrowser(inject(PLATFORM_ID))
    ? inject(DOCUMENT).location.origin
    : SITE_URL;
}

/**
 * Everything needed to pass a link on: the device's share sheet where there
 * is one, copy link, and a link per registered {@link ShareTarget}. The
 * projected content is the intro next to the buttons.
 */
@Component({
  selector: 'rap-share',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  templateUrl: './share.component.html',
  styleUrl: './share.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.highlighted]': 'highlighted()' },
})
export class ShareComponent {
  public readonly content = input.required<ShareContent>();
  /** When sharing is the one thing left to do: stands out, filled buttons. */
  public readonly highlighted = input(false, { transform: booleanAttribute });
  /** Label of the field the link is shown in when copying fails. */
  public readonly linkLabel = input('Link');

  private readonly clipboard = inject(Clipboard);
  private readonly document = inject(DOCUMENT);
  private readonly targets =
    inject(SHARE_TARGETS, { optional: true }) ?? ([] as ShareTarget[]);

  /** Only known in the browser, so the server renders without it. */
  protected readonly canShareNatively = signal(false);
  private linkCopiedTimer: ReturnType<typeof setTimeout> | undefined;

  /** Starts over for each link the component is reused for. */
  protected readonly copyState = linkedSignal<string, CopyState>({
    source: () => this.content().url,
    computation: () => 'idle',
  });
  private readonly manualLink =
    viewChild<ElementRef<HTMLInputElement>>('manualLink');

  protected readonly links = computed<ShareLink[]>(() => {
    const content = this.content();
    return this.targets.map((target) => {
      const href = target.shareUrl(content);
      return {
        id: target.id,
        label: target.label,
        href,
        newTab: /^https?:/.test(href),
        icon: target.icon,
        svgIcon: `${SHARE_ICON_NAMESPACE}:${target.id}`,
      };
    });
  });

  constructor() {
    afterNextRender(() =>
      this.canShareNatively.set(
        typeof this.document.defaultView?.navigator.share === 'function'
      )
    );
    // Hand the link over ready to copy: focused and selected.
    afterRenderEffect(() => {
      const input = this.manualLink()?.nativeElement;
      if (input && this.copyState() === 'failed') {
        input.focus();
        input.select();
      }
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.linkCopiedTimer));
  }

  protected async shareNatively(): Promise<void> {
    const { url, title, text } = this.content();
    try {
      await this.document.defaultView?.navigator.share({ url, title, text });
    } catch (error) {
      // Closing the share sheet rejects with an AbortError, that is no failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Could not share', error);
        this.copyLink();
      }
    }
  }

  protected copyLink(): void {
    clearTimeout(this.linkCopiedTimer);
    const copied = this.clipboard.copy(this.content().url);
    this.copyState.set(copied ? 'copied' : 'failed');
    if (copied) {
      this.linkCopiedTimer = setTimeout(
        () => this.copyState.set('idle'),
        LINK_COPIED_RESET_MS
      );
    }
  }

  /** A click's mouseup would undo a selection made on focus. */
  protected selectAll(event: Event): void {
    (event.target as HTMLInputElement).select();
  }
}
