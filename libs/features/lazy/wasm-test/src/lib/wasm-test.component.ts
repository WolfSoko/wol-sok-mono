import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Observable, Subscription } from 'rxjs';
import { WasmTestQuery } from './state/wasm-test.query';
import { WasmTestService } from './state/wasm-test.service';
import { FibResult, WasmTestState } from './state/wasm-test.store';

@Component({
  imports: [
    CommonModule,
    MatToolbarModule,
    MatCardModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  selector: 'lazy-feat-wasm-test',
  templateUrl: './wasm-test.component.html',
  styleUrls: ['./wasm-test.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WasmTestComponent implements OnInit, OnDestroy {
  readonly fibRunning$: Observable<boolean>;
  readonly fibResult$: Observable<FibResult | null>;
  readonly fibN$: Observable<number>;
  readonly isLoading$: Observable<boolean>;
  readonly vm$: Observable<WasmTestState>;
  readonly fibError$: Observable<never>;
  private subscription?: Subscription;
  readonly fibOptionsForm: FormGroup<{
    fibN: FormControl<number | null>;
  }>;

  constructor(
    private wasmTestQuery: WasmTestQuery,
    private wasmTestService: WasmTestService,
    private builder: FormBuilder
  ) {
    this.fibRunning$ = this.wasmTestQuery.selectFibRunning();
    this.fibN$ = this.wasmTestQuery.selectFibN();
    this.fibResult$ = this.wasmTestQuery.selectFibResult();
    this.isLoading$ = this.wasmTestQuery.selectLoading();
    this.fibError$ = this.wasmTestQuery.selectError();
    this.vm$ = this.wasmTestQuery.select();

    this.fibOptionsForm = this.builder.group({
      fibN: this.builder.control(
        this.wasmTestQuery.getValue().fibOptions.fibN,
        [Validators.min(0), Validators.max(45), Validators.required]
      ),
    });
  }

  ngOnInit() {
    this.subscription = this.fibRunning$.subscribe((fibRunning) =>
      fibRunning
        ? this.fibOptionsForm.controls.fibN.disable()
        : this.fibOptionsForm.controls.fibN.enable()
    );
  }

  calcFib() {
    this.wasmTestService.startFibCalc();
  }

  calcFibMem() {
    this.wasmTestService.startFibMemCalc();
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
