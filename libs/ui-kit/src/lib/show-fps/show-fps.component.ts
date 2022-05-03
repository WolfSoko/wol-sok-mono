import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  NgModule,
  ViewEncapsulation,
} from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'ws-shared-ui-show-fps',
  templateUrl: './show-fps.component.html',
  styleUrls: ['./show-fps-global.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { click: 'ws-shared-ui-show-fps' },
})
export class ShowFpsComponent {
  @Input() show = false;
  @Input() fps = 0;
}

@NgModule({
  imports: [CommonModule, MatChipsModule],
  declarations: [ShowFpsComponent],
  exports: [ShowFpsComponent],
})
export class ShowFpsModule {}
