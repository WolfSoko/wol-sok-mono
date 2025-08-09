import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { GravityWorldComponent } from './gravity-world/gravity-world.component';

@Component({
  imports: [MatToolbarModule, GravityWorldComponent],
  selector: 'feat-lazy-gravity-rocks',
  templateUrl: './gravity-rocks.component.html',
  styleUrls: ['./gravity-rocks.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GravityRocksComponent {
  constructor() {
    const iconRegistry = inject(MatIconRegistry);

    iconRegistry.setDefaultFontSetClass('material-icons');
  }
}
