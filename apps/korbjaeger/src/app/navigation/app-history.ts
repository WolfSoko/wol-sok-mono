import { Location } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type Event,
  NavigationEnd,
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
  /** The step each navigation still running takes, by its id. */
  private readonly running = new Map<number, HistoryStep>();

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
      const step = this.stepOf(event);
      if (step !== undefined) {
        this.running.set(event.id, step);
      }
    } else if (event instanceof NavigationEnd) {
      const step = this.running.get(event.id);
      if (step !== undefined) {
        this.history.update((history) => historyAfter(history, step));
      }
      this.running.clear();
    }
  }

  private stepOf(event: NavigationStart): HistoryStep | undefined {
    if (event.navigationTrigger === 'popstate') {
      return {
        kind: 'restore',
        id: event.restoredState?.navigationId ?? event.id,
      };
    }
    const extras = this.router.currentNavigation()?.extras;
    if (extras?.skipLocationChange) {
      return undefined;
    }
    return { kind: extras?.replaceUrl ? 'replace' : 'push', id: event.id };
  }
}
