import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'korb-root',
  imports: [MatToolbarModule, RouterLink, RouterOutlet],
  template: `
    <mat-toolbar>
      <a class="brand" routerLink="/">Korbjäger</a>
    </mat-toolbar>
    <main>
      <router-outlet />
    </main>
  `,
  styles: `
    .brand {
      color: inherit;
      text-decoration: none;
    }
    main {
      max-width: 48rem;
      margin: 0 auto;
      padding: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
