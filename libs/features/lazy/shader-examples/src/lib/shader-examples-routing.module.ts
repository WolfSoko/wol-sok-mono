import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { canActivateWithLoginIfNotAuthenticated, canMatchWithLoginIfNotAuthenticated } from '@wolsok/feat-api-auth';
import { ShaderExamplesComponent } from './shader-examples.component';

const shaderExamplesRoutingModule: Routes = [
  {
    path: '',
    component: ShaderExamplesComponent,
    canActivate: [canActivateWithLoginIfNotAuthenticated],
  },
];

@NgModule({
  imports: [RouterModule.forChild(shaderExamplesRoutingModule)],
  exports: [RouterModule],
})
export class ShaderExamplesRoutingModule {}
