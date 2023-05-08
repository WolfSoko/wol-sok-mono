import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Inject,
  Input,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { from, Subject } from 'rxjs';
import { concatMap, takeUntil } from 'rxjs/operators';
import { AboutComponent } from './about/about.component';
import { Technology } from './technology';
import { TechnologyComponent } from './technology/technology.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AboutComponent,
    MatCardModule,
    TechnologyComponent,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  selector: 'app-info',
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoComponent {
  @Input() thanosDemo = false;
  @ViewChildren(TechnologyComponent) techCards!: QueryList<TechnologyComponent>;
  demoRunning = signal(false);
  private stopSub = new Subject<void>();

  constructor(@Inject(DestroyRef) private destroy$: DestroyRef) {
    destroy$.onDestroy(() => {
      this.stopSub.next();
      this.stopSub.complete();
    });
  }

  public technologies = [
    new Technology('Angular+', 'http://angular.io/', 'assets/logos/angular.svg'),
    new Technology('nrwl.io', 'https://nrwl.io/', 'assets/logos/nrwl-logo.svg'),
    new Technology('Typescript', 'http://www.typescriptlang.org/', 'assets/logos/typescript.svg'),
    new Technology('p5js', 'https://p5js.org', 'assets/logos/p5.svg'),
    new Technology('three.js', 'https://threejs.org/', 'assets/logos/three-js.png'),
    new Technology('gpu.js', 'http://gpu.rocks/', 'assets/logos/gpu-js.png'),
    new Technology('Angular Material', 'http://angular.material.io/', 'assets/logos/angular-material.svg'),
    new Technology('tensorflow.js', 'https://js.tensorflow.org', 'assets/logos/tensorflow-js.png'),
    new Technology('firebase', 'https://firebase.google.com/', 'assets/logos/firebase.png'),
  ];

  startDemo(): void {
    this.demoRunning.set(true);
    from(this.techCards.toArray())
      .pipe(
        concatMap((techCard) => techCard.vaporizeAndScrollIntoView(false).pipe(takeUntil(this.stopSub.asObservable()))),
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
