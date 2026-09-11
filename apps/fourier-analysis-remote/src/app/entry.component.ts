import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'wolsok-fourier-analysis-root',
  template: '<router-outlet/>',
  styleUrl: 'entry.component.scss',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemoteEntryComponent {}
