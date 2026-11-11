import { ChangeDetectionStrategy, Component } from '@angular/core';
import { breadcrumb } from '../../../navigation/breadcrumb';
import { ChildSearchPageComponent } from '../../../search/child-search-page.component';
import { CHILD_SEARCH_LEVEL, SEARCH_LEVEL } from '../../../search/search-level';

/** `/suchen/kind`: finds the Kind's Team by its Verein, to mark the Kind. */
@Component({
  selector: 'korb-child-search-route',
  imports: [ChildSearchPageComponent],
  template: `<korb-child-search-page />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ChildSearchPage {
  public constructor() {
    breadcrumb(() => [SEARCH_LEVEL, { title: CHILD_SEARCH_LEVEL.title }]);
  }
}
