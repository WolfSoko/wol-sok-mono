import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Angulartics2GoogleTagManager } from 'angulartics2';
import { Environment } from '../environments/environment.type';
import { MainNavRoutes } from './app-routing';
import { ENV_TOKEN } from './core/env.token';
import { TitleService } from './core/title.service';
import { MainToolbarComponent } from './feature/main-toolbar/main-toolbar.component';
import { SideNavComponent } from './feature/navigation/side-nav/side-nav.component';
import { ROUTER_LINKS } from './router-links.token';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MainToolbarComponent, SideNavComponent, RouterOutlet],
})
export class AppComponent {
  private titleService = inject(TitleService);
  routerLinks = inject<MainNavRoutes>(ROUTER_LINKS);
  private env = inject<Environment>(ENV_TOKEN);

  appVersion: string;

  constructor() {
    const gtmManager = inject(Angulartics2GoogleTagManager);
    const env = this.env;

    gtmManager.startTracking();
    this.appVersion = `angular-examples@${env.version ?? 'next'}`;
  }
}
