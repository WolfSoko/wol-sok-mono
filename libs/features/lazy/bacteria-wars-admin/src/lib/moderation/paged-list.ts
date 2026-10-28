import { computed, signal } from '@angular/core';
import type { Page } from './admin-records.service';

/**
 * A list that loads a page at a time, for the moderation views: `load`
 * starts over with a new source, `more` appends the next page. A page that
 * comes back after a newer `load` is dropped.
 */
export class PagedList<T> {
  public readonly rows = signal<T[]>([]);
  public readonly loading = signal(false);
  public readonly failed = signal(false);
  private readonly next = signal<unknown>(null);
  public readonly hasMore = computed(() => this.next() !== null);

  private source: ((after: unknown) => Promise<Page<T>>) | null = null;
  private generation = 0;

  public load(source: (after: unknown) => Promise<Page<T>>): Promise<void> {
    this.source = source;
    this.rows.set([]);
    this.next.set(null);
    return this.fetch(null);
  }

  public reload(): Promise<void> {
    return this.source === null ? Promise.resolve() : this.load(this.source);
  }

  public more(): Promise<void> {
    const after = this.next();
    return after === null || this.loading()
      ? Promise.resolve()
      : this.fetch(after);
  }

  private async fetch(after: unknown): Promise<void> {
    const source = this.source;
    if (source === null) {
      return;
    }
    const generation = ++this.generation;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const page = await source(after);
      if (generation === this.generation) {
        this.rows.update((rows) => [...rows, ...page.rows]);
        this.next.set(page.next);
      }
    } catch (error) {
      console.error('Could not load the list', error);
      if (generation === this.generation) {
        this.failed.set(true);
      }
    } finally {
      if (generation === this.generation) {
        this.loading.set(false);
      }
    }
  }
}
