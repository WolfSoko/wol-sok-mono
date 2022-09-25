import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  ViewChild,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { Tensor } from '@tensorflow/tfjs';
import { DataDrawerService } from './data-drawer.service';

@Component({
  standalone: true,
  imports: [CommonModule, MatCardModule],
  selector: 'feat-lazy-tensor-data-drawer',
  templateUrl: './data-drawer.component.html',
  styleUrls: ['./data-drawer.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataDrawerComponent implements OnChanges {
  @ViewChild('plot', { static: true }) plot!: ElementRef;
  @ViewChild('coeff', { static: true }) coeffContainer!: ElementRef;

  @Input() caption!: string;
  @Input() coeffCaption!: string;
  @Input() data!: { xs: Tensor; ys: Tensor };
  @Input() coeff!: { a: number; b: number; c: number; d: number };
  @Input() predictions?: Tensor;

  constructor(private dataDrawer: DataDrawerService) {}

  ngOnChanges() {
    this.draw();
  }

  draw() {
    if (this.data) {
      if (!this.predictions) {
        this.dataDrawer.plotData(this.plot.nativeElement, this.data);
      } else {
        this.dataDrawer.plotDataAndPredictions(
          this.plot.nativeElement,
          this.data,
          this.predictions
        );
      }
    }
    if (this.coeff) {
      this.dataDrawer.renderCoefficients(
        this.coeffContainer.nativeElement,
        this.coeff
      );
    }
  }
}
