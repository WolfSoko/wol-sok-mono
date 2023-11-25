import { importProvidersFrom, ModuleWithProviders, NgModule } from '@angular/core';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { Angulartics2Module } from 'angulartics2';

@NgModule({
  imports: [Angulartics2Module],
})
export class AuthModule {
  static forRoot(): ModuleWithProviders<AuthModule> {
    return {
      ngModule: AuthModule,
      providers: [importProvidersFrom(provideAuth(() => getAuth()))],
    };
  }
}
