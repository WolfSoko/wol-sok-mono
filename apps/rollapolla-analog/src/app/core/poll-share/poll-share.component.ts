import { Clipboard } from '@angular/cdk/clipboard';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer } from '@angular/platform-browser';
import { Poll } from '../../../shared/poll';
import { SITE_URL } from '../../pages/site-tags';
import {
  SHARE_TARGETS,
  ShareContent,
  ShareTarget,
} from '../../ports/share-target.port';

const LINK_COPIED_RESET_MS = 2000;
const ICON_NAMESPACE = 'share';

type ShareLink = {
  id: string;
  label: string;
  href: string;
  /** Web links open in a new tab, mailto: and app links in place. */
  newTab: boolean;
  fontIcon?: string;
  svgIcon?: string;
};

/**
 * Everything needed to pass a poll on: the device's share sheet where there
 * is one, copy link, and a link per registered {@link ShareTarget}.
 */
@Component({
  selector: 'rap-poll-share',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
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

  /** Only known in the browser, so the server renders without it. */
  protected readonly canShareNatively = signal(false);
  protected readonly linkCopied = signal(false);
  private linkCopiedTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly content = computed<ShareContent>(() => {
    const { id, question } = this.poll();
    return {
      url: `${this.origin}/poll/${id}`,
      title: question,
      text: `Vote now: ${question}`,
    };
  });

  protected readonly links = computed<ShareLink[]>(() => {
    const content = this.content();
    return this.targets.map((target) => {
      const href = target.shareUrl(content);
      return {
        id: target.id,
        label: target.label,
        href,
        newTab: /^https?:/.test(href),
        fontIcon: target.icon.kind === 'font' ? target.icon.name : undefined,
        svgIcon:
          target.icon.kind === 'svg'
            ? `${ICON_NAMESPACE}:${target.id}`
            : undefined,
      };
    });
  });

  constructor() {
    this.registerIcons();
    afterNextRender(() =>
      this.canShareNatively.set(
        typeof this.document.defaultView?.navigator.share === 'function'
      )
    );
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
    this.linkCopied.set(copied);
    if (copied) {
      this.linkCopiedTimer = setTimeout(
        () => this.linkCopied.set(false),
        LINK_COPIED_RESET_MS
      );
    }
  }

  private registerIcons(): void {
    const registry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    for (const target of this.targets) {
      if (target.icon.kind === 'svg') {
        registry.addSvgIconLiteralInNamespace(
          ICON_NAMESPACE,
          target.id,
          sanitizer.bypassSecurityTrustHtml(target.icon.svg)
        );
      }
    }
  }
}
