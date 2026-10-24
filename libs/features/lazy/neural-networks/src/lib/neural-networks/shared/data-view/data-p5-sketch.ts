import { Point, toLabelClass } from '../point';
import { Perceptron } from '../perceptron';
import { BrainService } from '../brain.service';
import P5 from 'p5';
import { heatmapColor, setPixel } from '../heatmap';

const boundaryColor = [40, 40, 40];
// one heatmap pixel per 4x4 canvas pixels
const heatmapScale = 4;

export class DataP5Sketch {
  public points: Point[] = [];
  public perceptron?: Perceptron;
  private heatmap?: P5.Image;
  // the network the heatmap was computed for, to skip recomputing it while nothing learns
  private heatmapOf?: { perceptron: Perceptron; learnedDataPoints: number };

  constructor(
    private p: P5,
    private width = 400,
    private height = 400,
    private brainService: BrainService,
    private onClickHandler: (
      x: number,
      y: number,
      click: 'left' | 'right'
    ) => void,
    private showLinearDivider = true
  ) {
    p.setup = this.setup.bind(this);
    p.draw = this.draw.bind(this);
    p.mousePressed = this.mouseClicked.bind(this);
  }

  setup(): void {
    this.p.createCanvas(this.width, this.height);
  }

  draw(): void {
    if (this.perceptron) {
      this.p.image(
        this.updateHeatmap(this.perceptron),
        0,
        0,
        this.width,
        this.height
      );
      this.p.strokeWeight(1);
      this.points.forEach((point) => point.show(this.p));

      this.points.forEach((point) => {
        const result = this.brainService.guessSilent(point.data);
        point.showForResult(this.p, result);
      });
      if (this.showLinearDivider) {
        // the true class border of the default x > y data
        this.p.stroke(0, 0, 0);
        this.p.line(0, 0, this.p.width, this.p.height);
        this.drawSeparationLine();
      }
    }
  }

  /**
   * Colours every pixel by the network's output: blue for 0 (class 2), white for 0.5
   * and yellow for 1 (class 1). Pixels where the guessed class flips are drawn dark,
   * which traces the decision boundary the network has actually learned.
   */
  private updateHeatmap(perceptron: Perceptron): P5.Image {
    const img = (this.heatmap ??= this.p.createImage(
      this.width / heatmapScale,
      this.height / heatmapScale
    ));
    const { learnedDataPoints } = this.brainService;
    if (
      this.heatmapOf?.perceptron === perceptron &&
      this.heatmapOf.learnedDataPoints === learnedDataPoints
    ) {
      return img;
    }
    this.heatmapOf = { perceptron, learnedDataPoints };

    const { width, height } = img;
    const activations = new Float32Array(width * height);
    const classes = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // sample at the pixel centre
        const activation = this.brainService.activationSilent([
          (x + 0.5) / width,
          (y + 0.5) / height,
        ]);
        activations[y * width + x] = activation;
        classes[y * width + x] = toLabelClass(activation);
      }
    }

    img.loadPixels();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const onBoundary =
          (x + 1 < width && classes[index + 1] !== classes[index]) ||
          (y + 1 < height && classes[index + width] !== classes[index]);
        if (onBoundary) {
          setPixel(img.pixels, index, boundaryColor);
        } else {
          setPixel(img.pixels, index, heatmapColor(activations[index]));
        }
      }
    }
    img.updatePixels();
    return img;
  }

  mouseClicked(): boolean {
    if (this.onClickHandler) {
      const mouseX = this.p.mouseX;
      const mouseY = this.p.mouseY;

      if (
        mouseX > 0 &&
        mouseY > 0 &&
        mouseX <= this.width &&
        mouseY <= this.p.height
      ) {
        const mouseButton =
          this.p.mouseButton === this.p.LEFT ? 'left' : 'right';
        this.onClickHandler(mouseX, mouseY, mouseButton);
        return false;
      }
    }
    return true;
  }

  private drawSeparationLine(): void {
    if (this.perceptron) {
      const classSeparatorLine = this.perceptron.classSeparatorLine;
      if (classSeparatorLine != null) {
        const y0 = classSeparatorLine.y0 * this.height;
        const y1 = this.width * classSeparatorLine.y1;
        this.p.stroke(255, 200, 200);
        this.p.strokeWeight(3);
        this.p.line(0, y0, this.width, y1);
        this.p.strokeWeight(1);
      }
    }
  }
}
