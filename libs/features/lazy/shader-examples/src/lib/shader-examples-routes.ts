import { importProvidersFrom } from '@angular/core';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { Routes } from '@angular/router';
import { AuthModule } from '@wolsok/feat-api-auth';
import { ShaderExamplesComponent } from './shader-examples.component';

export const shaderExamplesRoutes: Routes = [
  {
    path: '',
    component: ShaderExamplesComponent,
    providers: [importProvidersFrom(provideFirestore(() => getFirestore())), importProvidersFrom(AuthModule)],
  },
];
