import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Inject,
} from '@angular/core';
import { Angulartics2GoogleTagManager } from 'angulartics2';
import { environment } from '../environments/environment';
import { MainNavRoute } from './app-routing.module';
import { TitleService } from './core/title.service';
import { ROUTER_LINKS } from './router-links.token';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  @HostBinding('attr.app-version') appVersionAttr = 'v' + environment.version;

  constructor(
    // we need title service to update page title.
    private titleService: TitleService,
    gtmManager: Angulartics2GoogleTagManager,
    @Inject(ROUTER_LINKS) public routerLinks: MainNavRoute[]
  ) {
    gtmManager.startTracking();
  }
}
