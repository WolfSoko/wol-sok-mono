import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  standalone: true,
  imports: [MatListModule, RouterLink, RouterLinkActive, MatIconModule],
  selector: 'app-nav-item',
  templateUrl: './nav-item.component.html',
  styleUrls: ['./nav-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavItemComponent {
  @Input() linkText?: string;
  @Input() path?: string;
}
