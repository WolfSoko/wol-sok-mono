import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  viewChildren,
} from '@angular/core';
import {
  WsThanosCrumble,
  WsThanosDirective,
  WsThanosOptions,
} from '@wolsok/thanos';

interface CrumbleVariant {
  crumble: WsThanosCrumble;
  description: string;
}

@Component({
  selector: 'app-root',
  imports: [WsThanosDirective],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  public readonly completedTests = signal<{ [key: string]: boolean }>({});

  public readonly crumbleVariants: CrumbleVariant[] = [
    { crumble: 'dust', description: 'Blows away along the vaporizing front.' },
    {
      crumble: 'cracks',
      description: 'Cracks spread through it before it turns to dust.',
    },
    {
      crumble: 'shards',
      description: 'Splits into shards that shift and tilt, then turn to dust.',
    },
    {
      crumble: 'chunks',
      description: 'Whole chunks break off, jump away and crumble to dust.',
    },
  ];
  public readonly maxParticleCounts = [
    50_000, 200_000, 500_000, 1_500_000, 4_000_000,
  ];

  public readonly crumble = signal<WsThanosCrumble>('shards');
  public readonly animationLength = signal(6000);
  public readonly particleAcceleration = signal(30);
  public readonly maxParticleCount = signal(1_500_000);
  public readonly sound = signal(true);
  public readonly soundVolume = signal(0.5);

  public readonly playgroundOptions = computed(
    (): Partial<WsThanosOptions> => ({
      crumble: this.crumble(),
      animationLength: this.animationLength(),
      particleAcceleration: this.particleAcceleration(),
      maxParticleCount: this.maxParticleCount(),
      sound: this.sound(),
      soundVolume: this.soundVolume(),
    })
  );

  private readonly crumbleCards = viewChildren<WsThanosDirective>('crumble');

  public onComplete(testId: string): void {
    console.log(`Test ${testId} completed`);
    this.completedTests.update((tests) => ({ ...tests, [testId]: true }));
  }

  public vaporizeMultiple(...directives: WsThanosDirective[]): void {
    directives.forEach((dir) => dir.vaporize(true));
  }

  public vaporizeAllVariants(): void {
    this.crumbleCards().forEach((card) => card.vaporize(false));
  }
}
