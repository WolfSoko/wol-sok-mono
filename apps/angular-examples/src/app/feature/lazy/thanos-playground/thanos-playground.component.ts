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
  DEFAULT_WIND_DIRECTION,
  WS_THANOS_CRUMBLES,
  WS_THANOS_OPTIONS_TOKEN,
  WsThanosDirective,
  WsThanosOptions,
} from '@wolsok/thanos';
import { finalize } from 'rxjs';

/** the options the playground offers, every one set */
type PlaygroundOptions = Required<
  Pick<
    WsThanosOptions,
    | 'crumble'
    | 'windDirection'
    | 'animationLength'
    | 'particleAcceleration'
    | 'maxParticleCount'
    | 'sound'
    | 'soundVolume'
  >
>;

const PARTICLE_COUNTS = [
  50_000, 200_000, 500_000, 1_500_000, 3_000_000, 6_000_000,
];

const particleLabel = (count: number): string =>
  count >= 1_000_000 ? `${count / 1_000_000}M` : `${count / 1000}k`;

/** try out every option of @wolsok/thanos on a card that comes back after each snap */
@Component({
  selector: 'app-thanos-playground',
  templateUrl: './thanos-playground.component.html',
  styleUrls: ['./thanos-playground.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  protected readonly particleCounts = PARTICLE_COUNTS.filter(
    (count) => count <= this.appOptions.maxParticleCount
  ).map((count) => ({ count, label: particleLabel(count) }));

  public readonly options = signal<PlaygroundOptions>({
    crumble: this.appOptions.crumble,
    windDirection: this.appOptions.windDirection ?? DEFAULT_WIND_DIRECTION,
    animationLength: this.appOptions.animationLength,
    particleAcceleration: this.appOptions.particleAcceleration,
    maxParticleCount: this.appOptions.maxParticleCount,
    sound: this.appOptions.sound,
    soundVolume: this.appOptions.soundVolume,
  });
  /** shown to copy into provideWsThanosOptions or [wsThanosOptions] */
  protected readonly optionsJson = computed(() =>
    JSON.stringify(this.options(), null, 2)
  );
  /** the card is snapping, the button waits until it is back */
  protected readonly snapping = signal(false);

  protected setOption<K extends keyof PlaygroundOptions>(
    key: K,
    value: PlaygroundOptions[K]
  ): void {
    this.options.update((options) => ({ ...options, [key]: value }));
  }

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
    this.setOption('soundVolume', Math.round(volume * 100) / 100);
  }
}
