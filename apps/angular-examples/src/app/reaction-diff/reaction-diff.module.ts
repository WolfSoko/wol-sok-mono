import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { P5ViewComponent } from './p5-view/p5-view.component';
import { ReactionDiffRoutingModule } from './reaction-diff-routing.module';
import { ReactionDiffComponent } from './reaction-diff.component';
import { WeightsConfigComponent } from './weights-config/weights-config.component';

@NgModule({
  imports: [SharedModule, ReactionDiffRoutingModule, HttpClientModule],
  declarations: [
    ReactionDiffComponent,
    P5ViewComponent,
    WeightsConfigComponent,
  ],
  exports: [ReactionDiffComponent],
})
export class ReactionDiffModule {}
