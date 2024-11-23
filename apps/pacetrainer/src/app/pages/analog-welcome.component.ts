import { Component } from '@angular/core';

@Component({
  selector: 'pacetrainer-analog-welcome',
  standalone: true,
  styles: [
    `
      :host {
        font-family:
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          'Segoe UI',
          Roboto,
          'Helvetica Neue',
          Arial,
          'Noto Sans',
          sans-serif,
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji';
        display: flex;
        padding: 2rem 1rem 8rem;
        flex-direction: column;
        background: rgb(250 250 250);
        height: 100%;
      }
      a {
        color: inherit;
        text-decoration: inherit;
      }
      .main {
        margin: 0 auto;
        flex: 1 1 0;
      }

      .btn-container > * + * {
        margin-left: 1rem;
      }

      .lightBtn {
        transition-property: color, background-color, border-color,
          text-decoration-color, fill, stroke;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        transition-duration: 150ms;
        color: rgb(24, 24, 27);
        background: rgb(250 250 250);
        font-weight: 500;
        font-size: 0.875rem;
        line-height: 1.25rem;
        padding-left: 2rem;
        padding-right: 2rem;
        border-radius: 0.375rem;
        border: 1px solid rgb(229, 231, 235);
        justify-content: center;
        align-items: center;
        height: 2.75rem;
        display: inline-flex;
        cursor: pointer;
      }
      .lightBtn:hover {
        background-color: rgb(244 244 245);
      }
      .counter-section {
        padding-top: 2rem;
        padding-bottom: 2rem;
      }

      @media (min-width: 768px) {
        .counter-section {
          padding-top: 3rem;
          padding-bottom: 3rem;
        }
      }

      @media (min-width: 1024px) {
        .counter-section {
          padding-top: 6rem;
          padding-bottom: 6rem;
        }
      }
      .counter-container {
        text-align: center;
        gap: 1rem;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        max-width: 58rem;
        display: flex;
        margin-left: auto;
        margin-right: auto;
      }
      .counter-heading {
        color: #dd0031;
        line-height: 1.1;
        font-weight: 500;
        font-size: 1.875rem;
        margin: 0;
      }
      .counter-description {
        line-height: 1.5;
        max-width: 85%;
        margin: 0;
      }

      @media (min-width: 640px) {
        .counter-description {
          line-height: 1.75rem;
          font-size: 1.125rem;
        }
      }
      .count {
        margin-left: 0.25rem;
        font-family: Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
          monospace;
      }
    `,
  ],
  template: `
    <main class="main">
      <h1>Pace-Trainer</h1>
      <section id="counter-demo" class="section">
        <div class="counter-container">
          <h2 class="counter-heading">Counter</h2>
          <p class="counter-description">
            This is a simple interactive counter. Powered by Angular.
          </p>
          <button (click)="increment()" class="lightBtn">
            Count: <span class="count">{{ count }}</span>
          </button>
        </div>
      </section>
    </main>
  `,
})
export class AnalogWelcomeComponent {
  count = 0;
  increment() {
    this.count++;
  }
}
