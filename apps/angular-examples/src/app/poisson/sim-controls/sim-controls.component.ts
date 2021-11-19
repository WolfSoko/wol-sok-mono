import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { PoissonConfigService } from '../poisson-config.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'app-sim-controls',
  templateUrl: './sim-controls.component.html',
  styleUrls: ['./sim-controls.component.css'],
})
export class SimControlsComponent implements OnInit {
  @Output() playChanged: EventEmitter<boolean> = new EventEmitter();
  @Output() onReset: EventEmitter<boolean> = new EventEmitter();

  play = false;
  iterationsPerFrame = 1;
  radius = 1;
  k = 1;

  constructor(private poissonConfig: PoissonConfigService) {}

  ngOnInit() {
    this.poissonConfig.r$
      .pipe(untilDestroyed(this))
      .subscribe((r) => (this.radius = r));
    this.poissonConfig.k$
      .pipe(untilDestroyed(this))
      .subscribe((k) => (this.k = k));
    this.poissonConfig.iterationsPerFrame$
      .pipe(untilDestroyed(this))
      .subscribe((iters) => (this.iterationsPerFrame = iters));
  }

  radiusChanged(radius: number) {
    if (radius) {
      this.poissonConfig.r$.next(radius);
    }
  }

  kChanged(k: number) {
    if (k) {
      this.poissonConfig.k$.next(k);
    }
  }

  iterationsPerFrameChanged(iterationsPerFrame: number) {
    if (iterationsPerFrame) {
      this.poissonConfig.iterationsPerFrame$.next(iterationsPerFrame);
    }
  }

  togglePlay() {
    this.play = !this.play;
    this.emitPlay();
  }

  reset(): void {
    this.play = false;
    this.emitPlay();
    this.onReset.emit(true);
  }

  private emitPlay() {
    this.playChanged.emit(this.play);
  }
}
