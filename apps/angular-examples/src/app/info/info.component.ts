import {ChangeDetectionStrategy, Component} from '@angular/core';
import {Technology} from './technology';

@Component({
  selector: 'app-info',
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfoComponent {

  public technologies = [
    new Technology('Angular+', 'http://angular.io/', 'assets/logos/angular.svg'),
    new Technology('nrwl.io', 'https://nrwl.io/', 'assets/logos/nrwl-logo.svg'),
    new Technology('Typescript', 'http://www.typescriptlang.org/', 'assets/logos/typescript.svg'),
    new Technology('p5js', 'https://p5js.org', 'assets/logos/p5.svg'),
    new Technology('three.js', 'https://threejs.org/', 'assets/logos/three-js.png'),
    new Technology('gpu.js', 'http://gpu.rocks/', 'assets/logos/gpu-js.png'),
    new Technology('Angular Material', 'http://angular.material.io/', 'assets/logos/angular-material.svg'),
    new Technology('tensorflow.js', 'https://js.tensorflow.org', 'assets/logos/tensorflow-js.png'),
    new Technology('firebase', 'https://firebase.google.com/', 'assets/logos/firebase.png'),
  ];
}
