import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { blogPostPath } from '../blog/blog-post';
import { BLOG_POSTS } from '../blog/posts';
import { CAREER_SINCE } from '../career/career-since';
import { yearsSince } from '../career/career.model';
import { I18nService } from '../i18n/i18n.service';
import { ProjectCardComponent } from '../project-card/project-card.component';
import { APPS, EXPERIMENTS, PACKAGES } from '../projects';
import { RevealDirective } from '../reveal.directive';
import { HeroDotsComponent } from './hero-dots.component';

@Component({
  selector: 'wolsok-home',
  imports: [
    ProjectCardComponent,
    RouterLink,
    MatButtonModule,
    RevealDirective,
    HeroDotsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  protected readonly apps = APPS;
  protected readonly experiments = EXPERIMENTS;
  protected readonly packages = PACKAGES;
  /** The newest article, teased above the career. */
  protected readonly latestPost = BLOG_POSTS[0];
  protected readonly latestPostPath = blogPostPath(this.latestPost);
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.texts;
  protected readonly careerLead = computed(() =>
    this.i18n.fill(this.t().home.careerLead, {
      years: yearsSince(CAREER_SINCE, new Date().getFullYear()),
    })
  );
}
