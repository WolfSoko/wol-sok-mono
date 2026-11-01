import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SiteOwnerComponent } from '@wolsok/shared-legal';

@Component({
  selector: 'wolsok-privacy',
  imports: [SiteOwnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './privacy.component.html',
  styleUrl: '../legal/legal-page.scss',
})
export class PrivacyComponent {}
