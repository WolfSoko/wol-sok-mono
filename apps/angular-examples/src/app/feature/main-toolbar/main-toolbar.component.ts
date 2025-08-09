import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  output,
  Renderer2,
  Signal,
  DOCUMENT,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { HeadlineAnimationService } from '@wolsok/headline-animation';
import {
  ElemResizedDirective,
  RenderShaderComponent,
  ResizedEvent,
} from '@wolsok/ui-kit';
import { FragCode } from '@wolsok/ws-gl';
import { filter, map } from 'rxjs/operators';
import { stopHeadlineAnimationWhenNotVisible } from '../../core/stop-headline-animation-when-not-visible';
import shader from '../../title-shader.frag';
import { LoginComponent } from './login/login.component';
import { ServiceWorkerUpdateComponent } from './service-worker-update/service-worker-update.component';

@Component({
  selector: 'app-main-toolbar',
  imports: [
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
  clickSideNav = output<Event>();

  private readonly headlineAnimationService = inject(HeadlineAnimationService);
  private readonly router = inject(Router);
  private readonly document: Document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);

  shaderCode: FragCode = shader;
  runAnimation: Signal<boolean> = this.headlineAnimationService.runAnimation;
  isHandset: Signal<boolean>;
  shaderWidth!: number;
  shaderHeight!: number;
  themeMode: 'dark' | 'light' = 'dark';

  constructor() {
    stopHeadlineAnimationWhenNotVisible(this.headlineAnimationService);

    const navState = toSignal(
      this.router.events.pipe(
        filter(
          (value) =>
            value instanceof NavigationEnd || value instanceof NavigationStart
        ),
        map((event) =>
          event instanceof NavigationEnd
            ? ('navEnd' as const)
            : ('navStart' as const)
        )
      )
    );
    this.isHandset = toSignal(
      inject(BreakpointObserver)
        .observe(Breakpoints.Handset)
        .pipe(map((value) => value.matches)),
      {
        initialValue: false,
      }
    );

    effect(() =>
      this.headlineAnimationService.updateAnimation(navState() === 'navEnd')
    );
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
