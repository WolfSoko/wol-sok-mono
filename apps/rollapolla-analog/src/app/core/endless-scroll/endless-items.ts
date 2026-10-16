import { computed, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, tap } from 'rxjs';
import { Page } from '../../../shared/admin';
import { retryAfterDelay } from '../../adapter/retry-after-delay';
import { EndlessScroll } from './endless-scroll';

/**
 * The items of a paged live query, reporting each answer to `scroll` and
 * listening again a while after it failed. Call in an injection context.
 * `items` is `undefined` while the first page loads; `failed` stays set
 * until a page loads again.
 */
export function endlessItems<T>(
  scroll: EndlessScroll,
  pages: Observable<Page<T>>,
  failure: string
): { items: Signal<T[] | undefined>; failed: Signal<boolean> } {
  const failed = signal(false);
  const page = toSignal(
    pages.pipe(
      tap(({ hasMore }) => {
        failed.set(false);
        scroll.answered(hasMore);
      }),
      retryAfterDelay(failure, () => failed.set(true))
    )
  );
  return {
    items: computed(() => page()?.items),
    failed: failed.asReadonly(),
  };
}
