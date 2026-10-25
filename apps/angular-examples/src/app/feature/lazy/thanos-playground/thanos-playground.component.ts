import { JsonPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import {
  WS_THANOS_CRUMBLES,
  WS_THANOS_OPTIONS_TOKEN,
  WsThanosCrumble,
  WsThanosDirective,
  WsThanosOptions,
} from '@wolsok/thanos';
import { finalize } from 'rxjs';

/** the dust blows to the top right unless told otherwise, like in the library */
const DEFAULT_WIND_DIRECTION = 45;

const PARTICLE_COUNTS = [
  50_000, 200_000, 500_000, 1_500_000, 3_000_000, 6_000_000,
];

/** try out every option of @wolsok/thanos on a card that comes back after each snap */
@Component({
  selector: 'app-thanos-playground',
  templateUrl: './thanos-playground.component.html',
  styleUrls: ['./thanos-playground.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JsonPipe,
    WsThanosDirective,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSliderModule,
  ],
})
export class ThanosPlaygroundComponent {
  /** the app's options: they start the playground and cap the particles to the device */
  private readonly appOptions = inject(WS_THANOS_OPTIONS_TOKEN);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly crumbles = WS_THANOS_CRUMBLES;
  protected readonly maxParticleCounts = PARTICLE_COUNTS.filter(
    (count) => count <= this.appOptions.maxParticleCount
  );

  protected readonly crumble = signal<WsThanosCrumble>(this.appOptions.crumble);
  /** clockwise from up, 45 blows to the top right */
  protected readonly windDirection = signal(
    this.appOptions.windDirection ?? DEFAULT_WIND_DIRECTION
  );
  protected readonly animationLength = signal(this.appOptions.animationLength);
  protected readonly particleAcceleration = signal(
    this.appOptions.particleAcceleration
  );
  protected readonly maxParticleCount = signal(
    this.appOptions.maxParticleCount
  );
  protected readonly sound = signal(this.appOptions.sound);
  protected readonly soundVolume = signal(this.appOptions.soundVolume);
  /** the card is snapping, the button waits until it is back */
  protected readonly snapping = signal(false);

  public readonly options = computed((): Partial<WsThanosOptions> => ({
    crumble: this.crumble(),
    windDirection: this.windDirection(),
    animationLength: this.animationLength(),
    particleAcceleration: this.particleAcceleration(),
    maxParticleCount: this.maxParticleCount(),
    sound: this.sound(),
    soundVolume: this.soundVolume(),
  }));

  protected snap(thanos: WsThanosDirective): void {
    this.snapping.set(true);
    thanos
      .vaporize$(false)
      .pipe(
        finalize(() => this.snapping.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  /** the slider steps in floats, keep the copied options readable */
  protected setSoundVolume(volume: number): void {
    this.soundVolume.set(Math.round(volume * 100) / 100);
  }

  protected particleLabel(count: number): string {
    return count >= 1_000_000 ? `${count / 1_000_000}M` : `${count / 1000}k`;
  }
}
