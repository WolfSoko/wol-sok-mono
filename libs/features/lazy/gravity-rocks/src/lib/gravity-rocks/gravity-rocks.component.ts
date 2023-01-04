import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { GravityWorldComponent } from './gravity-world/gravity-world.component';

@Component({
  standalone: true,
  imports: [CommonModule, MatToolbarModule, GravityWorldComponent],
  selector: 'feat-lazy-gravity-rocks',
  templateUrl: './gravity-rocks.component.html',
  styleUrls: ['./gravity-rocks.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GravityRocksComponent {
  constructor(iconRegistry: MatIconRegistry) {
    iconRegistry.setDefaultFontSetClass('material-icons');
  }
}
