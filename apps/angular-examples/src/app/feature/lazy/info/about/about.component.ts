import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { Router } from '@angular/router';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { MainNavRoute, MainNavRoutes } from '../../../../app-routing';
import { ROUTER_LINKS } from '../../../../router-links.token';
import { NavItemComponent } from '../../../../shared/nav-item/nav-item.component';

@Component({
  standalone: true,
  imports: [CommonModule, MatCardModule, ElevateCardDirective, MatListModule, NavItemComponent],
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent {
  public routerLinks: MainNavRoute[];

  constructor(
    @Inject(ROUTER_LINKS) routerLinks: MainNavRoutes,
    private router: Router
  ) {
    this.routerLinks = routerLinks.filter((route) => route.data?.linkText !== 'Home');
  }

  async openPage(path: string): Promise<void> {
    await this.router.navigateByUrl(path);
  }
}
