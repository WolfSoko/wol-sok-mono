import { Location } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type Event,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
} from '@angular/router';
import {
  canGoBack,
  canGoForward,
  EMPTY_HISTORY,
  type HistoryStep,
  historyAfter,
} from './history';

/**
 * Back and forward within the app, for the title bar: an installed app
 * (`display: standalone`) has no browser buttons. It follows the router's
 * navigations, so it knows only the entries this start of the app made.
 */
@Injectable({ providedIn: 'root' })
export class AppHistory {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  private readonly history = signal(EMPTY_HISTORY);
  /** The navigation running now, as far as the history cares. */
  private running: RunningNavigation | undefined;

  public readonly canGoBack = computed(() => canGoBack(this.history()));
  public readonly canGoForward = computed(() => canGoForward(this.history()));

  public constructor() {
    this.router.events
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this.follow(event));
  }

  /**
   * One entry back where this start made one, else up to `parentLink`
   * (a page opened from a link or by a restart has nothing behind it).
   */
  public back(parentLink: readonly string[] | undefined): void {
    if (this.canGoBack()) {
      this.location.back();
    } else if (parentLink !== undefined) {
      void this.router.navigate(parentLink);
    }
  }

  /** One entry forward, where one lies ahead. */
  public forward(): void {
    if (this.canGoForward()) {
      this.location.forward();
    }
  }

  private follow(event: Event): void {
    if (event instanceof NavigationStart) {
      this.running = this.runningOf(event);
      return;
    }
    const ended =
      event instanceof NavigationEnd ||
      event instanceof NavigationCancel ||
      event instanceof NavigationError ||
      event instanceof NavigationSkipped;
    if (!ended || this.running?.id !== event.id) {
      return;
    }
    const step = this.stepOf(this.running, event instanceof NavigationEnd);
    this.running = undefined;
    if (step !== undefined) {
      this.history.update((history) => historyAfter(history, step));
    }
  }

  private runningOf(event: NavigationStart): RunningNavigation {
    const extras = this.router.currentNavigation()?.extras;
    return {
      id: event.id,
      restoredId:
        event.navigationTrigger === 'popstate'
          ? (event.restoredState?.navigationId ?? event.id)
          : undefined,
      replaceUrl: extras?.replaceUrl ?? false,
      skipLocationChange: extras?.skipLocationChange ?? false,
    };
  }

  /**
   * Back and forward have moved the browser whether the navigation ended
   * or not; every other navigation changes the history only once it ended.
   */
  private stepOf(
    running: RunningNavigation,
    succeeded: boolean
  ): HistoryStep | undefined {
    if (running.restoredId !== undefined) {
      return {
        kind: 'restore',
        restoredId: running.restoredId,
        id: this.entryId() ?? running.id,
      };
    }
    if (!succeeded || running.skipLocationChange) {
      return undefined;
    }
    return { kind: running.replaceUrl ? 'replace' : 'push', id: running.id };
  }

  /** The navigation id Angular keeps in the browser's current entry. */
  private entryId(): number | undefined {
    const state = this.location.getState() as { navigationId?: unknown } | null;
    return typeof state?.navigationId === 'number'
      ? state.navigationId
      : undefined;
  }
}

interface RunningNavigation {
  readonly id: number;
  /** The id the entry held that back or forward restores; none otherwise. */
  readonly restoredId: number | undefined;
  readonly replaceUrl: boolean;
  readonly skipLocationChange: boolean;
}
