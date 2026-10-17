import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  input,
  viewChild,
} from '@angular/core';
import P5 from 'p5';
import { BrainService } from '../brain.service';
import { NetworkP5Sketch } from './network-p5-sketch';

@Component({
  selector: 'feat-lazy-neural-networks-network-view',
  template: `
    <div #networkCanvas></div>
    <p class="legend">
      Each tile shows what a neuron outputs for every point of the data square
      (blue 0, white 0.5, yellow 1). Line width grows with the weight's size,
      orange lines are positive, blue lines negative; a tile's border is its
      bias. Hover a line or tile for the exact values.
    </p>
  `,
  styles: `
    .legend {
      max-width: 60ch;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkViewComponent implements AfterViewInit, OnDestroy {
  private readonly brainService = inject(BrainService);
  private readonly networkCanvas =
    viewChild.required<ElementRef<HTMLElement>>('networkCanvas');

  public readonly canvasWidth = input(400);
  public readonly tileSize = input(44);
  /** Label every weight and bias with its value, for small nets. */
  public readonly showValues = input(false);

  private sketch?: P5;

  public ngAfterViewInit(): void {
    this.sketch = new P5(
      (p) =>
        new NetworkP5Sketch(
          p,
          this.canvasWidth(),
          this.tileSize(),
          this.showValues(),
          this.brainService
        ),
      this.networkCanvas().nativeElement
    );
  }

  public ngOnDestroy(): void {
    this.sketch?.remove();
  }
}
