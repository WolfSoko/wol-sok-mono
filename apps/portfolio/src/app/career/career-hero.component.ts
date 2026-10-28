import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { I18nService } from '../i18n/i18n.service';
import { Career, countClients, yearsSince } from './career.model';

/** One number of the hero, counted up by CSS. */
interface Stat {
  value: number;
  label: string;
}

@Component({
  selector: 'wolsok-career-hero',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './career-hero.component.html',
  styleUrl: './career-hero.component.scss',
})
export class CareerHeroComponent {
  public readonly career = input.required<Career>();

  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.texts;
  protected readonly year = new Date().getFullYear();

  /** The year as a string, so it is not formatted as a number ("2,008"). */
  protected readonly eyebrow = computed(() =>
    this.i18n.fill(this.t().career.eyebrow, {
      since: String(this.career().profile.since),
    })
  );

  protected readonly stats = computed<Stat[]>(() => {
    const { profile, projects } = this.career();
    const t = this.t().career;
    return [
      { value: yearsSince(profile.since, this.year), label: t.statsYears },
      {
        value: yearsSince(profile.angularSince, this.year),
        label: t.statsAngular,
      },
      { value: projects.length, label: t.statsProjects },
      { value: countClients(projects), label: t.statsClients },
    ];
  });
}
