import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'rap-create-poll',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './create-poll.component.html',
  styleUrl: './create-poll.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatePollComponent {}
