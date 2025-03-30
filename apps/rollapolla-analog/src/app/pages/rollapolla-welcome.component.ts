import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CreatePollComponent } from '../core/create-poll/create-poll.component';
import { ChatLiveStreamComponent } from '../core/chat-live-stream/chat-live-stream.component';

@Component({
  selector: 'rap-welcome',
  imports: [
    FormsModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    ChatLiveStreamComponent,
    CreatePollComponent,
  ],
  styleUrl: './rollapolla-welcome.component.scss',
  templateUrl: './rollapolla-welcome.component.html',
})
export class RollapollaWelcomeComponent {}
