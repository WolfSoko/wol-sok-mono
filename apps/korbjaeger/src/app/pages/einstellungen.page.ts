import { ChangeDetectionStrategy, Component } from '@angular/core';
import { breadcrumb } from '../navigation/breadcrumb';
import { SettingsComponent } from '../account/settings.component';

/** `/einstellungen`: the Google account that syncs Meine Teams and Kinder. */
@Component({
  selector: 'korb-settings-page',
  imports: [SettingsComponent],
  template: `<korb-settings />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SettingsPage {
  public constructor() {
    breadcrumb(() => [{ title: 'Einstellungen' }]);
  }
}
