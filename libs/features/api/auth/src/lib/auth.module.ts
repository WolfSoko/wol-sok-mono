import {
  inject,
  InjectionToken,
  ModuleWithProviders,
  NgModule,
} from '@angular/core';
import {
  FirebaseOptions,
  initializeApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { AngularFireModule } from '@angular/fire/compat';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { Angulartics2Module } from 'angulartics2';

const FIREBASE_CONFIG_TOKEN = new InjectionToken<FirebaseOptions>(
  'firebase.config'
);

@NgModule({
  imports: [
    Angulartics2Module,
    provideFirebaseApp(
      () => initializeApp(inject(FIREBASE_CONFIG_TOKEN)),
      [FIREBASE_CONFIG_TOKEN]
    ),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth()),
  ],
})
export class AuthModule {
  static forRoot(
    firebaseConfig: FirebaseOptions
  ): ModuleWithProviders<AuthModule> {
    return {
      ngModule: AuthModule,
      providers: [
        { provide: FIREBASE_CONFIG_TOKEN, useValue: firebaseConfig },

        AngularFireModule.initializeApp(firebaseConfig).providers ?? [],
      ],
    };
  }
}
