import { ChangeDetectionStrategy, Component } from '@angular/core';
import { breadcrumb } from '../navigation/breadcrumb';
import { PrivacyComponent } from '../legal/privacy.component';

/** `/privacy`: the privacy policy, linked from the footer. */
@Component({
  selector: 'korb-privacy-page',
  imports: [PrivacyComponent],
  template: `<korb-privacy />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PrivacyPage {
  public constructor() {
    breadcrumb(() => [{ title: 'Datenschutz' }]);
  }
}
