import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
