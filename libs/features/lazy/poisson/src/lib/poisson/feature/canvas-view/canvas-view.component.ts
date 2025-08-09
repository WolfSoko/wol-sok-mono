import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Circle } from '../../domain/model/circle';
import { CanvasDrawService } from './canvas-draw.service';
import {
  animationFrameScheduler,
  interval,
  Observable,
  Subscription,
} from 'rxjs';
import { Vector } from '../../domain/model/vector';
import { Line } from '../../domain/model/line';
import { skipUntil } from 'rxjs/operators';

@Component({
  imports: [],
  selector: 'lazy-feat-poisson-app-canvas-view',
  templateUrl: './canvas-view.component.html',
  styleUrls: ['./canvas-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasViewComponent implements AfterContentInit {
  private canvasDrawService = inject(CanvasDrawService);
  private destroyRef = inject(DestroyRef);

  @ViewChild('canvas', { static: true }) canvas!: ElementRef;
  @Input() canvasWidth = 50;
  @Input() canvasHeight = 50;
  @Input() circles: Circle[] | null = null;
  @Input() actives: Vector[] | null = null;
  @Input() lines: Line[] | null = null;
  @Output() addObject = new EventEmitter<Vector>();
  @Output() readyToPaint = new EventEmitter<number>();

  private draw$?: Observable<number>;
  private subs?: Subscription;

  ngAfterContentInit(): void {
    this.reset();
  }

  public reset() {
    if (this.subs) {
      this.subs.unsubscribe();
    }
    this.draw$ = interval(0, animationFrameScheduler).pipe(
      skipUntil(this.readyToPaint),
      takeUntilDestroyed(this.destroyRef)
    );

    this.canvas.nativeElement.width = this.canvasWidth;
    this.canvas.nativeElement.height = this.canvasHeight;
    const context: CanvasRenderingContext2D =
      this.canvas.nativeElement.getContext('2d', { willReadFrequently: true });

    this.canvasDrawService.initCtx(context);

    this.canvasDrawService.useOffscreen();
    this.canvasDrawService.setFillColor('black');
    this.canvasDrawService.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.canvasDrawService.useMain();

    setTimeout(() => this.readyToPaint.emit(0), 1000);
    this.subs = this.draw$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((step) => this.draw(step));
  }

  public onClick($event: MouseEvent): void {
    this.addObject.emit(new Vector($event.offsetX, $event.offsetY));
  }

  private draw(step: number): void {
    this.canvasDrawService.setFillColor('black');
    this.canvasDrawService.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    if (this.circles) {
      this.canvasDrawService.useOffscreen();
      for (const circle of this.circles) {
        if (circle.drawn) {
          continue;
        }
        this.canvasDrawService.drawCircle(circle);
        circle.drawn = true;
      }
      this.canvasDrawService.useMain();
    }
    this.canvasDrawService.mergeOffscreenCanvas();

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
