import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import type { ClubId } from '@wolsok/feat-shared-basketball-data';
import { SELECTION } from '../selection/selection';
import {
  clubColorsFor,
  clubColorsOf,
  type ClubColors,
} from '@wolsok/feat-korbjaeger-selection';
import { selectionChange } from '../errors/selection-change';
import { ColorChoiceComponent } from './color-choice.component';
import { ColorSchemeDirective } from './apply-club-colors';

/** What the bottom sheet is opened for: a Verein, with its name to show. */
export interface ClubColorsSheetData {
  readonly clubId: ClubId;
  readonly clubName: string;
}

/**
 * The bottom sheet "Vereinsfarben" (#2918): a Verein's colour and an
 * optional second one, from presets or the colour picker, with a preview
 * of how the app looks in them; "Übernehmen" stores them in the `Selection`,
 * "Zurücksetzen" takes them away, so the app's own apply again. A failed
 * change says why and keeps the sheet open.
 */
@Component({
  selector: 'korb-club-colors-sheet',
  imports: [MatButtonModule, ColorChoiceComponent, ColorSchemeDirective],
  template: `
    <h2>Vereinsfarben</h2>
    <p class="explanation">
      Farben für die Teams von {{ data.clubName }} in Korbjäger. Texte bleiben
      lesbar: Wo eine Farbe zu hell oder zu dunkel ist, passt die App ihren Ton
      an.
    </p>
    <korb-color-choice
      data-qa="primary-color"
      legend="Hauptfarbe"
      [(color)]="primary"
    />
    <korb-color-choice
      data-qa="secondary-color"
      legend="Zweite Farbe (optional)"
      withNone
      [(color)]="secondary"
    />
    <div class="preview" data-qa="preview" [korbColorScheme]="preview()">
      <p class="preview-title">Vorschau</p>
      <span class="preview-button">Team folgen</span>
      <span class="preview-secondary">Zweite Farbe</span>
      <p class="scoreboard preview-board">Nächstes Spiel</p>
    </div>
    @if (change.error(); as text) {
      <p class="error" role="alert">{{ text }}</p>
    }
    <div class="actions">
      <button
        matButton="filled"
        type="button"
        [disabled]="preview() === undefined || running()"
        (click)="apply()"
      >
        Übernehmen
      </button>
      @if (stored()) {
        <button
          matButton="outlined"
          type="button"
          [disabled]="running()"
          (click)="reset()"
        >
          Zurücksetzen
        </button>
      }
      <button matButton type="button" (click)="close()">Abbrechen</button>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: 1rem;
      padding-block: 0.5rem 1rem;
    }
    h2,
    p {
      margin: 0;
    }
    .explanation {
      color: var(--mat-sys-on-surface-variant);
    }
    .preview {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container);
      color: var(--mat-sys-on-surface);
      border-block-start: var(--korb-line-width) solid var(--mat-sys-primary);
    }
    .preview-title {
      flex-basis: 100%;
      font: var(--mat-sys-title-medium);
      font-weight: var(--mat-sys-title-medium-weight);
      color: var(--mat-sys-primary);
    }
    .preview-button,
    .preview-secondary {
      padding: 0.5rem 1rem;
      border-radius: var(--mat-sys-corner-full);
    }
    .preview-button {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .preview-secondary {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .preview-board {
      flex-basis: 100%;
      padding: 0.75rem;
    }
    .error {
      color: var(--mat-sys-error);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClubColorsSheetComponent {
  protected readonly data = inject<ClubColorsSheetData>(MAT_BOTTOM_SHEET_DATA);
  private readonly sheet = inject(MatBottomSheetRef);
  private readonly selection = inject(SELECTION);

  /** The colours the Verein has now; `undefined` for none. */
  protected readonly stored = computed(() =>
    clubColorsFor(this.selection.clubColors(), this.data.clubId)
  );

  private readonly initial = untracked(this.stored);
  protected readonly primary = signal(this.initial?.primary);
  protected readonly secondary = signal(this.initial?.secondary);

  /** What the choice looks like; none before a first colour is chosen. */
  protected readonly preview = computed((): ClubColors | undefined => {
    const primary = this.primary();
    // presets and the colour picker both give #rrggbb
    return primary === undefined
      ? undefined
      : clubColorsOf(primary, this.secondary());
  });

  protected readonly change = selectionChange();
  /** Whether a change runs: the buttons wait for it, so a double tap writes once. */
  protected readonly running = signal(false);

  protected async apply(): Promise<void> {
    const colors = this.preview();
    if (colors !== undefined) {
      await this.changeColors(() =>
        this.selection.setClubColors(this.data.clubId, colors)
      );
    }
  }

  protected reset(): Promise<void> {
    return this.changeColors(() =>
      this.selection.resetClubColors(this.data.clubId)
    );
  }

  /** Runs `change` once at a time; closes once it succeeded. */
  private async changeColors(change: () => Promise<void>): Promise<void> {
    if (this.running()) {
      return;
    }
    this.running.set(true);
    const done = await this.change.run(change);
    this.running.set(false);
    if (done) {
      this.close();
    }
  }

  protected close(): void {
    this.sheet.dismiss();
  }
}
