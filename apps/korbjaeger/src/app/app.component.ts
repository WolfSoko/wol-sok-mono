import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TitleBarComponent } from './navigation/title-bar.component';
import { FooterComponent } from './legal/footer.component';

@Component({
  selector: 'korb-root',
  imports: [FooterComponent, RouterOutlet, TitleBarComponent],
  template: `
    <korb-title-bar />
    <main>
      <router-outlet />
    </main>
    <korb-footer />
  `,
  styles: `
    main {
      max-width: 48rem;
      margin: 0 auto;
      padding: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
