import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChild,
  ElementRef,
  Inject,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import { MatLegacyListModule as MatListModule } from '@angular/material/legacy-list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { LetDirective } from '@wolsok/ui-kit';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  Observable,
  tap,
} from 'rxjs';
import { MainNavRoute } from '../../../app-routing.module';
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
  ],
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideNavComponent {
  @ViewChild(MatSidenav) sideNav!: MatSidenav;
  @ContentChild('content') contentRef!: ElementRef;

  showStatic$: Observable<boolean> = this.breakpointObserver
    .observe([Breakpoints.Large, Breakpoints.XLarge])
    .pipe(
      map((result) => result?.matches),
      distinctUntilChanged(),
      tap(() => this.markParentForChangeDetection())
    );

  private showSidebarSubject: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);

  showSidebar$: Observable<boolean> = combineLatest([
    this.showStatic$,
    this.showSidebarSubject.asObservable(),
  ]).pipe(
    map(([isStatic, show]) => isStatic || show),
    distinctUntilChanged()
  );

  constructor(
    @Inject(ROUTER_LINKS) public routerLinks: MainNavRoute[],
    private readonly breakpointObserver: BreakpointObserver,
    private cdRef: ChangeDetectorRef,
    private viewContainerRef: ViewContainerRef
  ) {}

  toggle(): void {
    this.showSidebarSubject.next(!this.showSidebarSubject.getValue());
  }

  close(): void {
    this.showSidebarSubject.next(false);
  }

  open(): void {
    this.showSidebarSubject.next(true);
  }

  private markParentForChangeDetection(): void {
    this.viewContainerRef.injector.get(ChangeDetectorRef).markForCheck();
  }
}
