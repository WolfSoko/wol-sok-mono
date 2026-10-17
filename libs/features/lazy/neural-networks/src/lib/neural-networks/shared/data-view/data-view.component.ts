import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChange,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import p5 from 'p5';
import { BrainService } from '../brain.service';
import { Perceptron } from '../perceptron';
import { Point } from '../point';
import { DataP5Sketch, heatmapColor } from './data-p5-sketch';

interface ChangeInputs extends SimpleChanges {
  points: SimpleChange;
  perceptron: SimpleChange;
}

@Component({
  selector: 'feat-lazy-neural-networks-data-view',
  templateUrl: './data-view.component.html',
  styleUrls: ['./data-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataViewComponent implements AfterViewInit, OnChanges, OnDestroy {
  private brainService = inject(BrainService);

  @ViewChild('dataCanvas', { static: true }) dataCanvas!: ElementRef;
  @ViewChild('legendCanvas', { static: true }) legendCanvas!: ElementRef;

  @Input() perceptron!: Perceptron;
  @Input() points!: Point[];
  @Input() canvasWidth = 400;
  @Input() canvasHeight = 400;
  @Input() showLinearDivider = true;
  @Output() dataViewClicked: EventEmitter<{
    x: number;
    y: number;
    click: 'left' | 'right';
  }> = new EventEmitter();

  private dataScetch?: DataP5Sketch;
  private legendScetch?: p5;
  private dataP5?: p5;

  ngOnChanges(changes: ChangeInputs): void {
    if (this.dataScetch) {
      if (
        changes.points &&
        !changes.points.firstChange &&
        changes.points.previousValue !== changes.points.currentValue
      ) {
        this.dataScetch.points = changes.points.currentValue;
      }
      if (
        changes.perceptron &&
        !changes.perceptron.firstChange &&
        changes.perceptron.previousValue !== changes.perceptron.currentValue
      ) {
        this.dataScetch.perceptron = changes.perceptron.currentValue;
      }
    }
  }

  ngAfterViewInit(): void {
    this.initDataScetch();
    this.initLegendScetch();
  }

  ngOnDestroy(): void {
    this.dataP5?.remove();
    this.legendScetch?.remove();
  }

  private initDataScetch() {
    this.dataP5 = new p5((p) => {
      this.dataScetch = new DataP5Sketch(
        p,
        this.canvasWidth,
        this.canvasHeight,
        this.brainService,
        (x, y, click) => {
          this.dataViewClicked.emit({ x, y, click });
        },
        this.showLinearDivider
      );
      this.dataScetch.points = this.points;
      this.dataScetch.perceptron = this.perceptron;
    }, this.dataCanvas.nativeElement);
  }

  private initLegendScetch() {
    this.legendScetch = new p5((p) => {
      p.setup = () => {
        p.createCanvas(110, this.canvasHeight);
        p.background(255);
        if (this.showLinearDivider) {
          drawLinearDividerLegend(p);
        } else {
          drawHeatmapLegend(p);
        }

        p.fill(255, 0, 0);
        p.noStroke();
        p.ellipse(15, 150, 5, 5);
        p.fill(0);
        p.text('Learned wrong', 10, 142);

        p.fill(0, 255, 0);
        p.noStroke();
        p.ellipse(15, 200, 5, 5);
        p.fill(0);
        p.text('Learned correct', 10, 192);

        p.fill(255, 255, 0);
        p.stroke(0);
        p.ellipse(15, 250, 8, 8);
        p.fill(0);
        p.noStroke();
        p.text('Class 1', 10, 242);

        p.fill(0, 0, 255);
        p.stroke(0);
        p.ellipse(15, 300, 8, 8);
        p.fill(0);
        p.noStroke();
        p.text('Class 2', 10, 292);
      };
    }, this.legendCanvas.nativeElement);
  }
}

function drawLinearDividerLegend(p: p5): void {
  p.fill(0);
  p.stroke(0);
  p.line(10, 50, 60, 50);
  p.noStroke();
  p.text('Class separation', 10, 42);

  p.stroke(255, 200, 200);
  p.strokeWeight(2);
  p.line(10, 100, 60, 100);
  p.noStroke();
  p.text('Perceptron separation', 10, 68, 20, 80);
}

function drawHeatmapLegend(p: p5): void {
  p.fill(0);
  p.noStroke();
  p.text('Network output', 10, 22);
  for (let x = 0; x <= 90; x++) {
    p.stroke(heatmapColor(x / 90));
    p.line(10 + x, 30, 10 + x, 45);
  }
  p.noStroke();
  p.fill(0);
  p.text('0', 10, 58);
  p.text('0.5', 48, 58);
  p.text('1', 95, 58);

  p.stroke(40);
  p.strokeWeight(2);
  p.line(10, 112, 60, 112);
  p.strokeWeight(1);
  p.noStroke();
  p.text('Learned border (output 0.5)', 10, 72, 100, 30);
}
