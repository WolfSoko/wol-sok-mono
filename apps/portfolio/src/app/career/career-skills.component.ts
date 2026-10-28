import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { RevealDirective } from '../reveal.directive';
import { CareerProfile, CareerProject } from './career.model';

/** The toolbox: a ticker of what the projects used, and the groups. */
@Component({
  selector: 'wolsok-career-skills',
  imports: [RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './career-skills.component.html',
  styleUrl: './career-skills.component.scss',
})
export class CareerSkillsComponent {
  public readonly profile = input.required<CareerProfile>();
  public readonly projects = input.required<readonly CareerProject[]>();

  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.texts;

  /** Every technology a project names, most recent first, each once. */
  protected readonly ticker = computed(() => [
    ...new Set(this.projects().flatMap((project) => project.technologies)),
  ]);
}
