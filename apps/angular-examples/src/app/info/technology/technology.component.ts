import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-technology',
  templateUrl: './technology.component.html',
  styleUrls: ['./technology.component.less']
})
export class TechnologyComponent  {

  @Input() title!: string;
  @Input() link!: string ;
  @Input() image!: string;

}
