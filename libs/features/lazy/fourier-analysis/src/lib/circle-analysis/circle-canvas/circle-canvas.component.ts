import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as math from 'mathjs';
import P5, { Graphics } from 'p5';
import { InputWave } from '../../model/input-wave.model';
import {
  CIRCLE_CANVAS_PADDING,
  CircleCanvasLayout,
  circleCanvasLayout,
} from './circle-canvas.layout';

const NEG_TWO_PI = -2 * Math.PI;
const CIRCLE_DRAW_SAMPLES = 800;
const MIN_AXIS_LABEL_WIDTH = 70;

interface CenterData {
  real: number;
  imag: number;
}

/** A point of the frequency graph the pointer is currently over. */
interface GraphPoint {
  index: number;
  frequency: number;
}

@Component({
  imports: [],
  selector: 'lazy-feat-fanal-circle-canvas',
  templateUrl: './circle-canvas.component.html',
  styleUrls: ['./circle-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CircleCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true })
  canvasContainerRef!: ElementRef;
  private canvasContainer!: HTMLElement;

  waveWidth = input.required<number>();
  waveHeight = input.required<number>();
  wave = input.required<InputWave>();

  private sketch: P5 | null = null;
  /**
   * Offscreen buffer the wrapped wave circle is drawn into. Kept on the
   * component (not inside `initSketch`) so re-initialising the sketch for a new
   * wave does not orphan the previous buffer.
   */
  private fourierCircleImg: Graphics | null = null;
  private frequencyToTest = 20;
  private centersOfFrequencies: { [key: number]: CenterData } = {};
  private centers: number[] = [];
  private centerMin = 0;
  private centerMax = 0;
  private finished = false;

  ngAfterViewInit(): void {
    this.canvasContainer = this.canvasContainerRef.nativeElement;
    setTimeout(() => this.initCanvas(), 500);
  }

  constructor() {
    effect(() => {
      if (this.waveWidth() != null || this.waveHeight() != null) {
        if (this.sketch != null) {
          this.sketch.resizeCanvas(this.waveWidth(), this.waveHeight());
          this.sketch.redraw();
        }
      }
    });
    effect(() => {
      if (this.wave() !== null) {
        this.centersOfFrequencies = {};
        this.centers = [];
        this.frequencyToTest = 20;
        this.centerMin = 0;
        this.centerMax = 0;
        this.finished = false;
        if (this.sketch != null) {
          this.initSketch(this.sketch);
          this.sketch.loop();
        }
      }
    });
  }

  private initCanvas() {
    new P5(this.initSketch.bind(this), this.canvasContainer);
  }

  initSketch(sketch: P5) {
    this.sketch = sketch;
    // A previous run (wave change) may have left a buffer behind.
    this.fourierCircleImg?.remove();
    this.fourierCircleImg = null;

    const padding = CIRCLE_CANVAS_PADDING;
    const minFrequencyToTest = 20;
    const maxFrequencyToTest = 500;
    const frequencyStepWidth = 1;
    const frequencySteps =
      (maxFrequencyToTest - minFrequencyToTest) * frequencyStepWidth;
    let calcNextGenerator: Generator<undefined> | null = null;
    const samplesToTake = 3000;

    let layout: CircleCanvasLayout = circleCanvasLayout(
      this.waveWidth(),
      this.waveHeight()
    );

    sketch.setup = () => {
      sketch.createCanvas(this.waveWidth(), this.waveHeight());
    };

    sketch.draw = () => {
      if (
        this.wave() == null ||
        this.wave().points == null ||
        this.wave().points.length === 0
      ) {
        return;
      }
      const previousCircleSize = layout.circleSize;
      layout = circleCanvasLayout(sketch.width, sketch.height);

      sketch.background(66);
      sketch.stroke(255, 255, 255);
      sketch.strokeWeight(0.5);
      sketch.noFill();

      if (
        previousCircleSize !== layout.circleSize &&
        this.fourierCircleImg != null
      ) {
        setFrequencyToTest.call(this, this.frequencyToTest);
      }

      calcNumbers.call(this);
      drawCircle.call(this);
      drawFourierTransformationGraph.call(this);
      drawXAxis.call(this);
      drawMouseOverInfo.call(this);

      if (this.finished) {
        sketch.noLoop();
      }

      function drawCircle(this: CircleCanvasComponent) {
        if (this.fourierCircleImg != null) {
          sketch.image(this.fourierCircleImg, layout.circleX, layout.circleY);
        }
      }

      function calcNumbers(this: CircleCanvasComponent) {
        if (calcNextGenerator == null && !this.finished) {
          calcNextGenerator = calcNextFrequency.call(this);
        }
        if (!this.finished) {
          calcNextGenerator?.next();
        } else {
          calcNextGenerator = null;
        }
      }

      function* calcNextFrequency(
        this: CircleCanvasComponent
      ): Generator<undefined> {
        let frequency = minFrequencyToTest;
        let start: number | null = null;
        while (frequency < maxFrequencyToTest && !this.finished) {
          start = start == null ? performance.now() : start;
          let centerOfX = 0;
          let real = 0;
          let imag = 0;
          for (let n = 0; n < samplesToTake; n++) {
            const tIndex = Math.floor(
              sketch.map(n, 0, samplesToTake, 0, this.wave().points.length)
            );
            const t = sketch.map(
              n,
              0,
              samplesToTake,
              0,
              this.wave().lengthInMs / 1000
            );
            const normalizedSamplePoint = sketch.map(
              this.wave().points[tIndex],
              -1,
              1,
              -1,
              1
            );
            const rotation = NEG_TWO_PI * frequency * t;
            const realStep = normalizedSamplePoint * Math.cos(rotation);
            const imagStep = normalizedSamplePoint * Math.sin(rotation);
            real += realStep;
            imag += imagStep;
          }

          centerOfX = (real * real + imag * imag) / samplesToTake;
          this.centers.push(centerOfX);
          this.centersOfFrequencies[frequency] = {
            real: real / samplesToTake,
            imag: imag / samplesToTake,
          };
          if (this.centerMax <= centerOfX) {
            setFrequencyToTest.call(this, frequency);
          }
          this.centerMin = Math.min(centerOfX, this.centerMin);
          this.centerMax = Math.max(centerOfX, this.centerMax);
          frequency = math.round(frequency + frequencyStepWidth, 3) as number;
          if (performance.now() - start > 5) {
            start = null;
            yield;
          }
        }
        this.finished = true;
      }

      function drawFourierTransformationGraph(this: CircleCanvasComponent) {
        sketch.push();
        sketch.beginShape();
        for (let x = layout.graphLeft; x < layout.graphRight; x++) {
          const xInd = Math.floor(
            sketch.map(
              x,
              layout.graphLeft,
              layout.graphRight,
              0,
              frequencySteps
            )
          );
          if (xInd < this.centers.length) {
            const y = sketch.map(
              this.centers[xInd],
              this.centerMin,
              this.centerMax,
              layout.graphBottom,
              layout.graphTop
            );
            sketch.vertex(x, y);
          } else {
            break;
          }
        }
        sketch.endShape();
        sketch.pop();
      }

      function drawXAxis(this: CircleCanvasComponent) {
        sketch.push();
        const axisY = layout.graphBottom + 5;
        const labelY = axisY + 12;
        sketch.line(layout.graphLeft, axisY, layout.graphRight, axisY);
        sketch.textAlign('center', 'center');
        sketch.textSize(layout.stacked ? 10 : 12);

        const labelAmount = axisLabelAmount();
        for (let i = 0; i <= labelAmount; i++) {
          const x = sketch.map(
            i,
            0,
            labelAmount,
            layout.graphLeft,
            layout.graphRight
          );
          const frequency = sketch.map(
            i,
            0,
            labelAmount,
            minFrequencyToTest,
            maxFrequencyToTest
          );
          sketch.line(x, axisY, x, axisY + 4);
          sketch.text(
            frequency.toFixed(layout.stacked ? 0 : 2) + 'hz',
            x,
            labelY
          );
        }
        sketch.pop();
      }

      function axisLabelAmount(): number {
        const graphWidth = layout.graphRight - layout.graphLeft;
        return Math.max(
          2,
          Math.min(10, Math.floor(graphWidth / MIN_AXIS_LABEL_WIDTH))
        );
      }
    };

    sketch.mouseMoved = () => {
      selectFrequencyAt.call(this, sketch.mouseX, sketch.mouseY);
    };

    // Touch devices get no hover, so a tap picks the frequency instead. Returning
    // `true` keeps the default behaviour so the page can still be scrolled.
    sketch.touchStarted = () => {
      selectFrequencyAt.call(this, sketch.mouseX, sketch.mouseY);
      return true;
    };

    function selectFrequencyAt(
      this: CircleCanvasComponent,
      x: number,
      y: number
    ) {
      const point = graphPointAt.call(this, x, y);
      if (point != null && this.finished) {
        setFrequencyToTest.call(this, point.frequency);
        sketch.redraw();
      }
    }

    /**
     * Graph point the given canvas position points at, or `null` when the
     * position is outside the frequency graph.
     */
    function graphPointAt(
      this: CircleCanvasComponent,
      x: number,
      y: number
    ): GraphPoint | null {
      if (
        x < layout.graphLeft ||
        x > layout.graphRight ||
        y < layout.graphTop ||
        y > layout.graphBottom
      ) {
        return null;
      }
      const index = Math.floor(
        sketch.map(x, layout.graphLeft, layout.graphRight, 0, frequencySteps)
      );
      if (index >= this.centers.length) {
        return null;
      }
      const frequency = math.round(
        sketch.map(
          index,
          0,
          frequencySteps,
          minFrequencyToTest,
          maxFrequencyToTest
        ),
        3
      ) as number;
      return { index, frequency };
    }

    function drawMouseOverInfo(this: CircleCanvasComponent) {
      const mX = sketch.mouseX;
      const point = graphPointAt.call(this, mX, sketch.mouseY);
      if (point == null) {
        return;
      }
      const { index, frequency } = point;
      const y = sketch.map(
        this.centers[index],
        this.centerMin,
        this.centerMax,
        layout.graphBottom,
        layout.graphTop
      );
      const label = frequency + ' Hz,' + this.centers[index].toFixed(5);
      sketch.stroke(105, 240, 174);
      sketch.ellipseMode('center');
      sketch.ellipse(mX, y, 5);
      sketch.stroke(255);
      // Flip the label to the left of the marker when it would leave the canvas.
      const labelFitsRight =
        mX + 5 + sketch.textWidth(label) < layout.graphRight;
      sketch.textAlign(labelFitsRight ? 'left' : 'right', 'center');
      sketch.text(label, labelFitsRight ? mX + 5 : mX - 5, y);
      sketch.push();
      sketch.strokeWeight(0.5);
      sketch.stroke(123, 31, 162);
      sketch.line(mX, layout.graphTop, mX, layout.graphBottom);
      sketch.pop();
    }

    function drawCircleToBuffer(this: CircleCanvasComponent) {
      const circleSize = layout.circleSize;
      const radius = (circleSize - padding * 2) / 2;
      if (
        this.fourierCircleImg == null ||
        this.fourierCircleImg.width !== circleSize ||
        this.fourierCircleImg.height !== circleSize
      ) {
        this.fourierCircleImg?.remove();
        this.fourierCircleImg = sketch.createGraphics(circleSize, circleSize);
      }
      const fourierCircleImg = this.fourierCircleImg;
      const drawSamplesLength = this.wave().points.length;
      const stepSize = Math.max(
        1,
        Math.floor(drawSamplesLength / CIRCLE_DRAW_SAMPLES)
      );

      fourierCircleImg.resetMatrix();
      fourierCircleImg.background(66);
      fourierCircleImg.stroke(255, 255, 255);
      fourierCircleImg.strokeWeight(0.5);
      fourierCircleImg.noFill();
      fourierCircleImg.textAlign('center', 'center');
      fourierCircleImg.text(
        'Frequency: ' + this.frequencyToTest,
        circleSize / 2,
        padding / 2
      );
      fourierCircleImg.translate(circleSize / 2, circleSize / 2);
      fourierCircleImg.ellipseMode('center');
      fourierCircleImg.ellipse(0, 0, radius * 2);
      fourierCircleImg.stroke(255, 255, 255, 60);

      fourierCircleImg.beginShape();
      for (let n = 0; n < drawSamplesLength; n += stepSize) {
        const tIndex = Math.floor(
          sketch.map(n, 0, drawSamplesLength, 0, this.wave().points.length)
        );
        const t = sketch.map(
          n,
          0,
          drawSamplesLength,
          0,
          this.wave().lengthInMs / 1000
        );
        const normalizedSamplePoint = sketch.map(
          this.wave().points[tIndex],
          -1,
          1,
          0,
          1
        );
        const rotation = NEG_TWO_PI * this.frequencyToTest * t;
        const realStep = normalizedSamplePoint * Math.cos(rotation);
        const imagStep = normalizedSamplePoint * Math.sin(rotation);

        const x = realStep * radius;
        const y = -imagStep * radius;
        fourierCircleImg.curveVertex(x, y);
      }
      fourierCircleImg.endShape('close');

      fourierCircleImg.stroke(255, 255, 255);
      fourierCircleImg.ellipse(0, 0, 2, 2);
      fourierCircleImg.stroke(255, 0, 0);
      const centerData = this.centersOfFrequencies[this.frequencyToTest];
      if (centerData != null) {
        fourierCircleImg.ellipse(
          centerData.real * radius,
          -centerData.imag * radius,
          6,
          6
        );
      }
    }

    function setFrequencyToTest(
      this: CircleCanvasComponent,
      frequency: number
    ) {
      this.frequencyToTest = frequency;
      drawCircleToBuffer.apply(this);
    }
  }

  ngOnDestroy(): void {
    this.fourierCircleImg?.remove();
    this.fourierCircleImg = null;
    if (this.sketch != null) {
      this.sketch.remove();
    }
  }
}
