import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  output,
  viewChild,
} from '@angular/core';
import P5 from 'p5';

class Path {
  constructor(
    public x: number,
    public y: number
  ) {}

  isEnd() {
    return false;
  }

  isStart() {
    return false;
  }
}

class End extends Path {
  override isEnd() {
    return true;
  }
}

class Start extends Path {
  override isStart() {
    return true;
  }
}

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'feat-lazy-tensor-app-draw-digit',
  templateUrl: './draw-digit.component.html',
  styleUrls: ['./draw-digit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawDigitComponent implements AfterViewChecked {
  updatePixels = output<Float32Array>();
  private sketch!: P5;
  private readonly size = 28 * 10;

  private path: Path[] = [];

  private drawCanvas =
    viewChild.required<ElementRef<HTMLElement>>('drawCanvas');

  constructor(private ngZone: NgZone) {}

  reset() {
    this.path = [];
  }

  private initSketch() {
    if (this.sketch) {
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      this.sketch = new P5((p: P5) => {
        let shapedStarted = false;
        p.setup = () => {
          p.pixelDensity(1);
          p.createCanvas(this.size, this.size);
          p.background(0);
          p.stroke(255, 255, 255, 230);
          p.strokeCap(p.ROUND);
          p.strokeJoin(p.MITER);
          p.strokeWeight(12);
        };

        const mouseInRange = () => {
          const x = p.mouseX;
          const y = p.mouseY;
          return x >= 0 && x < this.size && y < this.size && y >= 0;
        };

        p.mousePressed = () => {
          if (mouseInRange()) {
            if (!shapedStarted) {
              shapedStarted = true;
              this.path.push(new Start(p.mouseX, p.mouseY));
            }
          }
        };

        p.draw = () => {
          p.background(0);
          p.noFill();
          p.beginShape();
          this.path.forEach((pathElem) => {
            if (pathElem.isStart()) {
              p.beginShape();
            }
            p.curveVertex(pathElem.x, pathElem.y);
            if (pathElem.isEnd()) {
              p.endShape();
            }
          });
          p.endShape();
        };

        p.mouseReleased = () => {
          if (shapedStarted) {
            shapedStarted = false;
            this.path.push(new End(p.mouseX, p.mouseY));
            // scale the image down to 28 * 28;
            p.copy(0, 0, this.size, this.size, 0, 0, 28, 28);
            // read pixels into array and overwrite area with black
            p.loadPixels();
            const nextImage = new Float32Array(28 * 28);
            for (let col = 0; col < 28; col++) {
              for (let row = 0; row < 28; row++) {
                const index = col * 4 + row * this.size * 4;
                nextImage[col + row * 28] = p.pixels[index] / 255;
                p.pixels[index] = 0;
                p.pixels[index + 1] = 0;
                p.pixels[index + 2] = 0;
              }
            }
            p.updatePixels();
            this.updatePixels.emit(nextImage);
          }
        };

        p.mouseDragged = () => {
          if (mouseInRange()) {
            if (shapedStarted) {
              this.path.push(new Path(p.mouseX, p.mouseY));
            }
            return false;
          }
          return true;
        };
      }, this.drawCanvas().nativeElement);
    });
  }

  ngAfterViewChecked(): void {
    this.initSketch();
  }
}
