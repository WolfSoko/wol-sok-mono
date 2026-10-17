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
import { Poll, PRIVATE_POLL_HINT } from '../../../shared/poll';
import { pollUrl, SITE_URL } from '../../../shared/site-url';
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
 * Everything needed to pass a poll on: the device's share sheet where there
 * is one, copy link, and a link per registered {@link ShareTarget}.
 */
@Component({
  selector: 'rap-poll-share',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  templateUrl: './poll-share.component.html',
  styleUrl: './poll-share.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PollShareComponent {
  public readonly poll = input.required<Poll>();
  /** Right after creating a poll, sharing is the one thing left to do. */
  public readonly highlighted = input(false, { transform: booleanAttribute });

  private readonly clipboard = inject(Clipboard);
  private readonly document = inject(DOCUMENT);
  private readonly targets =
    inject(SHARE_TARGETS, { optional: true }) ?? ([] as ShareTarget[]);
  private readonly origin = isPlatformBrowser(inject(PLATFORM_ID))
    ? this.document.location.origin
    : SITE_URL;

  protected readonly privatePollHint: string = PRIVATE_POLL_HINT;
  /** Only known in the browser, so the server renders without it. */
  protected readonly canShareNatively = signal(false);
  private linkCopiedTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly content = computed<ShareContent>(() => {
    const { id, question } = this.poll();
    return {
      url: pollUrl(id, this.origin),
      title: question,
      text: `Vote now: ${question}`,
    };
  });

  /** Starts over for each poll the component is reused for. */
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
