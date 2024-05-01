import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { UntilDestroy } from '@ngneat/until-destroy';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { Observable } from 'rxjs';
import { PoissonConfig } from '../../domain/model/poisson.config';
import { PoissonConfigService } from '../../domain/poisson-config.service';

@UntilDestroy()
@Component({
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    FormsModule,
    MatInputModule,
    MatButtonModule,
    ElevateCardDirective,
  ],
  selector: 'lazy-feat-poisson-sim-controls',
  templateUrl: './sim-controls.component.html',
  styleUrls: ['./sim-controls.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimControlsComponent {
  @Output() playChanged: EventEmitter<boolean> = new EventEmitter();
  @Output() resetSim: EventEmitter<boolean> = new EventEmitter();

  play = false;
  config$: Observable<PoissonConfig>;

  constructor(public readonly poissonConfig: PoissonConfigService) {
    this.config$ = poissonConfig.config$;
  }

  radiusChanged(radius: number) {
    if (radius) {
      this.poissonConfig.update({ r: radius });
    }
  }

  kChanged(k: number) {
    if (k) {
      this.poissonConfig.update({ k });
    }
  }

  iterationsPerFrameChanged(iterationsPerFrame: number) {
    if (iterationsPerFrame) {
      this.poissonConfig.update({ iterationsPerFrame });
    }
  }

  togglePlay() {
    this.play = !this.play;
    this.emitPlay();
  }

  reset(): void {
    this.play = false;
    this.emitPlay();
    this.resetSim.emit(true);
  }

  private emitPlay() {
    this.playChanged.emit(this.play);
  }
}
