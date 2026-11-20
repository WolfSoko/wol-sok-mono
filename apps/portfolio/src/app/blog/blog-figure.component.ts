import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { BlogFigure } from './blog-figure';

/** A picture of an article with its caption, loaded once it nears the view. */
@Component({
  selector: 'wolsok-blog-figure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure>
      <img
        [src]="figure().src"
        [width]="figure().width"
        [height]="figure().height"
        [alt]="i18n.pick(figure().alt)"
        loading="lazy"
        decoding="async"
      />
      <figcaption>{{ i18n.pick(figure().caption) }}</figcaption>
    </figure>
  `,
  styles: `
    :host {
      display: block;
      margin: 2rem 0;
    }

    figure {
      margin: 0;
    }

    img {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 1.25rem;
      border: 1px solid var(--line);
      box-shadow: 0 10px 30px var(--shadow);
    }

    figcaption {
      margin-top: 0.75rem;
      color: var(--muted);
      font-size: 0.9rem;
      line-height: 1.5;
    }
  `,
})
export class BlogFigureComponent {
  public readonly figure = input.required<BlogFigure>();
  protected readonly i18n = inject(I18nService);
}
