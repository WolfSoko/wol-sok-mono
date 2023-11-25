import { CommonModule } from '@angular/common';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { Circle } from '../../domain/model/circle';
import { CanvasDrawService } from './canvas-draw.service';
import { animationFrameScheduler, interval, Observable } from 'rxjs';
import { Vector } from '../../domain/model/vector';
import { Line } from '../../domain/model/line';
import { skipUntil } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-canvas-view',
  templateUrl: './canvas-view.component.html',
  styleUrls: ['./canvas-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasViewComponent implements AfterContentInit {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef;
  @Input() canvasWidth = 50;
  @Input() canvasHeight = 50;
  @Input() circles: Circle[] | null = null;
  @Input() actives: Vector[] | null = null;
  @Input() lines: Line[] | null = null;
  @Output() addObject = new EventEmitter<Vector>();
  @Output() readyToPaint = new EventEmitter<number>();

  private draw$: Observable<number>;

  constructor(private canvasDrawService: CanvasDrawService) {
    this.draw$ = interval(0, animationFrameScheduler).pipe(
      skipUntil(this.readyToPaint)
    );
  }

  ngAfterContentInit(): void {
    this.canvas.nativeElement.width = this.canvasWidth;
    this.canvas.nativeElement.height = this.canvasHeight;
    const context: CanvasRenderingContext2D =
      this.canvas.nativeElement.getContext('2d', { willReadFrequently: true });
    this.canvasDrawService.initCtx(context);
    setTimeout(() => this.readyToPaint.emit(0), 1000);
    this.draw$.pipe(untilDestroyed(this)).subscribe(this.draw.bind(this));
  }

  public onClick($event: MouseEvent): void {
    this.addObject.emit(new Vector($event.offsetX, $event.offsetY));
  }

  private isInsideDrawArea(circle: Circle): boolean {
    return (
      circle.pos.x <= this.canvasWidth &&
      circle.pos.y <= this.canvasHeight &&
      circle.pos.x >= 0 &&
      circle.pos.y >= 0
    );
  }

  private draw(step: number): void {
    this.canvasDrawService.setFillColor('black');
    this.canvasDrawService.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    if (this.circles) {
      const filteredCircles = this.circles.filter(
        this.isInsideDrawArea.bind(this)
      );
      if (filteredCircles.length < this.circles.length) {
        console.error(
          'Some circles are out of draw area.',
          this.circles.filter((circle) => !this.isInsideDrawArea(circle))
        );
      }
      this.circles.forEach((circle) =>
        this.canvasDrawService.drawCircle(circle, step)
      );
    }
    if (this.actives) {
      this.canvasDrawService.setFillColor('red');
      this.actives.forEach((active) =>
        this.canvasDrawService.drawVec(active, 2)
      );
    }
    if (this.lines) {
      this.canvasDrawService.setStrokeColor('white');
      this.lines.forEach((line) => this.canvasDrawService.drawLineObj(line));
    }
    this.readyToPaint.emit(step);
  }
}
