import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslationKey } from './dictionaries';
import { I18nService } from './i18n.service';
import { TranslationParams } from './translation';

/**
 * A text in the active language, for templates:
 * `{{ 'settings.title' | t }}`, `{{ 'lobby.waiting' | t: { name } }}`.
 * Impure, so it runs again when the language changes; the template tracks
 * the language signal it reads, which marks the view for a check.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  public transform(key: TranslationKey, params?: TranslationParams): string {
    return this.i18n.t(key, params);
  }
}
