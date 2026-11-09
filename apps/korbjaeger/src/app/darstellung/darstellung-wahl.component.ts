import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import {
  isThemeChoice,
  ThemeService,
  type ThemeChoice,
} from '@wolsok/shared-theme';

/** Each look, as the settings name it, in the order they offer them. */
const DARSTELLUNGEN: readonly {
  readonly wert: ThemeChoice;
  readonly name: string;
}[] = [
  { wert: 'system', name: 'System' },
  { wert: 'light', name: 'Hell' },
  { wert: 'dark', name: 'Dunkel' },
];

/**
 * The settings' choice of look: the device's (`System`, followed live),
 * light or dark, kept on this device only (`provideDarstellung`).
 */
@Component({
  selector: 'korb-darstellung-wahl',
  imports: [MatButtonToggleModule, MatCardModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>Darstellung</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p class="hinweis">
          Bei „System“ folgt die App der Einstellung deines Geräts. Die Wahl
          gilt nur auf diesem Gerät.
        </p>
        <mat-button-toggle-group
          aria-label="Darstellung"
          hideSingleSelectionIndicator
          [value]="theme.choice()"
          (change)="waehlen($event.value)"
        >
          @for (darstellung of DARSTELLUNGEN; track darstellung.wert) {
            <mat-button-toggle
              [value]="darstellung.wert"
              [attr.data-qa]="'darstellung-' + darstellung.wert"
            >
              {{ darstellung.name }}
            </mat-button-toggle>
          }
        </mat-button-toggle-group>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .hinweis {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DarstellungWahlComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly DARSTELLUNGEN = DARSTELLUNGEN;

  /** Takes the toggle's value, which Material types as `any`. */
  protected waehlen(wert: unknown): void {
    if (isThemeChoice(wert)) {
      this.theme.choose(wert);
    }
  }
}
