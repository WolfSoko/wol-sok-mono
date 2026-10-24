import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  MatSlideToggleChange,
  MatSlideToggleModule,
} from '@angular/material/slide-toggle';
import { FeatureFlag, FEATURES } from '../../../shared/app-config';
import { AdminPort } from '../../ports/admin.port';
import { AppConfigPort } from '../../ports/app-config.port';
import { AdminWrites } from './admin-writes';

/** Switches features on and off for every visitor, right away. */
@Component({
  selector: 'rap-admin-features',
  imports: [MatSlideToggleModule],
  template: `
    <p class="lead">
      Changes apply to every visitor at once; the Firestore rules enforce them
      too.
    </p>
    <ul class="list">
      @for (feature of features; track feature.flag) {
        <li class="item">
          <div class="body">
            <span class="title">{{ feature.label }}</span>
            <span class="meta">{{ feature.description }}</span>
          </div>
          <mat-slide-toggle
            [checked]="toggles()[feature.flag]"
            (change)="set(feature.flag, $event)"
            [aria-label]="feature.label"
            [attr.data-testid]="'feature-' + feature.flag"
          />
        </li>
      }
    </ul>
  `,
  styleUrl: './admin-list.scss',
  styles: `
    .item {
      padding-right: 1.25rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFeaturesComponent {
  private readonly admin = inject(AdminPort);
  private readonly writes = new AdminWrites();
  protected readonly features = FEATURES;
  protected readonly toggles = inject(AppConfigPort).features;

  protected async set(
    flag: FeatureFlag,
    { checked, source }: MatSlideToggleChange
  ): Promise<void> {
    const saved = await this.writes.saved(
      this.admin.setFeature(flag, checked),
      'The feature could not be switched.'
    );
    if (!saved) {
      source.checked = !checked;
    }
  }
}
