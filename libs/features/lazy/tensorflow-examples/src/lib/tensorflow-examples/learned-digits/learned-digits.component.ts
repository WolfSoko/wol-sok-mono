import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Tensor2D } from '@tensorflow/tfjs';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { Subject } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';
import { AskForNumberDialogData } from './ask-for-number-dialog/ask-for-number-dialog-data';
import { AskForNumberDialogComponent } from './ask-for-number-dialog/ask-for-number-dialog.component';
import { DrawDigitComponent } from './draw-digit/draw-digit.component';
import { DrawPredictionsComponent } from './draw-predictions/draw-predictions.component';
import { LearnedDigitsModelService } from './learned-digits-model.service';
import { MnistDataService } from './mnist-data.service';
import { HeadlineAnimationService } from '@wolsok/headline-animation';

@UntilDestroy()
@Component({
  imports: [
    CommonModule,
    MatCardModule,
    MatDialogModule,
    ElevateCardDirective,
    MatButtonModule,
    DrawDigitComponent,
    DrawPredictionsComponent,
    MatProgressSpinnerModule,
  ],
  templateUrl: './learned-digits.component.html',
  styleUrls: ['./learned-digits.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearnedDigitsComponent implements OnInit {
  isLoading = signal(true);
  hasBeenTrained = signal(false);
  errorLoadingData = signal(false);
  accuracyValues = signal<
    { batch: number; accuracy: number; set: string }[] | null
  >(null);
  lossValues = signal<{ batch: number; loss: number; set: string }[] | null>(
    null
  );
  predictions = signal<number[] | null>(null);
  batch = signal<{ xs: Tensor2D; labels: Tensor2D } | null>(null);
  labels = signal<number[] | null>(null);

  drawingPredictions = signal<number[] | null>(null);
  drawingBatch = signal<{ xs: Tensor2D; labels: number[] } | null>(null);
  drawingLabels = signal<number[]>([]);
  private nextDrawnImageSubject$ = new Subject<Float32Array>();
  private readonly headlineAnimationService = inject(HeadlineAnimationService);
  private data = inject(MnistDataService);
  private deepNet = inject(LearnedDigitsModelService);
  private dialog = inject(MatDialog);
  isTraining = this.deepNet.isTraining.asReadonly();

  ngOnInit(): void {
    setTimeout(async () => {
      try {
        await this.data.load();
      } catch (error) {
        console.error('error loading mnist data', error);
        this.errorLoadingData.set(true);
      } finally {
        this.isLoading.set(false);
      }
    }, 1500);

    this.nextDrawnImageSubject$
      .asObservable()
      .pipe(
        debounceTime(1000),
        tap((image) => this.testDrawnDigit(image)),
        untilDestroyed(this)
      )
      .subscribe();
  }

  async train() {
    this.headlineAnimationService.stopAnimation();
    await this.deepNet.train();
    this.accuracyValues.set(
      this.deepNet.accuracyValues || [{ batch: 0, accuracy: 0.0, set: 'train' }]
    );
    this.lossValues.set(
      this.deepNet.lossValues || [{ batch: 0, loss: 1.0, set: 'train' }]
    );
    this.hasBeenTrained.set(true);
    this.predict();
    this.headlineAnimationService.startAnimation();
  }

  predict() {
    this.deepNet.predict();
    this.predictions.set(this.deepNet.predictions);
    this.batch.set(this.deepNet.testBatch);
    this.labels.set(this.deepNet.labels);
  }

  nextDrawnImage($event: Float32Array) {
    this.nextDrawnImageSubject$.next($event);
  }

  private testDrawnDigit($event: Float32Array) {
    this.deepNet.predictDrawing($event);
    this.drawingPredictions.set(this.deepNet.customPredictions);

    const xs = this.deepNet.testCustomBatch;
    this.drawingLabels.update((labels) => [-1, ...labels]);
    this.askForLabel(0);
    this.drawingBatch.set({ xs: xs, labels: this.drawingPredictions() ?? [] });
  }

  askForLabel(index: number) {
    const label = this.drawingLabels()[index];
    const numberDrawn = label === -1 ? null : label;
    const drawingPrediction = this.drawingPredictions()?.[index] ?? -1;
    const dialogData: AskForNumberDialogData = {
      drawn: numberDrawn,
      prediction: drawingPrediction,
    };
    const dialogRef: MatDialogRef<
      AskForNumberDialogComponent,
      AskForNumberDialogData
    > = this.dialog.open(AskForNumberDialogComponent, {
      width: '250px',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result) => {
      this.drawingLabels.update((labels) => {
        labels[index] = result?.drawn ?? -1;
        return [...labels];
      });
    });
  }
}
