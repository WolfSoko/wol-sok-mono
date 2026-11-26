import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { RevealDirective } from '../reveal.directive';
import { OwnProject } from './career.model';

/** The profile's own projects: a card each, linking to where it runs. */
@Component({
  selector: 'wolsok-career-own-projects',
  imports: [RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './career-own-projects.component.html',
  styleUrl: './career-own-projects.component.scss',
})
export class CareerOwnProjectsComponent {
  public readonly projects = input.required<readonly OwnProject[]>();

  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.texts;

  /** The address the link shows: the host alone. */
  protected host(url: string): string {
    return new URL(url).host;
  }
}
