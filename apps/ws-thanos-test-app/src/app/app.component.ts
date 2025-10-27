import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { WsThanosDirective } from '@wolsok/ws-thanos';

@Component({
  selector: 'app-root',
  imports: [WsThanosDirective],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  completedTests = signal<{ [key: string]: boolean }>({});

  onComplete(testId: string) {
    console.log(`Test ${testId} completed`);
    this.completedTests.update((tests) => ({ ...tests, [testId]: true }));
  }

  vaporizeMultiple(...directives: any[]) {
    directives.forEach((dir) => dir.vaporize(true));
  }
}
