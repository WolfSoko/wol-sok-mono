import { CommonModule } from '@angular/common';
import { Component, Input, ViewEncapsulation } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { HeroPoll } from './hero-poll';

@Component({
  selector: 'rap-hero-poll',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  template: `
    <mat-card>
      <mat-card-title
        ><h2>{{ poll.title }}</h2></mat-card-title
      >
    </mat-card>
  `,
  styles: [],
  encapsulation: ViewEncapsulation.None,
})
export class HeroPollComponent {
  @Input({ required: true }) poll: HeroPoll = { title: 'loading', id: '' };
}
