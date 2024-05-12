import { waitFor } from '@analogjs/trpc';
import { isPlatformBrowser } from '@angular/common';
import { inject, NgZone, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  interval,
  map,
  merge,
  shareReplay,
  Subject,
  switchMap,
  take,
} from 'rxjs';
import { Note } from '../../note';
import { injectTrpcClient } from '../../trpc-client';

const UPDATE_INTERVAL_MS = 5000;

export const pollAdapter = () => {
  const trpc = injectTrpcClient();
  const triggerRefresh$ = new Subject<void>();
  const optimisticUpdates$ = new Subject<Note[]>();

  const notes$ = triggerRefresh$.pipe(
    switchMap(() => merge(optimisticUpdates$, trpc.note.list.query())),
    map((res) => res.toReversed()),
    shareReplay(1)
  );

  const platformId = inject(PLATFORM_ID);
  void waitFor(notes$);
  triggerRefresh$.next();
  const ngZone: NgZone = inject(NgZone);
  if (isPlatformBrowser(platformId)) {
    ngZone.runOutsideAngular(() =>
      interval(UPDATE_INTERVAL_MS)
        .pipe(takeUntilDestroyed())
        .subscribe(() => ngZone.run(() => triggerRefresh$.next()))
    );
  }

  return {
    notes: toSignal(notes$),
    noteTrackBy: (index: number, note: Note) => {
      return note.id;
    },

    addNote(newNote: string) {
      // optimistic update
      optimisticUpdates$.next([
        ...(this.notes()?.toReversed() ?? []),
        {
          id: -1,
          note: `(saving...) ${newNote}`,
          createdAt: new Date().toISOString(),
        },
      ]);

      trpc.note.create
        .mutate({ note: newNote })
        .pipe(take(1))
        .subscribe(() => triggerRefresh$.next());
    },

    removeNote(id: number) {
      trpc.note.remove
        .mutate({ id })
        .pipe(take(1))
        .subscribe(() => triggerRefresh$.next());
    },
  };
};
