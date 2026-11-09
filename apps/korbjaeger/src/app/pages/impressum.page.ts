import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ImpressumComponent } from '../rechtliches/impressum.component';

/** `/impressum`: the legal notice, linked from the footer. */
@Component({
  selector: 'korb-impressum-page',
  imports: [ImpressumComponent],
  template: `<korb-impressum />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ImpressumPage {}
