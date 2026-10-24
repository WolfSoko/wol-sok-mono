import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'wolsok-privacy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './privacy.component.html',
  styles: `
    :host {
      display: block;
      max-width: 70ch;
      padding: 3rem 0;
      line-height: 1.65;
    }
    h1 {
      font-size: 2.2rem;
      margin: 0 0 0.25rem;
    }
    h2 {
      font-size: 1.25rem;
      margin: 2rem 0 0.5rem;
    }
    p,
    li {
      color: var(--muted);
    }
    a {
      color: var(--text);
    }
  `,
})
export class PrivacyComponent {}
