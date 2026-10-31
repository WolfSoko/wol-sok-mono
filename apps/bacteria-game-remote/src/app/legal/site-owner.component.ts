import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SITE_OWNER } from '@wolsok/shared-legal';

/**
 * Who runs the site, as the legal pages name them: name, postal address
 * and email. The label before the email is the page's, as it is in the
 * page's language.
 */
@Component({
  selector: 'wolsok-site-owner',
  template: `
    <address class="contact">
      {{ owner.name }}<br />
      @for (line of owner.addressLines; track line) {
        {{ line }}<br />
      }
      {{ emailLabel() }}:
      <a href="mailto:{{ owner.email }}">{{ owner.email }}</a>
    </address>
  `,
  styles: `
    :host {
      display: block;
    }

    .contact {
      font-style: normal;
      line-height: 1.7;
      padding: 0.75rem 1rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--card);
    }

    a {
      color: var(--gold);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteOwnerComponent {
  public readonly emailLabel = input.required<string>();

  protected readonly owner = SITE_OWNER;
}
