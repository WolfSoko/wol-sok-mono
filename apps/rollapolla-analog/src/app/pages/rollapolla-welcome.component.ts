import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChatLiveStreamComponent } from '../core/chat-live-stream/chat-live-stream.component';
import { CreatePollComponent } from '../core/create-poll/create-poll.component';

type Step = { icon: string; title: string; text: string };

@Component({
  selector: 'rap-welcome',
  imports: [
    MatIconModule,
    MatProgressSpinnerModule,
    ChatLiveStreamComponent,
    CreatePollComponent,
  ],
  styleUrl: './rollapolla-welcome.component.scss',
  templateUrl: './rollapolla-welcome.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RollapollaWelcomeComponent {
  protected readonly steps: Step[] = [
    {
      icon: 'edit_note',
      title: 'Ask',
      text: 'Type a question and the answers to pick from.',
    },
    {
      icon: 'ios_share',
      title: 'Share',
      text: 'Send the link to friends, team or chat.',
    },
    {
      icon: 'insights',
      title: 'Watch',
      text: 'Results update live with every vote.',
    },
  ];
}
