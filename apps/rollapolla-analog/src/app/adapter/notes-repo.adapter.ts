import { isPlatformBrowser } from '@angular/common';
import {
  inject,
  Injectable,
  NgZone,
  PLATFORM_ID,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  interval,
  map,
  merge,
  of,
  shareReplay,
  Subject,
  switchMap,
} from 'rxjs';
import { Note } from '../../shared/note';
import { NotesRepoPort } from '../ports/notes-repo.port';

const UPDATE_INTERVAL_MS = 5000;

@Injectable()
export class NotesRepoAdapter extends NotesRepoPort {
  private triggerRefresh$ = new Subject<void>();
  private optimisticUpdates$ = new Subject<Note[]>();
  private notes: WritableSignal<Note[]> = signal([] as Note[]);
  private notes$ = this.triggerRefresh$.pipe(
    switchMap(() => merge(this.optimisticUpdates$, of(this.notes()))),
    map((res) => res.toReversed()),
    shareReplay(1)
  );

  private ngZone: NgZone = inject(NgZone);

  constructor() {
    super();
    // Trigger refresh every 10 seconds
    const UPDATE_INTERVAL_MS = 10 * 1000;
    const platformId = inject(PLATFORM_ID);
    const ngZone: NgZone = inject(NgZone);

    if (isPlatformBrowser(platformId)) {
      ngZone.runOutsideAngular(() =>
        interval(UPDATE_INTERVAL_MS)
          .pipe(takeUntilDestroyed())
          .subscribe(() => ngZone.run(() => this.triggerRefresh$.next()))
      );
    }
  }

  getNotes(): Signal<Note[] | undefined> {
    return toSignal(this.notes$);
  }

  noteTrackBy = (index: number, note: Note) => {
    return note.id;
  };

  addNote(newNote: string) {
    // optimistic update
    this.optimisticUpdates$.next([
      ...(this.notes()?.toReversed() ?? []),
      {
        id: -1,
        note: `(saving...) ${newNote.trim().substring(0, 20).trim()}`,
        createdAt: new Date().toISOString(),
      },
    ]);
    setTimeout(
      () =>
        this.notes.update((notes) => [
          ...notes,
          {
            id: Math.random() * 1000,
            note: newNote.trim(),
            createdAt: new Date().toISOString(),
          },
        ]),
      500
    );
  }

  removeNote(id: number): void {
    // implement later
  }
}
