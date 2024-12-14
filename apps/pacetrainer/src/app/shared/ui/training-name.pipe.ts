import { Pipe, PipeTransform } from '@angular/core';
import { TrainingName } from '../model/training/training-name';

@Pipe({
  name: 'trainingName',
})
export class TrainingNamePipe implements PipeTransform {
  transform(name: TrainingName | null | undefined): string | null {
    if (name == null) {
      return null;
    }

    switch (name) {
      case 'sprint':
        return 'Sprinten';
      case 'recovery':
        return 'Erholung';
      case 'finished':
        return 'Fertig';
    }
  }
}
