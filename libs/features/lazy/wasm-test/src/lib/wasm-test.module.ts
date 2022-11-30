import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { WasmTestRoutingModule } from './wasm-test-routing.module';
import { WasmTestComponent } from './wasm-test.component';

@NgModule({
  imports: [
    WasmTestRoutingModule,
    CommonModule,
    MatToolbarModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  declarations: [WasmTestComponent],
})
export class WasmTestModule {}
