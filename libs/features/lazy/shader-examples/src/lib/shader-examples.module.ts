import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthModule } from '@wolsok/feat-api-auth';
import { RenderShaderComponent } from '@wolsok/ui-kit';
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
    AceEditorModule,
    MatPaginatorModule,
    provideFirestore(() => getFirestore()),
    MatButtonModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatCardModule,
    AuthModule,
    RenderShaderComponent,
  ],
  declarations: [
    ShaderExamplesComponent,
    ShaderExamplesOptionsComponent,
    CodeEditorComponent,
  ],
})
export class ShaderExamplesModule {}
