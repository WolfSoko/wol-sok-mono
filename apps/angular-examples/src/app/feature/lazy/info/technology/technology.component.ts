import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { WsThanosDirective } from '@wolsok/thanos';
import { ElevateCardDirective } from '@wolsok/ui-kit';

@Component({
  standalone: true,
  imports: [CommonModule, WsThanosDirective, MatCardModule, ElevateCardDirective, MatButtonModule, NgOptimizedImage],
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
  @Input() autoVaporizeAfter?: number;

  @ViewChild(WsThanosDirective)
  public thanos: WsThanosDirective | undefined;

  constructor(private elemRef: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    if (this.autoVaporize) {
      setTimeout(() => {
        this.elemRef.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        this.thanos?.vaporize(false);
      }, this.autoVaporizeAfter);
    }
  }
}
