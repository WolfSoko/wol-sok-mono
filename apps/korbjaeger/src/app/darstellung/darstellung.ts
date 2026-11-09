import type { EnvironmentProviders } from '@angular/core';
import { provideTheme } from '@wolsok/shared-theme';
import { DARSTELLUNG_SCHLUESSEL } from '../geraete-speicher';

/**
 * The look the Elternteil chooses in the settings (`ThemeService`): kept on
 * the device under `DARSTELLUNG_SCHLUESSEL`, never in the account. The one
 * `theme-color` (the brand orange) frames both looks, so the service leaves
 * it alone.
 */
export function provideDarstellung(): EnvironmentProviders {
  return provideTheme({ storageKey: DARSTELLUNG_SCHLUESSEL });
}
