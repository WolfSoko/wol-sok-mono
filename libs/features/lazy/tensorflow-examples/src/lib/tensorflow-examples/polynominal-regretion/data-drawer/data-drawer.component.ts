import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  viewChild,
  inject,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { Tensor } from '@tensorflow/tfjs';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { Coefficients } from '../polynomial-regression.service';
import { DataDrawerService } from './data-drawer.service';

@Component({
  imports: [CommonModule, MatCardModule, ElevateCardDirective],
  selector: 'feat-lazy-tensor-data-drawer',
  templateUrl: './data-drawer.component.html',
  styleUrls: ['./data-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataDrawerComponent {
  private readonly dataDrawer = inject(DataDrawerService);

  plot = viewChild.required<ElementRef>('plot');
  caption = input.required<string>();
  coeffsCaption = input.required<string[]>();
  data = input.required<{ xs: Tensor; ys: Tensor }>();
  coeffs = input.required<Array<Coefficients | null | undefined>>();
  predictions = input<Tensor | null>();
  predictionsNew = input<Tensor | null>();

  constructor() {
    effect(() => this.draw());
  }

  draw() {
    if (this.data) {
      const predictions = this.predictions();
      if (!predictions) {
        await this.dataDrawer.plotData(this.plot()?.nativeElement, this.data());
      } else {
        await this.dataDrawer.plotDataAndPredictions(
          this.plot()?.nativeElement,
          this.data(),
          predictions,
          this.predictionsNew()
        );
      }
    }
  }
}
