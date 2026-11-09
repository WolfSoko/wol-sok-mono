import { ChangeDetectionStrategy, Component } from '@angular/core';
import { breadcrumb } from '../navigation/breadcrumb';
import { EinstellungenComponent } from '../konto/einstellungen.component';

/** `/einstellungen`: the Google account that syncs Meine Teams and Kinder. */
@Component({
  selector: 'korb-einstellungen-page',
  imports: [EinstellungenComponent],
  template: `<korb-einstellungen />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class EinstellungenPage {
  public constructor() {
    breadcrumb(() => [{ title: 'Einstellungen' }]);
  }
}
