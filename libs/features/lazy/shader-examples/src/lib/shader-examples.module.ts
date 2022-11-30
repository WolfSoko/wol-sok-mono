import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyPaginatorModule as MatPaginatorModule } from '@angular/material/legacy-paginator';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
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
