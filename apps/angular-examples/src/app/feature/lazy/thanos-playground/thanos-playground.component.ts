import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
  WsThanosCrumble,
  WsThanosDirective,
  WsThanosOptions,
} from '@wolsok/thanos';

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
  protected readonly crumbles = WS_THANOS_CRUMBLES;
  protected readonly maxParticleCounts = [
    50_000, 200_000, 500_000, 1_500_000, 3_000_000, 6_000_000,
  ];

  protected readonly crumble = signal<WsThanosCrumble>('shards');
  /** clockwise from up, 45 blows to the top right */
  protected readonly windDirection = signal(45);
  protected readonly animationLength = signal(5000);
  protected readonly particleAcceleration = signal(30);
  protected readonly maxParticleCount = signal(3_000_000);
  protected readonly sound = signal(true);
  protected readonly soundVolume = signal(0.5);
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
    thanos.vaporize(false).subscribe(() => this.snapping.set(false));
  }
}
