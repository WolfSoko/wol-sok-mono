import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Output } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { HeadlineAnimationService } from '../core/headline-animation.service';
import { ResizedEvent } from '../shared/resized-event';
import { shader } from '../title-shader';

@UntilDestroy()
@Component({
  selector: 'app-main-toolbar',
  templateUrl: './main-toolbar.component.html',
  styleUrls: ['./main-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainToolbarComponent {
  @Output() clickSideNav = new EventEmitter<Event>();
  shaderCode: string;
  runAnimation$: Observable<boolean>;
  isHandset$: Observable<boolean>;
  shaderWidth!: number;
  shaderHeight!: number;

  constructor(
    private elRef: ElementRef,
    private headlineAnimations: HeadlineAnimationService,
    private router: Router,
    private breakpointObserver: BreakpointObserver
  ) {
    this.router.events
      .pipe(
        filter((value) => value instanceof NavigationEnd),
        untilDestroyed(this)
      )
      .subscribe(() => headlineAnimations.startAnimation());
    this.isHandset$ = breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((value) => value.matches));
    this.runAnimation$ = headlineAnimations.runAnimation$;
    this.shaderCode = shader;
  }

  onResize($event: ResizedEvent) {
    this.shaderWidth = $event.newWidth;
    this.shaderHeight = $event.newHeight;
  }
}
