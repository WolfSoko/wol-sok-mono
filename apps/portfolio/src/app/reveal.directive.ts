import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Directive,
  ElementRef,
  inject,
  input,
  numberAttribute,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';

/**
 * Fades an element in once it scrolls into view. The classes arrive in the
 * browser only (styles.scss), so the prerendered page shows everything at
 * once, as do browsers without `IntersectionObserver`. `wolsokReveal` takes
 * a delay in seconds for staggered lists.
 */
@Directive({
  selector: '[wolsokReveal]',
  host: { '[style.--reveal-delay]': 'delay() ? delay() + "s" : null' },
})
export class RevealDirective implements OnDestroy {
  public readonly delay = input(0, {
    alias: 'wolsokReveal',
    transform: (value: number | string) => numberAttribute(value, 0),
  });

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer: IntersectionObserver | null = null;

  public constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }
    afterNextRender(() => this.observe());
  }

  public ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private observe(): void {
    const element = this.element.nativeElement;
    if (
      typeof IntersectionObserver === 'undefined' ||
      element.ownerDocument.defaultView?.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
    ) {
      return;
    }
    element.classList.add('reveal');
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.classList.add('reveal-in');
          this.observer?.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );
    this.observer.observe(element);
  }
}
