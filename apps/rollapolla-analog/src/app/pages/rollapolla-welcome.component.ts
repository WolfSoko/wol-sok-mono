import { waitFor } from '@analogjs/trpc';
import { AsyncPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import { Component, inject, NgZone, PLATFORM_ID, Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
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

@Component({
  selector: 'rap-welcome',
  standalone: true,
  imports: [AsyncPipe, FormsModule, DatePipe],
  styleUrl: './rollapolla-welcome.component.scss',
  templateUrl: './rollapolla-welcome.component.html',
})
export class RollapollaWelcomeComponent {
  private trpc = injectTrpcClient();

  private triggerRefresh$ = new Subject<void>();
  private optimisticUpdates$ = new Subject<Note[]>();
  private notes$ = this.triggerRefresh$.pipe(
    switchMap(() =>
      merge(this.optimisticUpdates$, this.trpc.note.list.query())
    ),
    map((res) => res.toReversed()),
    shareReplay(1)
  );

  public notes: Signal<Note[] | undefined> = toSignal(this.notes$);
  public newNote = '';

  constructor() {
    const platformId = inject(PLATFORM_ID);
    void waitFor(this.notes$);
    this.triggerRefresh$.next();
    const ngZone: NgZone = inject(NgZone);
    if (isPlatformBrowser(platformId)) {
      ngZone.runOutsideAngular(() =>
        interval(UPDATE_INTERVAL_MS)
          .pipe(takeUntilDestroyed())
          .subscribe(() => ngZone.run(() => this.triggerRefresh$.next()))
      );
    }
  }

  public noteTrackBy = (index: number, note: Note) => {
    return note.id;
  };

  public addNote(form: NgForm) {
    if (!form.valid) {
      form.form.markAllAsTouched();
      return;
    }

    // optimistic update
    this.optimisticUpdates$.next([
      ...(this.notes()?.toReversed() ?? []),
      {
        id: -1,
        note: `(saving...) ${this.newNote}`,
        createdAt: new Date().toISOString(),
      },
    ]);

    this.trpc.note.create
      .mutate({ note: this.newNote })
      .pipe(take(1))
      .subscribe(() => this.triggerRefresh$.next());
    this.newNote = '';
    form.form.reset();
  }

  public removeNote(id: number) {
    this.trpc.note.remove
      .mutate({ id })
      .pipe(take(1))
      .subscribe(() => this.triggerRefresh$.next());
  }
}
