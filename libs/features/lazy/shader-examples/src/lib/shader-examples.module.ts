import { NgModule } from '@angular/core';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { AuthModule } from '@wolsok/feat-api-auth';
import { ShaderExamplesRoutingModule } from './shader-examples-routing.module';

@NgModule({
  imports: [ShaderExamplesRoutingModule, provideFirestore(() => getFirestore()), AuthModule],
})
export class ShaderExamplesModule {}
