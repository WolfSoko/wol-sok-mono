import { NgModule, Optional, SkipSelf } from '@angular/core';
import { AngularFireModule } from '@angular/fire';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { AngularFirestoreModule } from '@angular/fire/firestore';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ServiceWorkerModule } from '@angular/service-worker';
import { Angulartics2Module } from 'angulartics2';
import { environment } from '../../environments/environment';
import { AuthenticationService } from './authentication.service';
import { IsAuthenticatedGuard } from './guards/is-authenticated-guard.service';
import { HeadlineAnimationService } from './headline-animation.service';
import { RandomService } from './random.service';
import { ServiceWorkerLogUpdateService } from './service-worker-log-update.service';
import { ServiceWorkerUpdateService } from './service-worker-update.service';
import { TitleService } from './title.service';

@NgModule({
  imports: [
    MatSnackBarModule,
    AngularFireModule.initializeApp(environment.firebaseConfig),
    AngularFirestoreModule,
    AngularFireAuthModule,
    Angulartics2Module.forRoot(),
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: environment.production,
    }),
  ],
  providers: [
    TitleService,
    RandomService,
    ServiceWorkerLogUpdateService,
    ServiceWorkerUpdateService,
    AuthenticationService,
    HeadlineAnimationService,
    IsAuthenticatedGuard,
  ],
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error(
        'CoreModule is already loaded. Import it in the AppModule only'
      );
    }
  }
}
