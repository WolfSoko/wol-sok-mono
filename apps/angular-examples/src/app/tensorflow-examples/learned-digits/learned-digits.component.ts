import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Tensor2D } from '@tensorflow/tfjs';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { HeadlineAnimationService } from '../../core/headline-animation.service';
import { AskForNumberDialogComponent } from './ask-for-number-dialog/ask-for-number-dialog';
import { AskForNumberDialogData } from './ask-for-number-dialog/ask-for-number-dialog-data';
import { LearnedDigitsModelService } from './learned-digits-model.service';
import { MnistDataService } from './mnist-data.service';

@UntilDestroy()
@Component({
  selector: 'app-learned-digits',
  templateUrl: './learned-digits.component.html',
  styleUrls: ['./learned-digits.component.less']
})
export class LearnedDigitsComponent implements OnInit {
  isLoading!: boolean;
  hasBeenTrained = false;
  errorLoadingData = false;
  accuracyValues!: { batch: number; accuracy: number; set: string }[];
  lossValues!: { batch: number; loss: number; set: string }[];
  predictions!: number[];
  batch!: { xs: Tensor2D; labels: Tensor2D };
  labels!: number[];

  drawingPredictions!: number[]
  drawingBatch!: { xs: Tensor2D; labels: number[] };
  drawingLabels: number[] = [];
  private nextDrawnImageSubject$ = new Subject<Float32Array>();

  constructor(private data: MnistDataService, private deepNet: LearnedDigitsModelService,
              public headlineAnimation: HeadlineAnimationService,
              private dialog: MatDialog) {
    this.headlineAnimation.stopAnimation();
  }

  ngOnInit(): void {
    setTimeout(async () => {
      try {
        this.isLoading = true;
        await this.data.load();
      } catch (error) {
        console.error('error loading mnist data', error);
        this.errorLoadingData = true;
      } finally {
        this.isLoading = false;
      }
    }, 200);

    this.nextDrawnImageSubject$.asObservable()
      .pipe(
        debounceTime(1000),
        untilDestroyed(this)
      )
      .subscribe(image => this.testDrawnDigit(image));
  }

  async train() {
    await this.deepNet.train();
    this.accuracyValues = this.deepNet.accuracyValues || [{'batch': 0, 'accuracy': 0.0, 'set': 'train'}];
    this.lossValues = this.deepNet.lossValues || [{'batch': 0, 'loss': 1.0, 'set': 'train'}];
    this.hasBeenTrained = true;
  }

  predict() {
    this.deepNet.predict();
    this.predictions = this.deepNet.predictions;
    this.batch = this.deepNet.testBatch;
    this.labels = this.deepNet.labels;
  }

  get isTraining() {
    return this.deepNet.isTraining;
  }

  nextDrawnImage($event: Float32Array) {
    this.nextDrawnImageSubject$.next($event);
  }

  private testDrawnDigit($event: Float32Array) {
    this.deepNet.predictDrawing($event);
    this.drawingPredictions = this.deepNet.customPredictions;

    const xs = this.deepNet.testCustomBatch;
    this.drawingLabels = [-1, ...this.drawingLabels];
    this.askForLabel(0);
    this.drawingBatch = {xs: xs, labels: this.drawingPredictions};
  }

  askForLabel(index: number) {
    const label = this.drawingLabels[index];
    const numberDrawn = label === -1 ? null : label;
    const drawingPrediction = this.drawingPredictions[index];
    const dialogData: AskForNumberDialogData = {drawn: numberDrawn, prediction: drawingPrediction};
    const dialogRef: MatDialogRef<AskForNumberDialogComponent, AskForNumberDialogData> = this.dialog.open(AskForNumberDialogComponent, {
      width: '250px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      this.drawingLabels[index] = result?.drawn ?? -1;
      this.drawingLabels = [...this.drawingLabels];
    });
  }
}
