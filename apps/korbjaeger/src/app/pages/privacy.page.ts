import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DatenschutzComponent } from '../rechtliches/datenschutz.component';

/** `/privacy`: the privacy policy, linked from the footer. */
@Component({
  selector: 'korb-privacy-page',
  imports: [DatenschutzComponent],
  template: `<korb-datenschutz />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PrivacyPage {}
