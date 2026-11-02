import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { RevealDirective } from '../reveal.directive';
import { CareerProject, SkillGroup } from './career.model';

/** The toolbox: a ticker of what the projects used, and the groups. */
@Component({
  selector: 'wolsok-career-skills',
  imports: [RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './career-skills.component.html',
  styleUrl: './career-skills.component.scss',
})
export class CareerSkillsComponent {
  public readonly skills = input.required<readonly SkillGroup[]>();
  public readonly projects = input.required<readonly CareerProject[]>();

  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.texts;

  /** Every technology a project names, most recent first, each once. */
  protected readonly ticker = computed(() => [
    ...new Set(this.projects().flatMap((project) => project.technologies)),
  ]);
}
