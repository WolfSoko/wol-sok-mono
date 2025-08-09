import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-shader-examples-remote-entry',
  template: `<router-outlet />`,
})
export class RemoteEntryComponent {}
