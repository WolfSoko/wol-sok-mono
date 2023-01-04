import { NgModule, Optional, SkipSelf } from '@angular/core';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';
import { AkitaNgRouterStoreModule } from '@datorama/akita-ng-router-store';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import { AuthModule } from '@wolsok/feat-api-auth';
import { Angulartics2Module } from 'angulartics2';
import { environment } from '../../environments/environment';

@NgModule({
  imports: [
    BrowserAnimationsModule,
    AkitaNgDevtools.forRoot(),
    AkitaNgRouterStoreModule,
    MatSnackBarModule,
    Angulartics2Module.forRoot(),
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: environment.production,
    }),
    AuthModule.forRoot(environment.firebaseConfig),
  ],
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error('CoreModule is already loaded. Import it in the AppModule only');
    }
  }
}
