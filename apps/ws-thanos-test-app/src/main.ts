import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideWsThanosOptions, WsThanosDirective } from '@wolsok/ws-thanos';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [WsThanosDirective],
  template: `
    <div class="container">
      <h1>WsThanos Directive Test Application</h1>
      
      <div class="test-section">
        <h2>Test 1: Vaporize and Remove</h2>
        <div
          class="test-box"
          wsThanos
          #thanos1="thanos"
          data-testid="vaporize-remove"
          (wsThanosComplete)="onComplete('test1')"
        >
          <h3>Click the button to vaporize this element</h3>
          <p>This element will be removed from the DOM after vaporization.</p>
        </div>
        <button 
          (click)="thanos1.vaporize(true)"
          data-testid="btn-vaporize-remove"
          class="btn"
        >
          Vaporize and Remove
        </button>
        <p *ngIf="completedTests.test1" class="status" data-testid="status-test1">
          ✓ Test 1 Complete
        </p>
      </div>

      <div class="test-section">
        <h2>Test 2: Vaporize and Restore</h2>
        <div
          class="test-box"
          wsThanos
          #thanos2="thanos"
          data-testid="vaporize-restore"
          (wsThanosComplete)="onComplete('test2')"
        >
          <h3>Click the button to vaporize this element</h3>
          <p>This element will fade back in after vaporization.</p>
        </div>
        <button 
          (click)="thanos2.vaporize(false)"
          data-testid="btn-vaporize-restore"
          class="btn"
        >
          Vaporize and Restore
        </button>
        <p *ngIf="completedTests.test2" class="status" data-testid="status-test2">
          ✓ Test 2 Complete
        </p>
      </div>

      <div class="test-section">
        <h2>Test 3: Multiple Elements</h2>
        <div class="multi-test">
          <div
            class="test-box-small"
            wsThanos
            #thanos3a="thanos"
            data-testid="vaporize-multi-1"
          >
            Element 1
          </div>
          <div
            class="test-box-small"
            wsThanos
            #thanos3b="thanos"
            data-testid="vaporize-multi-2"
          >
            Element 2
          </div>
          <div
            class="test-box-small"
            wsThanos
            #thanos3c="thanos"
            data-testid="vaporize-multi-3"
          >
            Element 3
          </div>
        </div>
        <button 
          (click)="vaporizeMultiple(thanos3a, thanos3b, thanos3c)"
          data-testid="btn-vaporize-multi"
          class="btn"
        >
          Vaporize All
        </button>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    h1 {
      color: #333;
      text-align: center;
      margin-bottom: 3rem;
    }

    .test-section {
      margin-bottom: 3rem;
      padding: 2rem;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      background: #f9f9f9;
    }

    h2 {
      color: #555;
      margin-top: 0;
    }

    .test-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      border-radius: 8px;
      margin: 1rem 0;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .test-box h3 {
      margin-top: 0;
    }

    .test-box-small {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
      font-weight: bold;
    }

    .multi-test {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin: 1rem 0;
    }

    .btn {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.3s;
    }

    .btn:hover {
      background: #45a049;
    }

    .btn:active {
      transform: scale(0.98);
    }

    .status {
      color: #4CAF50;
      font-weight: bold;
      margin-top: 1rem;
    }
  `]
})
export class AppComponent {
  completedTests: { [key: string]: boolean } = {};

  onComplete(testId: string) {
    console.log(`Test ${testId} completed`);
    this.completedTests[testId] = true;
  }

  vaporizeMultiple(...directives: any[]) {
    directives.forEach(dir => dir.vaporize(true));
  }
}

bootstrapApplication(AppComponent, {
  providers: [
    provideWsThanosOptions({
      maxParticleCount: 500,
      animationLength: 1000,
      particleAcceleration: 1000
    })
  ]
}).catch((err) => console.error(err));
