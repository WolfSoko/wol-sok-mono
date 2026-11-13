import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import {
  isThemeChoice,
  THEME_CHOICES,
  ThemeService,
  type ThemeChoice,
} from '@wolsok/shared-theme';

/** Each look as the settings name it; a choice the lib adds needs its name. */
const NAMES: Readonly<Record<ThemeChoice, string>> = {
  system: 'System',
  light: 'Hell',
  dark: 'Dunkel',
};

/**
 * The settings' choice of look: the device's (`System`, followed live),
 * light or dark, kept on this device only (`provideAppearance`).
 */
@Component({
  selector: 'korb-appearance-choice',
  imports: [MatButtonToggleModule, MatCardModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>Darstellung</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p class="hint">
          Bei „System“ folgt die App der Einstellung deines Geräts. Die Wahl
          gilt nur auf diesem Gerät.
        </p>
        <mat-button-toggle-group
          aria-label="Darstellung"
          hideSingleSelectionIndicator
          [value]="theme.choice()"
          (change)="choose($event.value)"
        >
          @for (choice of THEME_CHOICES; track choice) {
            <mat-button-toggle [value]="choice">{{
              NAMES[choice]
            }}</mat-button-toggle>
          }
        </mat-button-toggle-group>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .hint {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppearanceChoiceComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly THEME_CHOICES = THEME_CHOICES;
  protected readonly NAMES = NAMES;

  /** Takes the toggle's value, which Material types as `any`. */
  protected choose(value: unknown): void {
    if (isThemeChoice(value)) {
      this.theme.choose(value);
    }
  }
}
