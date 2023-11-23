import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  selector: 'app-shader-examples-remote-entry',
  template: `<router-outlet />`,
})
export class RemoteEntryComponent {}
