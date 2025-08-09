import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map, switchMap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class TitleService {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private titleService = inject(Title);

  constructor() {
    const linkText$ = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      switchMap(() => {
        let actRoute = this.activatedRoute;
        while (
          actRoute.firstChild != null &&
          actRoute.firstChild.outlet === 'primary'
        ) {
          actRoute = actRoute.firstChild;
        }
        return actRoute.data;
      }),
      map(
        (data) =>
          `${
            data.linkText ? data.linkText + '@' : ''
          }angular-examples by wolsok`
      )
    );

    linkText$.subscribe((titleText) => this.titleService.setTitle(titleText));
  }
}
