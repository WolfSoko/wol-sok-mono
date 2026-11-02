import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { I18nService } from './i18n/i18n.service';
import { LANGUAGES } from './i18n/language';
import { SeoService } from './seo.service';
import { ThemeService } from './theme/theme.service';

@Component({
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatButtonToggleModule,
  ],
  selector: 'wolsok-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected readonly year = new Date().getFullYear();
  protected readonly languages = LANGUAGES;
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.texts;
  protected readonly theme = inject(ThemeService);

  public constructor() {
    inject(SeoService).init();
  }
}
