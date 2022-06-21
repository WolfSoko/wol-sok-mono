import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'ws-shared-ui-show-fps',
  templateUrl: './show-fps.component.html',
  styleUrls: ['./show-fps.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, MatChipsModule],
})
export class ShowFpsComponent {
  @Input() show = false;
  @Input() fps = 0;
}
