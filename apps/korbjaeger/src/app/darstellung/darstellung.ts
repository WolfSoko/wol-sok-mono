import type { EnvironmentProviders } from '@angular/core';
import { provideTheme } from '@wolsok/shared-theme';
import { APPEARANCE_KEY } from '../device-storage';

/**
 * The look the Elternteil chooses in the settings (`ThemeService`): kept on
 * the device under `APPEARANCE_KEY`, never in the account. The one
 * `theme-color` (the brand orange) frames both looks, so the service leaves
 * it alone.
 */
export function provideDarstellung(): EnvironmentProviders {
  return provideTheme({ storageKey: APPEARANCE_KEY });
}
