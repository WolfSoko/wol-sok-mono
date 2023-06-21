import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'rap-welcome',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!--
     * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     This is a starter component and can be deleted.
     * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     Delete this file and get started with your project!
     * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     -->
    <style>
      #welcome {
        margin-top: 2.5rem;
      }
      #welcome h1 {
        font-size: 3rem;
        font-weight: 500;
        letter-spacing: -0.025em;
        line-height: 1;
      }
      #welcome span {
        display: block;
        font-size: 1.875rem;
        font-weight: 300;
        line-height: 2.25rem;
        margin-bottom: 0.5rem;
      }
    </style>
    <div class="wrapper">
      <div class="container">
        <!--  WELCOME  -->
        <div id="welcome">
          <h1>
            <span> Hello there, </span>
            Welcome to Roll-a-Polla!
          </h1>
        </div>
        <!--  MIDDLE CONTENT  -->
        <!--  COMMANDS  -->
      </div>
    </div>
  `,
  styles: [],
  encapsulation: ViewEncapsulation.None,
})
export class WelcomeComponent {}
