import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer, Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons';
import { icon } from '@fortawesome/fontawesome-svg-core';
import { AccountComponent } from './core/account/account.component';

@Component({
  selector: 'rap-root',
  imports: [AccountComponent, RouterOutlet],
  template: `
    <header class="account-bar"><rap-account /></header>
    <router-outlet></router-outlet>
  `,
  styles: `
    .account-bar {
      display: flex;
      justify-content: flex-end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  constructor() {
    const svg = icon(faXTwitter).html.join('');
    inject(MatIconRegistry).addSvgIconLiteralInNamespace(
      'fa',
      'xTwitter',
      inject(DomSanitizer).bypassSecurityTrustHtml(svg)
    );
    inject(Title).setTitle('Polls for everyone | RollaPolla.com');
  }
}
