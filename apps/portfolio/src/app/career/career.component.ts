import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  DOCUMENT,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { I18nService } from '../i18n/i18n.service';
import { RevealDirective } from '../reveal.directive';
import { SITE_URL } from '../seo.service';
import { CareerHeroComponent } from './career-hero.component';
import { CareerSkillsComponent } from './career-skills.component';
import { CareerTimelineComponent } from './career-timeline.component';
import { CAREER } from './career.data';
import { personJsonLd } from './json-ld';

const JSON_LD_ID = 'career-json-ld';

@Component({
  selector: 'wolsok-career',
  imports: [
    CareerHeroComponent,
    CareerTimelineComponent,
    CareerSkillsComponent,
    RevealDirective,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './career.component.html',
  styleUrl: './career.component.scss',
})
export class CareerComponent {
  protected readonly career = CAREER;
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.texts;

  /** The source line, with the profile's date in the active language. */
  protected readonly source = computed(() =>
    this.i18n.fill(this.t().career.source, {
      date: new Date(this.career.source.profileDate).toLocaleDateString(
        this.i18n.locale(),
        { dateStyle: 'long', timeZone: 'UTC' }
      ),
    })
  );

  public constructor() {
    const document = inject(DOCUMENT);
    if (!document.getElementById(JSON_LD_ID)) {
      const script = document.createElement('script');
      script.id = JSON_LD_ID;
      script.type = 'application/ld+json';
      script.text = personJsonLd(CAREER, `${SITE_URL}/career`);
      document.head.appendChild(script);
    }
  }
}
