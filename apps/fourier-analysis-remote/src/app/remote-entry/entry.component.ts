import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  standalone: true,
  selector: 'wolsok-fourier-analysis-root',
  template: '<router-outlet/>',
  styleUrl: 'entry.component.scss',
  imports: [RouterOutlet],
})
export class RemoteEntryComponent {}
