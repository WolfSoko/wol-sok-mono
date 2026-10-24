import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EndlessScroll } from './endless-scroll';

/** Starts loading before the visitor actually reaches the end. */
const AHEAD_MARGIN = '600px';

/**
 * Put after an endless list: tells the scroll when the end comes into view
 * and spins while there is more to load.
 */
@Component({
  selector: 'rap-endless-scroll-end',
  imports: [MatProgressSpinnerModule],
  template: `
    @if (scroll().hasMore()) {
      <mat-spinner diameter="32" aria-label="Loading more polls" />
    }
  `,
  styles: `
    :host {
      display: flex;
      justify-content: center;
      min-height: 1px;
      padding-block: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-testid': 'endless-scroll-end' },
})
export class EndlessScrollEndComponent {
  public readonly scroll = input.required<EndlessScroll>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    // browser only: nothing scrolls while rendering on the server
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        (entries) =>
          this.scroll().setEndInView(
            entries.some((entry) => entry.isIntersecting)
          ),
        { rootMargin: AHEAD_MARGIN }
      );
      observer.observe(element);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        this.scroll().setEndInView(false);
      });
    });
  }
}
