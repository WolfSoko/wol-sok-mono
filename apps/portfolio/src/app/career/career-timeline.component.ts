import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { CAREER_SINCE } from './career-since';
import { RevealDirective } from '../reveal.directive';
import { CareerProjectComponent } from './career-project.component';
import { CareerProject } from './career.model';

/** The engagements on a vertical line that draws itself as you scroll. */
@Component({
  selector: 'wolsok-career-timeline',
  imports: [CareerProjectComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="projects" aria-labelledby="projects-title">
      <h2 id="projects-title">{{ t().career.timeline }}</h2>
      <p class="intro">{{ i18n.fill(t().career.timelineIntro, { since }) }}</p>
      <ol class="timeline">
        <li class="line" aria-hidden="true"></li>
        @for (project of projects(); track project.id; let first = $first) {
          <li class="entry" [wolsokReveal]="0.05">
            <span class="dot" aria-hidden="true"></span>
            <span class="year" aria-hidden="true">{{ project.from }}</span>
            <wolsok-career-project [project]="project" [open]="first" />
          </li>
        }
      </ol>
    </section>
  `,
  styleUrl: './career-timeline.component.scss',
})
export class CareerTimelineComponent {
  public readonly projects = input.required<readonly CareerProject[]>();
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.texts;
  /** A string, so the year is not formatted as a number ("2,008"). */
  protected readonly since = String(CAREER_SINCE);
}
