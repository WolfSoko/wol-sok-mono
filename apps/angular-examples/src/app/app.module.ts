import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { APP_INITIALIZER, ErrorHandler, NgModule } from '@angular/core';
import { Router } from '@angular/router';
import * as Sentry from '@sentry/angular';
import { provideWsThanosOptions } from '@wolsok/thanos';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { MainToolbarComponent } from './feature/main-toolbar/main-toolbar.component';
import { SideNavComponent } from './feature/navigation/side-nav/side-nav.component';

@NgModule({
  declarations: [AppComponent],
  imports: [CommonModule, AppRoutingModule, HttpClientModule, CoreModule, MainToolbarComponent, SideNavComponent],
  exports: [MainToolbarComponent, SideNavComponent],
  bootstrap: [AppComponent],
  providers: [
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler({
        showDialog: true,
      }),
    },
    {
      provide: Sentry.TraceService,
      deps: [Router],
    },
    {
      provide: APP_INITIALIZER,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      useFactory: () => () => {},
      deps: [Sentry.TraceService],
      multi: true,
    },
    [
      provideWsThanosOptions({
        maxParticleCount: 50000,
        animationLength: 5000,
      }),
    ],
  ],
})
export class AppModule {}
