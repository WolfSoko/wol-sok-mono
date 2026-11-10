import { ChangeDetectionStrategy, Component } from '@angular/core';
import { breadcrumb } from '../../navigation/breadcrumb';
import { SEARCH_LEVEL } from '../../search/search-level';
import { SearchPageComponent } from '../../search/search-page.component';

/** `/suchen`: finds a Team by its Verein or its Liga. */
@Component({
  selector: 'korb-suchen-page',
  imports: [SearchPageComponent],
  template: `<korb-search-page />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SuchenPage {
  public constructor() {
    breadcrumb(() => [{ title: SEARCH_LEVEL.title }]);
  }
}
