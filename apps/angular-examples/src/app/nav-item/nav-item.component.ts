import {ChangeDetectionStrategy, Component, Input} from "@angular/core";

@Component({
  selector: 'app-nav-item',
  templateUrl: './nav-item.component.html',
  styleUrls: ['./nav-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavItemComponent {
  @Input() linkText?: string;
  @Input() path?: string;
}
