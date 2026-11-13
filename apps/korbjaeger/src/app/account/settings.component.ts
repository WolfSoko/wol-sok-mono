import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AppearanceChoiceComponent } from '../appearance/appearance-choice.component';
import { SelectionTooNewError } from '@wolsok/feat-korbjaeger-selection';
import { selectionErrorText } from '../errors/selection-error-text';
import { ACCOUNT_SESSION } from './account';
import { notTakenOverText } from './not-taken-over-text';
import {
  SignInCancelledError,
  AccountSwitchedError,
  AccountNotDeletedError,
  NotAllSentError,
  NoInternetToDeleteError,
  PopupBlockedError,
} from './account-service';
import type { Step } from './account-session';
import {
  DeleteAccountDialogComponent,
  type DeleteAccountQuestion,
} from './delete-account-dialog.component';

/** What the settings say when a step of the account failed. */
const STEP_ERRORS = {
  'sign-in': 'Die Anmeldung hat nicht geklappt. Bitte noch einmal versuchen.',
  'sign-out': 'Das Abmelden hat nicht geklappt. Bitte noch einmal versuchen.',
  delete: 'Das Konto ist noch nicht gelöscht. Bitte noch einmal versuchen.',
} as const;

const POPUP_BLOCKED =
  'Dein Browser hat das Fenster von Google blockiert. Erlaube Pop-ups für diese Seite und versuche es noch einmal.';

const DELETION_OFFLINE =
  'Ohne Internet lässt sich das Konto nicht löschen. Bitte versuche es mit Internet noch einmal.';

const NOT_ALL_SENT =
  'Noch sind nicht alle Änderungen bei deinem Konto angekommen. Melde dich ab, sobald du wieder online bist.';

const DELETION_CANCELLED =
  'Das Konto ist nicht gelöscht: Die Bestätigung bei Google wurde abgebrochen.';

const ACCOUNT_SWITCHED =
  'Das Konto ist nicht gelöscht: In einem anderen Tab ist inzwischen ein anderes Konto angemeldet.';

const ACCOUNT_NOT_DELETED =
  'Deine Teams und Kinder sind gelöscht, dein Konto selbst noch nicht. Bitte lösche es noch einmal.';

/**
 * The settings: the look (`korb-appearance-choice`) and the Google account,
 * which keeps Meine Teams and Kinder the same on every device signed in
 * with it. Signing in, out and deleting go
 * through `ACCOUNT_SESSION`, which loads Firebase as the page opens, so a
 * click opens Google's popup at once; a popup closed while signing in
 * shows nothing.
 */
@Component({
  selector: 'korb-settings',
  imports: [
    AppearanceChoiceComponent,
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
  ],
  template: `
    <h1>Einstellungen</h1>
    <korb-appearance-choice />
    @if (state().kind !== 'off') {
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Konto</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @switch (state().kind) {
            @case ('signed-out') {
              <p>
                Ohne Konto bleiben Meine Teams und Kinder auf diesem Gerät. Mit
                einem Google-Konto sind sie auf jedem Gerät gleich, auf dem ihr
                damit angemeldet seid.
              </p>
            }
            @case ('loading') {
              <mat-progress-bar mode="indeterminate" />
              <p>Dein Konto wird geöffnet …</p>
            }
            @case ('signed-in') {
              <p data-qa="account-name">{{ signedInAs() }}</p>
              <p>
                Meine Teams und Kinder sind in deinem Konto gespeichert.
                Abmelden nimmt sie von diesem Gerät.
              </p>
            }
            @case ('unreachable') {
              <p role="alert">
                Dein Konto lässt sich gerade nicht öffnen. Bitte die App neu
                laden.
              </p>
            }
          }
          @if (leftOverText(); as text) {
            <p class="hint" data-qa="not-taken-over">{{ text }}</p>
          }
          @if (running() === 'delete') {
            <p class="hint" data-qa="deletion-running">
              Das Konto wird gelöscht. Ohne Internet wartet das, bis dein Gerät
              wieder online ist; lass die App so lange offen.
            </p>
          }
          @if (deviceKept()) {
            <p class="hint" data-qa="device-kept">
              {{ DEVICE_KEPT_TEXT }}
            </p>
          }
          @if (error(); as text) {
            <p class="error" role="alert">{{ text }}</p>
          }
        </mat-card-content>
        <mat-card-actions>
          @switch (state().kind) {
            @case ('signed-out') {
              <button
                matButton="filled"
                type="button"
                data-qa="sign-in"
                [disabled]="busy() || !ready()"
                (click)="signIn()"
              >
                Mit Google anmelden
              </button>
              @if (prepareFailed()) {
                <p class="error" role="alert" data-qa="prepare-failed">
                  Die Anmeldung ließ sich nicht laden. Bitte prüfe die
                  Internetverbindung.
                </p>
                <button
                  matButton
                  type="button"
                  data-qa="prepare-again"
                  (click)="prepare()"
                >
                  Erneut versuchen
                </button>
              } @else if (!ready()) {
                <p class="hint" data-qa="sign-in-preparing">
                  Anmeldung wird vorbereitet …
                </p>
              }
            }
            @case ('signed-in') {
              <button
                matButton="outlined"
                type="button"
                data-qa="sign-out"
                [disabled]="busy()"
                (click)="signOut()"
              >
                Abmelden
              </button>
              <button
                matButton
                type="button"
                data-qa="delete-account"
                [disabled]="busy()"
                (click)="deleteAccount()"
              >
                Konto löschen
              </button>
            }
          }
        </mat-card-actions>
      </mat-card>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 1rem;
      align-content: start;
    }
    mat-card-actions {
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .error {
      color: var(--mat-sys-error);
    }
    .hint {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly session = inject(ACCOUNT_SESSION);
  private readonly dialog = inject(MatDialog);

  protected readonly state = this.session.state;
  /** The step running, also one started before this page opened. */
  protected readonly running = this.session.running;
  protected readonly busy = computed(() => this.running() !== undefined);
  /** What the last step that failed says, also one before this page opened. */
  protected readonly error = computed(() => {
    const failure = this.session.failure();
    return failure && errorText(failure.step, failure.error);
  });
  /** What of the device's choices did not fit into the account shown. */
  protected readonly leftOverText = computed(() => {
    const hint = this.session.takeoverHint();
    return hint && notTakenOverText(hint.leftOver);
  });
  /** Choices of the device not in the account shown yet, for the next start. */
  protected readonly deviceKept = computed(
    () => this.session.takeoverHint()?.kept ?? false
  );
  /** Firebase is loaded, so a click opens Google's popup at once. */
  protected readonly ready = this.session.ready;
  /** Firebase could not be loaded (offline, a chunk a release removed). */
  protected readonly prepareFailed = signal(false);
  protected readonly DEVICE_KEPT_TEXT =
    'Einige Änderungen dieses Geräts sind noch nicht in deinem Konto. Sie bleiben auf dem Gerät und kommen beim nächsten Öffnen der App dazu.';

  public constructor() {
    void this.prepare();
  }

  protected readonly signedInAs = computed(() => {
    const state = this.state();
    return state.kind === 'signed-in' && state.name
      ? `Angemeldet als ${state.name}`
      : 'Angemeldet mit Google';
  });

  /** Loads Firebase ahead of the click; says so where that fails. */
  protected async prepare(): Promise<void> {
    this.prepareFailed.set(false);
    try {
      await this.session.prepare();
    } catch {
      this.prepareFailed.set(true);
    }
  }

  // each step's failure shows through `error`, from the session
  protected signIn(): Promise<void> {
    return this.session.signIn().then(
      () => undefined,
      () => undefined
    );
  }

  protected signOut(): Promise<void> {
    return this.session.signOut().catch(() => undefined);
  }

  protected deleteAccount(): void {
    this.dialog.open<DeleteAccountDialogComponent, DeleteAccountQuestion>(
      DeleteAccountDialogComponent,
      {
        data: {
          deleteAccount: () =>
            void this.session.deleteAccount().catch(() => undefined),
        },
      }
    );
  }
}

/**
 * What to say of `error` in `step`; nothing for a popup closed while
 * signing in, nor for a takeover at the start, whose notice tells it.
 */
function errorText(step: Step, error: unknown): string | undefined {
  if (step === 'take-over') {
    return undefined;
  }
  if (error instanceof AccountSwitchedError) {
    return ACCOUNT_SWITCHED;
  }
  if (error instanceof AccountNotDeletedError) {
    return ACCOUNT_NOT_DELETED;
  }
  if (error instanceof SignInCancelledError) {
    return step === 'delete' ? DELETION_CANCELLED : undefined;
  }
  if (error instanceof PopupBlockedError) {
    return POPUP_BLOCKED;
  }
  if (error instanceof NoInternetToDeleteError) {
    return DELETION_OFFLINE;
  }
  if (error instanceof NotAllSentError) {
    return NOT_ALL_SENT;
  }
  return error instanceof SelectionTooNewError
    ? selectionErrorText(error)
    : STEP_ERRORS[step];
}
