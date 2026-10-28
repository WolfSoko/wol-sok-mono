import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { I18nService } from './i18n/i18n.service';
import { LANGUAGES } from './i18n/language';
import { SeoService } from './seo.service';
import { ThemeService } from './theme/theme.service';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule],
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

  protected themeLabel(): string {
    switch (this.theme.choice()) {
      case 'light':
        return this.t().nav.themeLight;
      case 'dark':
        return this.t().nav.themeDark;
      default:
        return this.t().nav.themeSystem;
    }
  }
}
