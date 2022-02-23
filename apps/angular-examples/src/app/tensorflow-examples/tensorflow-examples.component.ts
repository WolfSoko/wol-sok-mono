import {ChangeDetectionStrategy, Component, OnInit} from "@angular/core";

@Component({
  selector: 'app-tensorflow-examples',
  templateUrl: './tensorflow-examples.component.html',
  styleUrls: ['./tensorflow-examples.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TensorflowExamplesComponent implements OnInit {

  navLinks = [
    {path: 'polynomialregression', label: 'Polynomial regression'},
    {path: 'learnedDigits', label: 'Learned digits (MNIST)'}
  ];

  constructor() { }

  ngOnInit() {
  }

}
