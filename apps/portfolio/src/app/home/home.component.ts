import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';
import { ProjectCardComponent } from '../project-card/project-card.component';
import { APPS, EXPERIMENTS, PACKAGES } from '../projects';
import { RevealDirective } from '../reveal.directive';

@Component({
  selector: 'wolsok-home',
  imports: [ProjectCardComponent, RouterLink, MatButtonModule, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  protected readonly apps = APPS;
  protected readonly experiments = EXPERIMENTS;
  protected readonly packages = PACKAGES;
  protected readonly t = inject(I18nService).texts;
}
