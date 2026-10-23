import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Input,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  AnimationState,
  WsThanosDirective,
  WsThanosOptions,
} from '@wolsok/thanos';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { Observable, switchMap, timer } from 'rxjs';
import { randomCrumble } from './random-crumble';

@Component({
  imports: [
    WsThanosDirective,
    MatCardModule,
    ElevateCardDirective,
    MatButtonModule,
    NgOptimizedImage,
  ],
  selector: 'app-technology',
  templateUrl: './technology.component.html',
  styleUrls: ['./technology.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechnologyComponent implements OnInit {
  private elemRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input() title!: string;
  @Input() link!: string;
  @Input() image!: string;
  @Input() public darkImage?: string;
  @Input() autoVaporize = false;
  @Input() autoVaporizeAfter = 1000;

  @ViewChild(WsThanosDirective)
  public thanos!: WsThanosDirective;

  private destroyRef: DestroyRef = inject(DestroyRef);

  /** every tile snaps with a random crumble variant, and with another one the next time */
  protected readonly thanosOptions = signal<Partial<WsThanosOptions>>({
    crumble: randomCrumble(),
  });

  protected nextCrumble(): void {
    this.thanosOptions.update(({ crumble }) => ({
      crumble: randomCrumble(crumble),
    }));
  }

  ngOnInit(): void {
    if (this.autoVaporize) {
      timer(this.autoVaporizeAfter)
        .pipe(
          switchMap(() => this.vaporizeAndScrollIntoView(false)),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe();
    }
  }

  public vaporizeAndScrollIntoView(
    removeElem?: boolean
  ): Observable<AnimationState> {
    this.elemRef.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
    return this.thanos.vaporize$(removeElem);
  }
}
