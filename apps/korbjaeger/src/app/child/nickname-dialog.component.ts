import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  NICKNAME_LENGTH,
  nicknameCharacterCount,
} from '@wolsok/feat-korbjaeger-selection';

/** What the dialog asks about: whom, and whether to mark or rename. */
export interface NicknameQuestion {
  /** The player's name as the Kader shows it. */
  readonly name: string;
  /** The Spitzname given so far; none while marking. */
  readonly nickname?: string;
  readonly action: 'mark' | 'change';
}

/** What the dialog closes with once confirmed; cancelled, it gives none. */
export interface NicknameAnswer {
  /** As typed: the `Selection` trims it, empty means none. */
  readonly nickname: string;
}

const TITLES: Readonly<Record<NicknameQuestion['action'], string>> = {
  mark: 'Als mein Kind markieren',
  change: 'Spitzname ändern',
};

const CONFIRM_TEXTS: Readonly<Record<NicknameQuestion['action'], string>> = {
  mark: 'Markieren',
  change: 'Speichern',
};

/**
 * Asks for the optional Spitzname of a Kind, when marking it or later.
 * Counts its characters as the `Selection` does (`nicknameCharacterCount`, an
 * emoji as one) and takes none over `NICKNAME_LENGTH`. Opened with a
 * `NicknameQuestion`; closes with a `NicknameAnswer`, or with none where
 * cancelled.
 */
@Component({
  selector: 'korb-nickname-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ title }}</h2>
    <form (submit)="$event.preventDefault(); confirm()">
      <mat-dialog-content>
        <p>{{ question.name }}</p>
        <mat-form-field>
          <mat-label>Spitzname (freiwillig)</mat-label>
          <input
            matInput
            #eingabe
            name="spitzname"
            autocomplete="off"
            [value]="entered()"
            (input)="entered.set(eingabe.value)"
            [attr.aria-invalid]="tooLong()"
          />
          @if (tooLong()) {
            <mat-hint class="too-long" data-qa="nickname-too-long"
              >Höchstens {{ length }} Zeichen</mat-hint
            >
          } @else {
            <mat-hint>So heißt dein Kind im Überblick.</mat-hint>
          }
          <mat-hint align="end" data-qa="nickname-counter"
            >{{ characters() }}/{{ length }}</mat-hint
          >
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Abbrechen</button>
        <button matButton="filled" type="submit" [disabled]="tooLong()">
          {{ confirmText }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      width: 100%;
    }
    .too-long {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NicknameDialogComponent {
  protected readonly question = inject<NicknameQuestion>(MAT_DIALOG_DATA);
  protected readonly length = NICKNAME_LENGTH;
  protected readonly title = TITLES[this.question.action];
  protected readonly confirmText = CONFIRM_TEXTS[this.question.action];
  protected readonly entered = signal(this.question.nickname ?? '');
  protected readonly characters = computed(() =>
    nicknameCharacterCount(this.entered())
  );
  protected readonly tooLong = computed(
    () => this.characters() > NICKNAME_LENGTH
  );

  private readonly dialog =
    inject<MatDialogRef<NicknameDialogComponent, NicknameAnswer>>(MatDialogRef);

  protected confirm(): void {
    if (!this.tooLong()) {
      this.dialog.close({ nickname: this.entered() });
    }
  }
}
