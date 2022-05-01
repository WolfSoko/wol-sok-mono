import { ModuleWithProviders, NgModule } from '@angular/core';
import { AngularFireModule } from '@angular/fire';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { FirebaseOptions } from '@angular/fire/firebase.app.module';
import { AngularFirestoreModule } from '@angular/fire/firestore';
import { Angulartics2Module } from 'angulartics2';

@NgModule({
  imports: [
    Angulartics2Module,
    AngularFireModule,
    AngularFirestoreModule,
    AngularFireAuthModule,
  ],
})
export class AuthModule {
  static forRoot(
    firebaseConfig: FirebaseOptions
  ): ModuleWithProviders<AuthModule> {
    return {
      ngModule: AuthModule,
      providers: [
        AngularFireModule.initializeApp(firebaseConfig).providers ?? [],
      ],
    };
  }
}
