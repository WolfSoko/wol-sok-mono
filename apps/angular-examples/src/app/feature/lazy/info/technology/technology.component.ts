import { CommonModule, NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AnimationState, WsThanosDirective } from '@wolsok/thanos';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { Observable, switchMap, timer } from 'rxjs';

@Component({
  imports: [
    CommonModule,
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
  @Input() title!: string;
  @Input() link!: string;
  @Input() image!: string;
  @Input() autoVaporize = false;
  @Input() autoVaporizeAfter = 1000;

  @ViewChild(WsThanosDirective)
  public thanos!: WsThanosDirective;

  private destroyRef: DestroyRef = inject(DestroyRef);

  constructor(private elemRef: ElementRef<HTMLElement>) {}

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
