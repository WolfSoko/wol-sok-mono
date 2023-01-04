import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Inject, Output, Renderer2 } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ElemResizedDirective, RenderShaderComponent, ResizedEvent } from '@wolsok/ui-kit';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { HeadlineAnimationService } from '../../core/headline-animation.service';
import { shader } from '../../title-shader';
import { LoginComponent } from './login/login.component';
import { ServiceWorkerUpdateComponent } from './service-worker-update/service-worker-update.component';

@UntilDestroy()
@Component({
  selector: 'app-main-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    LoginComponent,
    ServiceWorkerUpdateComponent,
    ElemResizedDirective,
    RenderShaderComponent,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
  ],
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
  themeMode: 'dark' | 'light' = 'dark';

  constructor(
    private readonly elRef: ElementRef,
    private readonly headlineAnimations: HeadlineAnimationService,
    private readonly router: Router,
    private readonly breakpointObserver: BreakpointObserver,
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly renderer: Renderer2
  ) {
    this.router.events
      .pipe(
        filter((value) => value instanceof NavigationEnd),
        untilDestroyed(this)
      )
      .subscribe(() => headlineAnimations.startAnimation());
    this.isHandset$ = breakpointObserver.observe(Breakpoints.Handset).pipe(map((value) => value.matches));
    this.runAnimation$ = headlineAnimations.runAnimation$;
    this.shaderCode = shader;
  }

  onResize($event: ResizedEvent) {
    this.shaderWidth = $event.newWidth;
    this.shaderHeight = $event.newHeight;
  }

  toggleTheme(): void {
    if (this.themeMode === 'dark') {
      this.renderer.removeClass(this.document.body, 'theme-default');
      this.renderer.addClass(this.document.body, 'theme-alternate');
      this.themeMode = 'light';
      return;
    }
    if (this.themeMode === 'light') {
      this.renderer.removeClass(this.document.body, 'theme-alternate');
      this.renderer.addClass(this.document.body, 'theme-default');
      this.themeMode = 'dark';
    }
  }
}
