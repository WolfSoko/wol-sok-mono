import { Component, computed, input } from '@angular/core';
import { Milliseconds } from '../../model/constants/time-utils';
import { TrainingTimePipe } from '../training-time.pipe';

@Component({
  selector: 'pacetrainer-countdown-circle',
  templateUrl: './count-down-circle.component.html',
  styleUrl: './count-down-circle.component.scss',
  imports: [TrainingTimePipe],
})
export class CountDownCircleComponent {
  timeLeft = input.required<Milliseconds>(); // milliseconds
  duration = input.required<Milliseconds>(); // milliseconds

  svgArc = computed(() => {
    const timeLeft: number = this.timeLeft() ?? this.duration();
    const rawFraction = timeLeft / this.duration();
    const fraction = rawFraction - (1 / this.duration()) * (1 - rawFraction);
    return describeArc(50, 50, 45, -90, 360 * fraction - 90);
  });
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  const d = [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(' ');

  return d;
}
