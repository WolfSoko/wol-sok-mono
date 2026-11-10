import { ChangeDetectionStrategy, Component } from '@angular/core';
import { breadcrumb } from '../../navigation/breadcrumb';
import { SearchComponent } from '../../search/search.component';

/** `/suchen`: finds a Team to follow by its Verein, a Kind or its Liga. */
@Component({
  selector: 'korb-search-page',
  imports: [SearchComponent],
  template: `<korb-search />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SearchPage {
  public constructor() {
    breadcrumb(() => [{ title: 'Suchen' }]);
  }
}
