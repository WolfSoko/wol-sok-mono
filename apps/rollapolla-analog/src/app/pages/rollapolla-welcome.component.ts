import { waitFor } from '@analogjs/trpc';
import {
  AsyncPipe,
  DatePipe,
  isPlatformBrowser,
  NgFor,
  NgIf,
} from '@angular/common';
import { Component, inject, NgZone, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { interval, map, shareReplay, Subject, switchMap, take } from 'rxjs';
import { Note } from '../../note';
import { injectTrpcClient } from '../../trpc-client';

const UPDATE_INTERVAL_MS = 5000;

@Component({
  selector: 'rap-welcome',
  standalone: true,
  imports: [AsyncPipe, FormsModule, NgFor, DatePipe, NgIf],
  styleUrl: './rollapolla-welcome.component.scss',
  template: `
    <main class="main">
      <section class="intro-section">
        <div class="intro-container">
          <img
            class="intro-logo"
            src="https://analogjs.org/img/logos/analog-logo.svg"
            alt="AnalogJs logo. Two red triangles and a white analog wave in front"
          />
          <a
            class="intro-badge"
            target="_blank"
            href="https://twitter.com/rollapolla"
            >Follow along on Twitter</a
          >
          <h1 class="intro-heading">
            <span class="intro-analog">www.RollaPolla.com.</span>
            Polls for everyone!
          </h1>
          <p class="intro-description" data-testid="coming-soon">
            Coming Soon!
          </p>
        </div>
      </section>
      <section id="trpc-demo" class="trpc-section">
        <div class="trpc-container">
          <h2 class="trpc-heading">Leave a note</h2>
          <p class="trpc-description">
            This is an example of how you can use tRPC to superpower your
            client-server interaction.
          </p>
        </div>
        <form class="trpc-form" #f="ngForm" (ngSubmit)="addNote(f)">
          <label class="sr-only" for="newNote"> Note </label>
          <input
            required
            autocomplete="off"
            name="newNote"
            [(ngModel)]="newNote"
            class="trpcInput"
            maxlength="200"
          />
          <button class="lightBtn">+</button>
        </form>
        <div class="notes" *ngIf="notes$ | async as notes; else loading">
          <div
            class="note"
            *ngFor="let note of notes; trackBy: noteTrackBy; let i = index"
          >
            <div class="note-head">
              <p class="note-date">{{ note.createdAt | date: 'medium' }}</p>
              <button class="noteDeleteBtn" (click)="removeNote(note.id)">
                x
              </button>
            </div>
            <p class="note-note">{{ note.note }}</p>
          </div>

          <div class="no-notes " *ngIf="notes.length === 0">
            <h3 class="no-notes-headline">No notes yet!</h3>
            <p class="no-notes-desc">
              Add a new one and see them appear here...
            </p>
          </div>
        </div>
        <ng-template #loading>
          <p class="loading-text">Loading...</p>
        </ng-template>
      </section>
    </main>
  `,
})
export class RollapollaWelcomeComponent {
  private trpc = injectTrpcClient();
  public triggerRefresh$ = new Subject<void>();
  public notes$ = this.triggerRefresh$.pipe(
    switchMap(() => this.trpc.note.list.query()),
    map((res) => res.toReversed()),
    shareReplay(1)
  );
  public newNote = '';

  constructor() {
    const platformId = inject(PLATFORM_ID);
    console.log(`isBrowser:`, isPlatformBrowser(platformId));
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
    console.log('form:', form);
    if (!form.valid) {
      form.form.markAllAsTouched();
      return;
    }
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
