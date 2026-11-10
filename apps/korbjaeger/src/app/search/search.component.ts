import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { ClubSearchComponent } from './club-search.component';

/**
 * The search for a Team to follow, three ways in: by its Verein's name,
 * through the Kind (its Verein, then marked in a Spiel's Kader), or
 * through its Liga (the wizard, `/team-einrichten`).
 */
@Component({
  selector: 'korb-search',
  imports: [MatButtonModule, MatCardModule, RouterLink, ClubSearchComponent],
  template: `
    <h1>Suchen</h1>
    <p>Finde ein Team, um ihm zu folgen.</p>
    <mat-card appearance="outlined" data-qa="weg-verein">
      <mat-card-header>
        <h2 mat-card-title>Über den Verein</h2>
      </mat-card-header>
      <mat-card-content>
        <p>Gib den Namen des Vereins ein und wähle dann sein Team.</p>
        <korb-club-search />
      </mat-card-content>
    </mat-card>
    <mat-card appearance="outlined" data-qa="weg-kind">
      <mat-card-header>
        <h2 mat-card-title>Über mein Kind</h2>
      </mat-card-header>
      <mat-card-content>
        <p>
          Such oben den Verein deines Kindes und folge seinem Team. Sobald es
          nach einem Spiel im Spielbericht steht, markierst du es im Kader des
          Spiels.
        </p>
      </mat-card-content>
    </mat-card>
    <mat-card appearance="outlined" data-qa="weg-liga">
      <mat-card-header>
        <h2 mat-card-title>Über die Liga</h2>
      </mat-card-header>
      <mat-card-content>
        <p>Schritt für Schritt über Verband, Altersklasse und Liga.</p>
      </mat-card-content>
      <mat-card-actions>
        <a matButton="outlined" routerLink="/team-einrichten">
          Team über die Liga suchen
        </a>
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    :host {
      display: grid;
      gap: 1rem;
    }
    h1,
    h2,
    p {
      margin: 0;
    }
    mat-card-content {
      display: grid;
      gap: 0.75rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchComponent {}
