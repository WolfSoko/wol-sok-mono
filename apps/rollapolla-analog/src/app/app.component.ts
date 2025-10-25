import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer, Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons';
import { icon } from '@fortawesome/fontawesome-svg-core';

@Component({
  selector: 'rap-root',
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
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
