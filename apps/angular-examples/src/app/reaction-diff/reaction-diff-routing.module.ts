import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReactionDiffComponent } from './reaction-diff.component';

const routes: Routes = [
  {
    path: '',
    component: ReactionDiffComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReactionDiffRoutingModule {}
