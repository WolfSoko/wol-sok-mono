import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { MatLegacyListModule as MatListModule } from '@angular/material/legacy-list';
import { Router } from '@angular/router';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { MainNavRoute } from '../../../../app-routing.module';
import { ROUTER_LINKS } from '../../../../router-links.token';
import { NavItemComponent } from '../../../../shared/nav-item/nav-item.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    ElevateCardDirective,
    MatListModule,
    NavItemComponent,
  ],
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent {
  public routerLinks: MainNavRoute[];

  constructor(
    @Inject(ROUTER_LINKS) routerLinks: MainNavRoute[],
    private router: Router
  ) {
    this.routerLinks = routerLinks.filter(
      (route) => route.data?.linkText !== 'Home'
    );
  }

  async openPage(path: string): Promise<void> {
    await this.router.navigateByUrl(path);
  }
}
