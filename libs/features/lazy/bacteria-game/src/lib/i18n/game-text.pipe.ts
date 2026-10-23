import { inject, Pipe, PipeTransform } from '@angular/core';
import { GameText, renderGameText } from './game-text';
import { I18nService } from './i18n.service';

/**
 * A game text in the active language, for templates:
 * `{{ award.hintText | gameText }}` - empty for none. Impure like the `t`
 * pipe, so it follows a switch of the language.
 */
@Pipe({ name: 'gameText', pure: false })
export class GameTextPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  public transform(text: GameText | null | undefined): string {
    return text == null
      ? ''
      : renderGameText(text, (key, params) => this.i18n.t(key, params));
  }
}
