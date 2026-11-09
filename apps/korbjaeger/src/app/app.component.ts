import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { FusszeileComponent } from './rechtliches/fusszeile.component';

@Component({
  selector: 'korb-root',
  imports: [
    FusszeileComponent,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    RouterLink,
    RouterOutlet,
  ],
  template: `
    <mat-toolbar>
      <a class="brand" routerLink="/">Korbjäger</a>
      @if (anmeldung) {
        <a
          matIconButton
          class="einstellungen"
          routerLink="/einstellungen"
          aria-label="Einstellungen"
          data-qa="einstellungen"
        >
          <mat-icon>settings</mat-icon>
        </a>
      }
    </mat-toolbar>
    <main>
      <router-outlet />
    </main>
    <korb-fusszeile />
  `,
  styles: `
    .brand {
      color: inherit;
      text-decoration: none;
    }
    .einstellungen {
      margin-left: auto;
    }
    main {
      max-width: 48rem;
      margin: 0 auto;
      padding: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  /** Whether this build offers the sign-in, and with it the settings. */
  protected readonly anmeldung = environment.anmeldung;
}
