import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  ViewChild,
} from '@angular/core';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { Tensor } from '@tensorflow/tfjs';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { DataDrawerService } from './data-drawer.service';

@Component({
  standalone: true,
  imports: [CommonModule, MatCardModule, ElevateCardDirective],
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

  constructor(
    private readonly dataDrawer: DataDrawerService,
    private readonly ngZone: NgZone
  ) {}

  ngOnChanges() {
    this.draw();
  }

  draw() {
    this.ngZone.runOutsideAngular(async () => {
      if (this.data) {
        if (!this.predictions) {
          await this.dataDrawer.plotData(this.plot.nativeElement, this.data);
        } else {
          await this.dataDrawer.plotDataAndPredictions(
            this.plot.nativeElement,
            this.data,
            this.predictions
          );
        }
      }
    });
    if (this.coeff) {
      this.dataDrawer.renderCoefficients(
        this.coeffContainer.nativeElement,
        this.coeff
      );
    }
  }
}
