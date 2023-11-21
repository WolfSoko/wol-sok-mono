import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { CommonModule, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  EventEmitter,
  Inject,
  Output,
  Renderer2,
  Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router } from '@angular/router';
import { ElemResizedDirective, RenderShaderComponent, ResizedEvent } from '@wolsok/ui-kit';
import { filter, map } from 'rxjs/operators';
import { HeadlineAnimationService } from '../../core/headline-animation.service';
import { shader } from '../../title-shader';
import { LoginComponent } from './login/login.component';
import { ServiceWorkerUpdateComponent } from './service-worker-update/service-worker-update.component';

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
  runAnimation: Signal<boolean>;
  isHandset: Signal<boolean>;
  shaderWidth!: number;
  shaderHeight!: number;
  themeMode: 'dark' | 'light' = 'dark';

  constructor(
    private readonly el: ElementRef,
    private readonly headlineAnimations: HeadlineAnimationService,
    breakpointObserver: BreakpointObserver,
    private readonly router: Router,
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly renderer: Renderer2
  ) {
    this.shaderCode = shader;
    const navEnd = toSignal(this.router.events.pipe(filter((value) => value instanceof NavigationEnd)));
    this.isHandset = toSignal(breakpointObserver.observe(Breakpoints.Handset).pipe(map((value) => value.matches)), {
      initialValue: false,
    });
    this.runAnimation = toSignal(this.headlineAnimations.runAnimation$, { initialValue: false });
    effect(() => {
      if (navEnd()) {
        this.headlineAnimations.startAnimation();
      }
    });
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
