import { ChangeDetectionStrategy, Component } from '@angular/core';
import { APPS, EXPERIMENTS, PACKAGES } from '../projects';
import { ProjectCardComponent } from '../project-card/project-card.component';

@Component({
  selector: 'wolsok-home',
  imports: [ProjectCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  protected readonly apps = APPS;
  protected readonly experiments = EXPERIMENTS;
  protected readonly packages = PACKAGES;
}
