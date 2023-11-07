import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { ShowFpsComponent } from '@wolsok/ui-kit';
import * as P5 from 'p5';
import { ReactionDiffCalculator } from '../calculation/reaction-diff-calculator';

@Component({
  standalone: true,
  imports: [CommonModule, ShowFpsComponent],
  selector: 'feat-lazy-react-diff-p5-view',
  templateUrl: './p5-view.component.html',
  styleUrls: ['./p5-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class P5ViewComponent implements OnChanges, OnDestroy {
  @ViewChild('drawArea', { static: true }) drawArea!: ElementRef;
  @Input() simWidth!: number;
  @Input() simHeight!: number;
  @Input() calcService!: ReactionDiffCalculator;
  @Input() run = false;
  @Input() showFps = false;
  @Output() mousePressed: EventEmitter<{ x: number; y: number }> = new EventEmitter();

  public frameRate = 1;

  private sketch?: P5;
  private drawOnce = true;

  constructor(
    private ngZone: NgZone,
    private cd: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['simWidth'] || changes['simHeight']) {
      if (this.sketch) {
        this.sketch.resizeCanvas(this.simWidth, this.simHeight);
      } else {
        this.sketch = new P5((p) => this.initP5(p), this.drawArea.nativeElement);
      }
    }
  }

  private initP5(p: P5) {
    this.ngZone.runOutsideAngular(() => {
      p.setup = () => {
        p.pixelDensity(1);
        p.createCanvas(this.simWidth, this.simHeight);
      };

      p.draw = () => {
        if (this.run) {
          p.background(51);
          performance.mark('calcNext-start');
          this.calcService.calcNext();
          this.calcService.drawImage(p);
          performance.mark('calcNext-end');
          performance.measure('calcNext', 'calcNext-start', 'calcNext-end');
        }

        if (this.drawOnce && !this.run) {
          this.calcService.drawImage(p);
          this.drawOnce = false;
          this.cd.markForCheck();
        }

        if (this.showFps) {
          const frameRate = p.frameRate();
          this.frameRate = this.frameRate * 0.99 + frameRate * 0.01;
          if (this.run) {
            this.cd.markForCheck();
          }
        }
      };

      const addChemical = () => {
        const x = p.floor(p.mouseX);
        const y = p.floor(p.mouseY);
        if (x > -1 && x < p.width && y > -1 && y < p.height) {
          this.calcService.addChemical(x, y);
          this.drawOnce = true;
          this.cd.markForCheck();
          // don't bubble up event.
          return false;
        }
        return true;
      };

      p.mouseClicked = addChemical;
      p.mouseDragged = addChemical;
      p.touchMoved = addChemical;
      p.touchStarted = addChemical;
    });
  }

  ngOnDestroy(): void {
    this.sketch?.remove();
  }
}
