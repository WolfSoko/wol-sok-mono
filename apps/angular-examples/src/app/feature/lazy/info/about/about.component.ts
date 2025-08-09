import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatAnchor } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { Router } from '@angular/router';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { MainNavRoute, MainNavRoutes } from '../../../../app-routing';
import { ROUTER_LINKS } from '../../../../router-links.token';
import { NavItemComponent } from '../../../../shared/nav-item/nav-item.component';

@Component({
  imports: [
    MatCardModule,
    ElevateCardDirective,
    MatListModule,
    NavItemComponent,
    MatAnchor,
  ],
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent {
  private router = inject(Router);

  public routerLinks: MainNavRoute[];

  constructor() {
    const routerLinks = inject<MainNavRoutes>(ROUTER_LINKS);

    this.routerLinks = routerLinks.filter(
      (route) => route.data?.linkText !== 'Home'
    );
  }

  async openPage(path: string): Promise<void> {
    await this.router.navigateByUrl(path);
  }
}
