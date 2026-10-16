import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChatLiveStreamComponent } from '../core/chat-live-stream/chat-live-stream.component';
import { CreatePollComponent } from '../core/create-poll/create-poll.component';
import { FeaturedPollsComponent } from '../core/featured-polls/featured-polls.component';
import { HotPollsComponent } from '../core/hot-polls/hot-polls.component';
import { AppConfigPort } from '../ports/app-config.port';

type Step = { icon: string; title: string; text: string };

@Component({
  selector: 'rap-welcome',
  imports: [
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ChatLiveStreamComponent,
    CreatePollComponent,
    FeaturedPollsComponent,
    HotPollsComponent,
  ],
  styleUrl: './rollapolla-welcome.component.scss',
  templateUrl: './rollapolla-welcome.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RollapollaWelcomeComponent {
  protected readonly features = inject(AppConfigPort).features;
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
