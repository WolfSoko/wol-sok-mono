import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { InstallHint } from './install-hint';

/**
 * Suggests installing Korbjäger on the home screen, as
 * `InstallHint` decides: with "Installieren" where the browser
 * has an install dialog, with the way through the share menu on
 * iOS, and "Ausblenden" for good. Shows nothing where the app runs
 * installed.
 */
@Component({
  selector: 'korb-install-hint',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @let offer = hint.offer();
    @if (offer !== 'none') {
      <section aria-label="Als App installieren" data-qa="install-hint">
        @if (offer === 'install') {
          <p>
            Korbjäger als App auf dem Startbildschirm: mit einem Tipp da, auch
            ohne Netz.
          </p>
        } @else {
          <p>
            Korbjäger als App auf dem Home-Bildschirm: im Teilen-Menü
            <mat-icon aria-hidden="true" inline>ios_share</mat-icon> auf „Zum
            Home-Bildschirm“ tippen.
          </p>
        }
        <div class="buttons">
          @if (offer === 'install') {
            <button matButton="filled" type="button" (click)="install()">
              Installieren
            </button>
          }
          <button matButton type="button" (click)="dismiss()">
            Ausblenden
          </button>
        </div>
      </section>
    }
  `,
  styles: `
    section {
      display: grid;
      gap: 0.5rem;
      margin-block: 1rem;
      padding: 0.75rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    p {
      margin: 0;
    }
    .buttons {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallHintComponent {
  /**
   * What stays on the page once the hint goes with the focused button (the
   * home page's heading, with `tabindex="-1"`): focus moves there.
   */
  public readonly focusAfter = input<HTMLElement>();

  protected readonly hint = inject(InstallHint);

  public constructor() {
    inject(DestroyRef).onDestroy(this.hint.show());
  }

  protected install(): Promise<void> {
    const done = this.hint.install();
    this.focusAfter()?.focus();
    return done;
  }

  protected dismiss(): void {
    this.hint.dismiss();
    this.focusAfter()?.focus();
  }
}
