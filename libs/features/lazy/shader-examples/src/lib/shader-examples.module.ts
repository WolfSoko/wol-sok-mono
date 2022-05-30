import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AngularFireStorageModule } from '@angular/fire/compat/storage';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthModule } from '@wolsok/feat-api-auth';
import { RenderShaderModule } from '@wolsok/ui-kit';
import { AceEditorModule } from 'ngx-ace-editor-wrapper';
import { CodeEditorComponent } from './code-editor/code-editor.component';
import { ShaderExamplesOptionsComponent } from './shader-examples-options/shader-examples-options.component';
import { ShaderExamplesRoutingModule } from './shader-examples-routing.module';
import { ShaderExamplesComponent } from './shader-examples.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ShaderExamplesRoutingModule,
    RenderShaderModule,
    AceEditorModule,
    MatPaginatorModule,
    provideFirestore(() => getFirestore()),
    MatButtonModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatCardModule,
    AuthModule,
  ],
  declarations: [
    ShaderExamplesComponent,
    ShaderExamplesOptionsComponent,
    CodeEditorComponent,
  ],
})
export class ShaderExamplesModule {}
