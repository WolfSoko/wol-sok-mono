import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  input,
  QueryList,
  signal,
  ViewChildren,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { from, Subject } from 'rxjs';
import { concatMap, takeUntil } from 'rxjs/operators';
import { AboutComponent } from './about/about.component';
import { Technology } from './technology';
import { TechnologyComponent } from './technology/technology.component';

@Component({
  imports: [
    RouterModule,
    AboutComponent,
    MatCardModule,
    TechnologyComponent,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-info',
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoComponent {
  private destroy$ = inject<DestroyRef>(DestroyRef);

  thanosDemo = input(false);
  @ViewChildren(TechnologyComponent) techCards!: QueryList<TechnologyComponent>;
  demoRunning = signal(false);
  private stopSub = new Subject<void>();

  constructor() {
    const destroy$ = this.destroy$;

    destroy$.onDestroy(() => {
      this.stopSub.next();
      this.stopSub.complete();
    });
  }

  public technologies = signal([
    new Technology(
      'Angular',
      'https://angular.dev/',
      'assets/logos/angular.svg'
    ),
    new Technology(
      'Angular Material',
      'https://material.angular.dev/',
      'assets/logos/angular-material.svg'
    ),
    new Technology(
      'Nx',
      'https://nx.dev/',
      'assets/logos/nx.svg',
      'assets/logos/nx-dark.svg'
    ),
    new Technology(
      'TypeScript',
      'https://www.typescriptlang.org/',
      'assets/logos/typescript.svg'
    ),
    new Technology('RxJS', 'https://rxjs.dev/', 'assets/logos/rxjs.svg'),
    new Technology('NgRx', 'https://ngrx.io/', 'assets/logos/ngrx.svg'),
    new Technology(
      'Analog',
      'https://analogjs.org/',
      'assets/logos/analog.svg'
    ),
    new Technology(
      'Vite',
      'https://vite.dev/',
      'assets/logos/vite.svg',
      'assets/logos/vite-dark.svg'
    ),
    new Technology(
      'three.js',
      'https://threejs.org/',
      'assets/logos/threejs.svg',
      'assets/logos/threejs-dark.svg'
    ),
    new Technology('p5.js', 'https://p5js.org/', 'assets/logos/p5.svg'),
    new Technology('gpu.js', 'https://gpu.rocks/', 'assets/logos/gpu-js.png'),
    new Technology(
      'TensorFlow.js',
      'https://www.tensorflow.org/js',
      'assets/logos/tensorflow.svg'
    ),
    new Technology(
      'Vega-Lite',
      'https://vega.github.io/vega-lite/',
      'assets/logos/vega-lite.svg'
    ),
    new Technology(
      'math.js',
      'https://mathjs.org/',
      'assets/logos/mathjs.svg',
      'assets/logos/mathjs-dark.svg'
    ),
    new Technology(
      'WebAssembly',
      'https://webassembly.org/',
      'assets/logos/webassembly.svg'
    ),
    new Technology(
      'AssemblyScript',
      'https://www.assemblyscript.org/',
      'assets/logos/assemblyscript.svg'
    ),
    new Technology(
      'Firebase',
      'https://firebase.google.com/',
      'assets/logos/firebase.svg'
    ),
    new Technology(
      'AWS CDK',
      'https://aws.amazon.com/cdk/',
      'assets/logos/aws.svg',
      'assets/logos/aws-dark.svg'
    ),
    new Technology(
      'Sentry',
      'https://sentry.io/',
      'assets/logos/sentry.svg',
      'assets/logos/sentry-dark.svg'
    ),
    new Technology(
      'Vitest',
      'https://vitest.dev/',
      'assets/logos/vitest.svg',
      'assets/logos/vitest-dark.svg'
    ),
    new Technology('Jest', 'https://jestjs.io/', 'assets/logos/jest.svg'),
    new Technology(
      'Playwright',
      'https://playwright.dev/',
      'assets/logos/playwright.svg'
    ),
  ]).asReadonly();

  startDemo(): void {
    this.demoRunning.set(true);
    from(this.techCards.toArray())
      .pipe(
        concatMap((techCard) =>
          techCard
            .vaporizeAndScrollIntoView(false)
            .pipe(takeUntil(this.stopSub.asObservable()))
        ),
        takeUntil(this.stopSub.asObservable())
      )
      .subscribe({ complete: () => this.demoRunning.set(false) });
  }

  stopDemo(): void {
    this.stopSub.next();
    this.demoRunning.set(false);
  }

  toggleDemo(): void {
    if (!this.demoRunning()) {
      this.startDemo();
    } else {
      this.stopDemo();
    }
  }
}
