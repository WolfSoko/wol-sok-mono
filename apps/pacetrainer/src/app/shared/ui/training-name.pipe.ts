import { Injectable, Pipe, PipeTransform } from '@angular/core';
import { CountdownTarget } from '../model/training/training-name';

@Injectable({
  providedIn: 'root',
})
@Pipe({
  name: 'trainingName',
})
export class TrainingNamePipe implements PipeTransform {
  public transform(name: CountdownTarget): string;
  public transform(
    name: CountdownTarget | null | undefined
  ): string | null | undefined;
  public transform(
    name: CountdownTarget | null | undefined
  ): string | null | undefined {
    if (name == null) {
      return name;
    }

    switch (name) {
      case 'running':
        return 'Joggen';
      case 'sprint':
        return 'Sprinten';
      case 'recovery':
        return 'Erholung';
      case 'finished':
        return 'Fertig';
      default: {
        // a new CountdownTarget without a German name fails to compile here
        const unnamed: never = name;
        return String(unnamed);
      }
    }
  }
}
