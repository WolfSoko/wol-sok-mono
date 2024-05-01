import { Point } from '../point';
import { Perceptron } from '../perceptron';
import { BrainService } from '../brain.service';
import P5 from 'p5';

export class DataP5Sketch {
  public points: Point[] = [];
  public perceptron?: Perceptron;
  private separationImg?: P5.Image;

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
      this.separationImg = this.p.createImage(this.width / 2, this.height / 2);
      this.separationImg.loadPixels();
      for (let x = 0; x < this.separationImg.width; x++) {
        for (let y = 0; y < this.separationImg.height; y++) {
          const inp0 = this.p.map(x, 0, this.separationImg.width, 0, 1);
          const inp1 = this.p.map(y, 0, this.separationImg.height, 0, 1);
          const guessWithoutStep = this.brainService.guessSilent([inp0, inp1]);
          const absGuess = Math.abs(guessWithoutStep - 0.5);
          const colorValue = this.p.map(absGuess, 0, 0.1, 255, 128);
          this.separationImg.set(x, y, [
            colorValue,
            colorValue,
            colorValue,
            255,
          ]);
        }
      }
      this.separationImg.updatePixels();
      this.p.image(this.separationImg, 0, 0, this.width, this.height);
      this.p.strokeWeight(1);
      this.points.forEach((point) => point.show(this.p));
      this.p.stroke(0, 0, 0);
      this.p.line(0, 0, this.p.width, this.p.height);

      this.points.forEach((point) => {
        const result = this.brainService.guessSilent(point.data);
        point.showForResult(this.p, result);
      });
      if (this.showLinearDivider) {
        this.drawSeparationLine();
      }
    }
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
