import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { InstallationsHinweis } from './installations-hinweis';

/**
 * Suggests installing Korbjäger on the home screen, as
 * `InstallationsHinweis` decides: with "Installieren" where the browser
 * has an install dialog, with the way through the share menu on
 * iOS, and "Ausblenden" for good. Shows nothing where the app runs
 * installed.
 */
@Component({
  selector: 'korb-installations-hinweis',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @let angebot = hinweis.angebot();
    @if (angebot !== 'keins') {
      <section
        aria-label="Als App installieren"
        data-qa="installations-hinweis"
      >
        @if (angebot === 'installieren') {
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
        <div class="knoepfe">
          @if (angebot === 'installieren') {
            <button matButton="filled" type="button" (click)="installieren()">
              Installieren
            </button>
          }
          <button matButton type="button" (click)="ablehnen()">
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
    .knoepfe {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallationsHinweisComponent {
  /**
   * What stays on the page once the hint goes with the focused button (the
   * home page's heading, with `tabindex="-1"`): focus moves there.
   */
  public readonly fokusDanach = input<HTMLElement>();

  protected readonly hinweis = inject(InstallationsHinweis);

  public constructor() {
    inject(DestroyRef).onDestroy(this.hinweis.anzeigen());
  }

  protected installieren(): Promise<void> {
    const fertig = this.hinweis.installieren();
    this.fokusDanach()?.focus();
    return fertig;
  }

  protected ablehnen(): void {
    this.hinweis.ablehnen();
    this.fokusDanach()?.focus();
  }
}
