import { NgFor } from '@angular/common';
import { Component, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { collection, collectionData, Firestore } from '@angular/fire/firestore';
import { MatCardModule } from '@angular/material/card';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { HeroPoll } from './hero-poll';
import { HeroPollComponent } from './hero-poll.component';

@Component({
  standalone: true,
  imports: [HeroPollComponent, RouterModule, NgFor, MatCardModule],
  selector: 'rap-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  #firestore: Firestore = inject(Firestore);

  title = 'roll-a-polla';
  heroPolls: Signal<HeroPoll[]>;

  constructor() {
    const heroPollCollection = collection(this.#firestore, 'heroPolls');
    this.heroPolls = toSignal(collectionData(heroPollCollection) as Observable<HeroPoll[]>, { initialValue: [] });
  }
}
