import { ChangeDetectionStrategy, Component } from '@angular/core';
import { breadcrumb } from '../navigation/breadcrumb';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

/**
 * Every path no other page matches. Hosting answers it with the shell
 * (200, `noindex` like every page, ADR 0019); the page says it does not
 * exist and leads back to the overview.
 */
@Component({
  selector: 'korb-nicht-gefunden-page',
  imports: [MatButtonModule, RouterLink],
  template: `
    <h1>Seite nicht gefunden</h1>
    <p>Diese Seite gibt es nicht (mehr).</p>
    <a matButton="filled" routerLink="/">Zur Startseite</a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class NichtGefundenPage {
  public constructor() {
    breadcrumb(() => [{ title: 'Seite nicht gefunden' }]);
  }
}
