import { Signal } from '@angular/core';
import { FeatureToggles } from '../../shared/app-config';

/** The app-wide configuration admins change at runtime. */
export abstract class AppConfigPort {
  /**
   * Which features are on, live. All on until the stored toggles load; the
   * server renders with the stored toggles and hands them to the browser.
   */
  abstract readonly features: Signal<FeatureToggles>;
}
