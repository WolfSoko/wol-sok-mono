import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AkitaNgRouterStoreModule } from '@datorama/akita-ng-router-store';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import { ElemResizedModule } from '@wolsok/ui-kit';
import { WsThanosModule } from '@wolsok/ws-thanos';
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
    ServiceWorkerUpdateComponent,
    MainToolbarComponent,
  ],
  imports: [
    AkitaNgDevtools.forRoot(),
    AkitaNgRouterStoreModule,
    BrowserModule,
    BrowserAnimationsModule,
    CoreModule,
    WsThanosModule.forRoot({
      maxParticleCount: 50000,
      animationLength: 5000,
    }),
    HttpClientModule,
    LoginModule,
    SharedModule,
    AppRoutingModule,
    ElemResizedModule,
  ],

  bootstrap: [AppComponent],
})
export class AppModule {}
