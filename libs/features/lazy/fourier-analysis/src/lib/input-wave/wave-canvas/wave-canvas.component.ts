import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  NgZone,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import P5 from 'p5';
import { InputWave } from '../../model/input-wave.model';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'lazy-feat-fanal-wave-canvas',
  templateUrl: './wave-canvas.component.html',
  styleUrls: ['./wave-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaveCanvasComponent implements OnDestroy {
  canvasContainerRef =
    viewChild.required<ElementRef<HTMLDivElement>>('canvasContainer');

  waveWidth = input.required<number>();
  waveHeight = input.required<number>();
  wave = input.required<InputWave>();
  private zone = inject(NgZone);
  private injector = inject(Injector);

  private sketch: P5 | null = null;
  private wavePartsToDraw = signal(0);

  constructor() {
    effect(
      () => {
        if (this.waveWidth() != null || this.waveHeight() != null) {
          if (this.sketch != null) {
            this.sketch.resizeCanvas(this.waveWidth(), this.waveHeight());
          }
        }
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        // observe wave signal an reset wavePartsToDraw on change
        this.wave();
        this.wavePartsToDraw.set(0);
        this.sketch?.loop();
      },
      { allowSignalWrites: true }
    );
    effect(() => {
      if (this.canvasContainerRef()?.nativeElement && this.sketch == null) {
        this.initCanvas(this.canvasContainerRef().nativeElement);
      }
    });
  }

  private initCanvas(canvasContainer: HTMLDivElement) {
    this.zone.runOutsideAngular(
      () => new P5((p5: P5) => this.initSketch(p5), canvasContainer)
    );
  }

  initSketch(sketch: P5) {
    this.sketch = sketch;

    const leftPadding = 20;
    const bottomPadding = 40;
    const topPadding = 10;

    sketch.setup = () => {
      sketch.createCanvas(this.waveWidth(), this.waveHeight());
    };

    sketch.draw = () => {
      if ((this.wave()?.points?.length ?? 0) === 0) {
        return;
      }
      const w = sketch.width;
      const h = sketch.height;
      const points = this.wave().points;
      const samples = points.length;

      sketch.background(66);
      drawWave.call(this);
      drawXAxis.call(this);
      drawMouseOverInfoLine();

      function drawWave(this: WaveCanvasComponent) {
        sketch.stroke(255, 255, 255);
        sketch.strokeWeight(0.5);
        sketch.noFill();
        sketch.beginShape();
        if (this.wavePartsToDraw() < samples) {
          this.wavePartsToDraw.update((prev) =>
            Math.min(prev + samples / 90, samples)
          );
        }

        for (
          let i = 0;
          i < this.wavePartsToDraw();
          i = i + Math.floor(Math.max(samples / w, 1))
        ) {
          sketch.vertex(
            sketch.map(i, 0, samples, leftPadding, w),
            sketch.map(points[i], -1, 1, h - bottomPadding, topPadding)
          );
        }
        sketch.endShape();
      }

      function drawXAxis(this: WaveCanvasComponent) {
        sketch.line(
          leftPadding,
          h - bottomPadding + 10,
          w,
          h - bottomPadding + 10
        );
        sketch.textAlign('center', 'center');
        sketch.textSize(12);

        const stepWidthMs = this.wave().lengthInMs / 10;
        for (let i = 0; i < 10; i++) {
          const x = sketch.map(i, 0, 10, leftPadding, w);
          const y = h - bottomPadding + 30;
          sketch.text((stepWidthMs * i).toFixed(2) + 'ms', x, y);
          sketch.line(x, h - bottomPadding + 10, x, h - bottomPadding + 5);
        }
      }

      function drawMouseOverInfoLine() {
        const mX = sketch.mouseX;
        const mY = sketch.mouseY;
        if (
          mX > leftPadding &&
          mX < w &&
          mY > topPadding &&
          mY < h - bottomPadding
        ) {
          sketch.push();
          sketch.strokeWeight(1);
          sketch.stroke(123, 31, 162);
          sketch.line(mX, topPadding, mX, h - bottomPadding);
          const index = Math.floor(sketch.map(mX, leftPadding, w, 0, samples));
          const y = sketch.map(
            points[index],
            -1,
            1,
            h - bottomPadding,
            topPadding
          );
          sketch.stroke(105, 240, 174);
          sketch.ellipseMode('center');
          sketch.ellipse(mX, y, 5);
          sketch.textAlign('left', 'center');
          sketch.stroke(255);
          sketch.text(points[index].toFixed(5), mX + 5, y);
          sketch.pop();
        }
      }
    };
  }

  ngOnDestroy(): void {
    if (this.sketch != null) {
      this.sketch.remove();
    }
  }
}
