import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  catchError,
  concatWith,
  map,
  Observable,
  of,
  scan,
  switchMap,
} from 'rxjs';
import { TranslationKey } from '../i18n/dictionaries';
import { TranslatePipe } from '../i18n/translate.pipe';
import { GameSettingsService } from '../settings.service';
import { isRunOver } from '../state/endless';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import { canPlayBack, savedRegardless } from '../state/replay';
import { GameReplays } from '../storage/game-replays';

/**
 * The line under a match's result about its recording (ADR 0011): whether
 * the replay was saved - "saved" only once it is stored - and the way to
 * watch it again ("Watch replay"), which opens the stage's replay screen
 * on `GameStateService.lastRecording`. After the first match against the
 * computer saved in the cloud it also says, once per device, that such
 * matches are saved and where to turn that off (the device setting
 * `recordingHintShown`).
 */
@Component({
  selector: 'feat-lazy-bac-game-replay-note',
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    @if (status(); as status) {
      <p class="note" role="status">{{ status | t }}</p>
    }
    @if (hint()) {
      <p class="note">{{ 'replay.status.recordingHint' | t }}</p>
    }
    @if (watchable()) {
      <button mat-stroked-button type="button" (click)="watch.emit()">
        <mat-icon>smart_display</mat-icon>
        {{ 'replay.watch' | t }}
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
    }

    :host:empty {
      display: none;
    }

    .note {
      margin: 0;
      font-size: 0.85rem;
      color: var(--bw-soft, inherit);
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplayNoteComponent {
  private readonly store = inject(GameStateStore);
  private readonly settings = inject(GameSettingsService);
  private readonly replays = inject(GameReplays);

  /** The player wants to watch the match again. */
  public readonly watch = output<void>();

  /** The recording of the match that just ended - null for none. */
  private readonly recording = inject(GameStateService).lastRecording;

  /**
   * Where saving the replay under `id` stands - `pending` for none, too.
   * It names the id, as it follows the recording a little late.
   */
  private readonly saving = toSignal(
    toObservable(computed(() => this.recording()?.id ?? null)).pipe(
      switchMap((id) =>
        (id === null
          ? of<SaveState>('pending')
          : saveState(this.replays.watchSaved(id))
        ).pipe(map((state) => ({ id, state })))
      )
    ),
    { initialValue: { id: null, state: 'pending' as SaveState } }
  );

  /** Where saving the replay of the match just played stands. */
  private readonly saved = computed((): SaveState => {
    const saving = this.saving();
    return saving.id === (this.recording()?.id ?? null)
      ? saving.state
      : 'pending';
  });

  /** The saved match the one-time hint is shown for - null for none. */
  private readonly hintFor = signal<string | null>(null);

  /** True while the hint on saved matches against the computer shows. */
  protected readonly hint = computed(() => {
    const id = this.recording()?.id ?? null;
    return id !== null && id === this.hintFor();
  });

  /**
   * True when the match just played can be watched again - not in the
   * middle of an endless run, which watching would leave.
   */
  protected readonly watchable = computed(() => {
    const replay = this.recording()?.replay ?? null;
    const run = this.store.endless();
    return (
      replay !== null &&
      canPlayBack(replay) &&
      (run === null || !this.store.endlessMatch() || isRunOver(run))
    );
  });

  public constructor() {
    // The first match against the computer the cloud keeps - not online,
    // not ranked, which are saved whatever the settings say - brings the
    // hint, once the stored settings tell it was not shown yet.
    effect(() => {
      const recording = this.recording();
      if (
        recording?.id == null ||
        !this.replays.cloud ||
        this.saved() !== 'saved' ||
        !this.settings.loaded() ||
        this.settings.recordingHintShown() ||
        savedRegardless(recording.replay.header)
      ) {
        return;
      }
      const id = recording.id;
      untracked(() => {
        this.hintFor.set(id);
        this.settings.markRecordingHintShown();
      });
    });
  }

  protected readonly status = computed((): TranslationKey | null => {
    const recording = this.recording();
    if (recording === null) {
      return null;
    }
    const saved = this.saved();
    if (saved === 'saved') {
      return this.replays.cloud
        ? 'replay.status.saved'
        : 'replay.status.savedDevice';
    }
    if (recording.id !== null) {
      return saved === 'unconfirmed'
        ? 'replay.status.unconfirmed'
        : 'replay.status.uploading';
    }
    // An online or ranked match is always handed over; another one only
    // with the setting on.
    return !savedRegardless(recording.replay.header) &&
      !this.settings.saveMatches()
      ? 'replay.status.notSaved'
      : null;
  });
}

/**
 * Where saving a replay stands: stored, still on its way, or no longer
 * watched - `watchSaved` gave up asking, or failed, before it was stored.
 */
type SaveState = 'saved' | 'pending' | 'unconfirmed';

/** `watchSaved` as a {@link SaveState}: once saved, it stays saved. */
function saveState(saved: Observable<boolean>): Observable<SaveState> {
  return saved.pipe(
    map((stored): SaveState => (stored ? 'saved' : 'pending')),
    catchError(() => of<SaveState>('unconfirmed')),
    concatWith(of<SaveState>('unconfirmed')),
    scan(
      (last: SaveState, next: SaveState): SaveState =>
        last === 'saved' ? last : next,
      'pending'
    )
  );
}
