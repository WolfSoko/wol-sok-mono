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
 * Where nothing lies behind, the title bar goes up instead.
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

  /** One entry back, where this start made one. */
  public back(): void {
    if (this.canGoBack()) {
      this.location.back();
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
    if (event.navigationTrigger === 'popstate') {
      return {
        id: event.id,
        kind: 'restore',
        restoredId: event.restoredState?.navigationId ?? event.id,
      };
    }
    const extras = this.router.currentNavigation()?.extras;
    const kind = extras?.skipLocationChange
      ? 'none'
      : extras?.replaceUrl
        ? 'replace'
        : 'push';
    return { id: event.id, kind };
  }

  /**
   * Back and forward have moved the browser whether the navigation ended
   * or not; every other navigation changes the history only once it ended.
   */
  private stepOf(
    running: RunningNavigation,
    succeeded: boolean
  ): HistoryStep | undefined {
    switch (running.kind) {
      case 'restore':
        return {
          kind: 'restore',
          restoredId: running.restoredId,
          id: this.entryId() ?? running.id,
        };
      case 'none':
        return undefined;
      default:
        return succeeded ? { kind: running.kind, id: running.id } : undefined;
    }
  }

  /** The navigation id Angular keeps in the browser's current entry. */
  private entryId(): number | undefined {
    const state = this.location.getState() as { navigationId?: unknown } | null;
    return typeof state?.navigationId === 'number'
      ? state.navigationId
      : undefined;
  }
}

/** The navigation running now: its id, and what it does to the history. */
type RunningNavigation =
  | {
      readonly id: number;
      readonly kind: 'restore';
      readonly restoredId: number;
    }
  | { readonly id: number; readonly kind: 'push' | 'replace' | 'none' };
