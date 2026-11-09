import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  type Signal,
  signal,
} from '@angular/core';

/** One level of the breadcrumb: its text, and where a tap on it leads. */
export interface Level {
  readonly title: string;
  /** Router commands; the current page's own level needs none. */
  readonly link?: readonly string[];
}

/** The app's top level, the overview, first in every breadcrumb. */
export const ROOT_LEVEL: Level = { title: 'Korbjäger', link: ['/'] };

/**
 * The breadcrumb of the page shown now, which the page declares with
 * `breadcrumb()`, for the title bar: the overview first, the page last.
 */
@Injectable({ providedIn: 'root' })
export class Breadcrumb {
  private readonly page = signal<Signal<readonly Level[]> | undefined>(
    undefined
  );

  /** Every level, the root first and the current page last. */
  public readonly levels = computed<readonly Level[]>(() => [
    ROOT_LEVEL,
    ...(this.page()?.() ?? []),
  ]);

  /** Where "up" leads: the nearest level above the page with a link, none on the overview. */
  public readonly parentLink = computed(
    () =>
      this.levels()
        .slice(0, -1)
        .findLast((level) => level.link !== undefined)?.link
  );

  /** Shows `levels` below the root until `release(levels)`. */
  public show(levels: Signal<readonly Level[]>): void {
    this.page.set(levels);
  }

  /** Takes `levels` away, unless another page showed its own since. */
  public release(levels: Signal<readonly Level[]>): void {
    if (this.page() === levels) {
      this.page.set(undefined);
    }
  }
}

/**
 * Declares the current page's levels below the root, the page's own last,
 * for as long as the calling page lives; call it in a page's constructor.
 */
export function breadcrumb(levels: () => readonly Level[]): void {
  const service = inject(Breadcrumb);
  const shown = computed(levels);
  service.show(shown);
  inject(DestroyRef).onDestroy(() => service.release(shown));
}
