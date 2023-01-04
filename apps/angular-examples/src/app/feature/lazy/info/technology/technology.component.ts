import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { WsThanosDirective } from '@wolsok/thanos';

@Component({
  standalone: true,
  imports: [CommonModule, WsThanosDirective, MatCardModule, ElevateCardDirective, MatButtonModule, NgOptimizedImage],
  selector: 'app-technology',
  templateUrl: './technology.component.html',
  styleUrls: ['./technology.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechnologyComponent {
  @Input() title!: string;
  @Input() link!: string;
  @Input() image!: string;
}
