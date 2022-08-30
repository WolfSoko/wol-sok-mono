import { HttpClientModule } from '@angular/common/http';
import { APP_INITIALIZER, ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { AkitaNgRouterStoreModule } from '@datorama/akita-ng-router-store';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import * as Sentry from '@sentry/angular';
import { ElemResizedDirective } from '@wolsok/ui-kit';
import { provideWsThanosOptions, WsThanosDirective } from '@wolsok/ws-thanos';
import { AppRoutingModule } from './app-routing.module';

import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { AboutComponent } from './info/about/about.component';
import { InfoComponent } from './info/info.component';
import { TechnologyComponent } from './info/technology/technology.component';
import { LoginModule } from './login/login.module';
import { MainToolbarComponent } from './main-toolbar/main-toolbar.component';
import { NavItemComponent } from './nav-item/nav-item.component';
import { ServiceWorkerUpdateComponent } from './service-worker-update/service-worker-update.component';
import { SharedModule } from './shared/shared.module';

@NgModule({
  declarations: [
    AppComponent,
    InfoComponent,
    TechnologyComponent,
    NavItemComponent,
    AboutComponent,
    MainToolbarComponent,
  ],
  imports: [
    ServiceWorkerUpdateComponent,
    AkitaNgDevtools.forRoot(),
    AkitaNgRouterStoreModule,
    BrowserModule,
    BrowserAnimationsModule,
    CoreModule,
    HttpClientModule,
    LoginModule,
    SharedModule,
    AppRoutingModule,
    WsThanosDirective,
    ElemResizedDirective,
  ],
  providers: [
    provideWsThanosOptions({
      maxParticleCount: 50000,
      animationLength: 5000,
    }),
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
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
