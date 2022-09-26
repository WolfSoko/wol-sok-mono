import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Tensor1D, Tensor2D } from '@tensorflow/tfjs';
import embed from 'vega-embed';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'feat-lazy-tensor-draw-predictions',
  templateUrl: './draw-predictions.component.html',
  styleUrls: ['./draw-predictions.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawPredictionsComponent implements OnChanges {
  @ViewChild('lossCanvas', { static: true }) lossCanvas!: ElementRef;
  @ViewChild('accuracyCanvas', { static: true }) accuracyCanvas!: ElementRef;
  @ViewChild('images', { static: true }) images!: ElementRef;

  lossLabel!: string;
  accuracyLabel!: string;

  @Input() batch!: { xs: Tensor2D };
  @Input() predictions!: number[];
  @Input() labels!: number[];
  @Input() lossValues!: { batch: number; loss: number; set: string }[];
  @Input() accuracyValues!: { batch: number; accuracy: number; set: string }[];

  @Output() imageClicked: EventEmitter<number> = new EventEmitter<number>();

  totalCorrect!: number;
  totalPredictions!: number;

  private static draw(image: Tensor1D, canvas: HTMLCanvasElement): void {
    const [width, height] = [28, 28];
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get context');
    }
    const imageData = new ImageData(width, height);
    const data = image.dataSync();
    for (let i = 0; i < height * width; ++i) {
      const j = i * 4;
      imageData.data[j] = data[i] * 255;
      imageData.data[j + 1] = data[i] * 255;
      imageData.data[j + 2] = data[i] * 255;
      imageData.data[j + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['batch'] && changes['batch'].currentValue) {
      this.showTestResults(this.batch.xs, this.predictions, this.labels);
    }
    if (changes['accuracyValues'] && changes['accuracyValues'].currentValue) {
      void this.plotAccuracies(this.accuracyValues);
    }
    if (changes['lossValues'] && changes['lossValues'].currentValue) {
      this.plotLosses(this.lossValues);
    }
    if (changes['labels'] && changes['labels'].currentValue) {
      if (this.batch == null) {
        return;
      }
      this.showTestResults(this.batch.xs, this.predictions, this.labels);
    }
  }

  showTestResults(xs: Tensor2D, predictions: number[], labels: number[]): void {
    const testExamples = xs.shape[0];
    this.totalPredictions = testExamples;
    this.totalCorrect = 0;
    (this.images.nativeElement as HTMLDivElement).innerHTML = '';

    for (let i = 0; i < testExamples; i++) {
      const image = xs.slice([i, 0], [1, xs.shape[1]]);

      const div = document.createElement('div');
      div.className = 'pred-container';

      const canvas = document.createElement('canvas');
      DrawPredictionsComponent.draw(image.flatten(), canvas);

      const pred = document.createElement('div');

      const prediction = predictions[i];
      const label = labels[i];
      const correct = prediction === label;
      this.totalCorrect += correct ? 1 : 0;

      pred.className = `pred ${correct ? 'pred-correct' : 'pred-incorrect'}`;
      pred.innerText = `pred: ${prediction}`;

      div.appendChild(pred);
      div.appendChild(canvas);
      div.addEventListener('click', (event) => {
        event.stopPropagation();
        event.stopImmediatePropagation();
        this.imageClick(i);
      });

      this.images.nativeElement.appendChild(div);
    }
  }

  async plotLosses(lossValues: string | any[]): Promise<void> {
    await embed(
      this.lossCanvas.nativeElement,
      {
        data: { values: lossValues },
        mark: {
          type: 'line',
          orient: 'vertical',
        },
        width: 260,
        encoding: {
          x: { field: 'batch', type: 'quantitative' },
          y: { field: 'loss', type: 'quantitative' },
          color: { field: 'set', type: 'nominal', legend: null },
        },
      },
      { width: 360 }
    );
    this.lossLabel =
      'last loss: ' + lossValues[lossValues.length - 1].loss.toFixed(2);
  }

  async plotAccuracies(
    accuracyValues: { batch: number; accuracy: number; set: string }[]
  ): Promise<void> {
    await embed(
      this.accuracyCanvas.nativeElement,
      {
        data: { values: accuracyValues },
        width: 260,
        mark: { type: 'line', orient: 'vertical' },
        encoding: {
          x: { field: 'batch', type: 'quantitative' },
          y: { field: 'accuracy', type: 'quantitative' },
          color: { field: 'set', type: 'nominal' },
        },
      },
      { width: 360 }
    );
    this.accuracyLabel = `last accuracy: ${(
      accuracyValues[accuracyValues.length - 1].accuracy * 100
    ).toFixed(2)}%`;
  }

  private imageClick(index: number) {
    this.imageClicked.emit(index);
    return false;
  }
}
