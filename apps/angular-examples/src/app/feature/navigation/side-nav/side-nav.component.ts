import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  Inject,
  signal,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { LetDirective } from '@wolsok/ui-kit';
import { map } from 'rxjs';
import { MainNavRoute } from '../../../app-routing';
import { ROUTER_LINKS } from '../../../router-links.token';
import { NavItemComponent } from '../../../shared/nav-item/nav-item.component';

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [
    CommonModule,
    MatSidenavModule,
    MatListModule,
    NavItemComponent,
    LetDirective,
    MatProgressSpinnerModule,
  ],
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideNavComponent {
  private readonly breakpointObserver: BreakpointObserver =
    inject(BreakpointObserver);
  private isLargeScreen = toSignal(
    this.breakpointObserver
      .observe([Breakpoints.Large, Breakpoints.XLarge])
      .pipe(map((result) => result.matches)),
    { initialValue: false }
  );

  mode = computed(() => (this.isLargeScreen() ? 'side' : 'over'));
  hasBackdrop = computed(() => !this.isLargeScreen());
  showSidebar = signal<boolean>(false);

  constructor(
    @Inject(ROUTER_LINKS) public routerLinks: MainNavRoute[],
    private viewContainerRef: ViewContainerRef
  ) {
    effect(
      () => {
        this.showSidebar.set(this.isLargeScreen());
        this.markParentForChangeDetection();
      },
      { allowSignalWrites: true }
    );
  }

  toggle(): void {
    this.showSidebar.update((show) => !show);
  }

  close(): void {
    this.showSidebar.set(false);
  }

  open(): void {
    this.showSidebar.set(true);
  }

  private markParentForChangeDetection(): void {
    this.viewContainerRef.injector.get(ChangeDetectorRef).markForCheck();
  }
}
