import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'ws-shared-ui-show-fps',
  templateUrl: './show-fps.component.html',
  styleUrls: ['./show-fps.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatChipsModule],
})
export class ShowFpsComponent {
  fps = input(0);
  show = input(false);
}
