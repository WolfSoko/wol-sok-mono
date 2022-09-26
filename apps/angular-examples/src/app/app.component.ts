import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Inject,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { Angulartics2GoogleTagManager } from 'angulartics2';
import { Environment } from '../environments/environment.type';
import { MainNavRoute } from './app-routes';
import { ENV_TOKEN } from './core/env.token';
import { TitleService } from './core/title.service';
import { MainToolbarComponent } from './feature/main-toolbar/main-toolbar.component';
import { SideNavComponent } from './feature/navigation/side-nav/side-nav.component';
import { ROUTER_LINKS } from './router-links.token';

@Component({
  standalone: true,
  imports: [RouterModule, CommonModule, MainToolbarComponent, SideNavComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  @HostBinding('attr.app-version')
  appVersionAttr = `angular-examples@${this.env.version}`;

  constructor(
    // we need title service to update page title.
    private titleService: TitleService,
    gtmManager: Angulartics2GoogleTagManager,
    @Inject(ROUTER_LINKS) public routerLinks: MainNavRoute[],
    @Inject(ENV_TOKEN) private env: Environment
  ) {
    gtmManager.startTracking();
  }
}
