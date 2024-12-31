import { Injectable, Pipe, PipeTransform } from '@angular/core';
import { TrainingName } from '../model/training/training-name';

@Injectable({
  providedIn: 'root',
})
@Pipe({
  name: 'trainingName',
})
export class TrainingNamePipe implements PipeTransform {
  transform(name: TrainingName | null | undefined): string | null | undefined {
    if (name == null) {
      return name;
    }

    switch (name) {
      case 'running':
        return 'Joggen';
      case 'getready':
        return 'Bereit';
      case 'sprint':
        return 'Sprinten';
      case 'recovery':
        return 'Erholung';
      case 'finished':
        return 'Fertig';
    }
  }
}
