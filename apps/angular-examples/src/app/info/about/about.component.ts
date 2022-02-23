import {ChangeDetectionStrategy, Component, Inject} from "@angular/core";
import {MainNavRoute} from "../../app-routing.module";
import {ROUTER_LINKS} from "../../router-links.token";
import {Router} from "@angular/router";

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutComponent {

  public routerLinks: MainNavRoute[];

  constructor(@Inject(ROUTER_LINKS) routerLinks: MainNavRoute[], private router: Router) {
    this.routerLinks = routerLinks.filter(route => route.data?.linkText !== 'Home');
  }

  async openPage(path: string): Promise<void> {
    await this.router.navigateByUrl(path);
  }


}
