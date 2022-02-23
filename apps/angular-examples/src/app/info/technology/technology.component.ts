import {ChangeDetectionStrategy, Component, Input} from "@angular/core";

@Component({
  selector: 'app-technology',
  templateUrl: './technology.component.html',
  styleUrls: ['./technology.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TechnologyComponent  {

  @Input() title!: string;
  @Input() link!: string ;
  @Input() image!: string;

}
