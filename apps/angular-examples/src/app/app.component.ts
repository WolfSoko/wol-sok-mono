import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Inject,
  Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { Angulartics2GoogleTagManager } from 'angulartics2';
import { catchError, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
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
  standalone: true,
  imports: [MainToolbarComponent, SideNavComponent, RouterOutlet],
})
export class AppComponent {
  appVersionAttr: Signal<string | undefined>;

  constructor(
    // we need title service to update page title.
    private titleService: TitleService,
    gtmManager: Angulartics2GoogleTagManager,
    @Inject(ROUTER_LINKS) public routerLinks: MainNavRoutes,
    @Inject(ENV_TOKEN) private env: Environment,
    httpClient: HttpClient
  ) {
    gtmManager.startTracking();
    this.appVersionAttr = toSignal(
      httpClient.get<string>('/version.json').pipe(
        catchError((err, caught) => {
          console.warn('No version found', err);
          return of(env.version);
        }),
        map((version: string) => `angular-examples@${version}`)
      )
    );
  }
}
