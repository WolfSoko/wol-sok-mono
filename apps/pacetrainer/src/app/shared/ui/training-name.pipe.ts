import { Injectable, Pipe, PipeTransform } from '@angular/core';
import { CountdownTarget } from '../model/training/training-name';

/** a new CountdownTarget without a German name fails to compile here */
const GERMAN_NAMES: Record<CountdownTarget, string> = {
  running: 'Joggen',
  sprint: 'Sprinten',
  recovery: 'Erholung',
  finished: 'Fertig',
};

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
    return name == null ? name : GERMAN_NAMES[name];
  }
}
