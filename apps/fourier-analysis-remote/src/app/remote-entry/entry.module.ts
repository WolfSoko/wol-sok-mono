import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { RemoteEntryComponent } from './entry.component';
import { remoteRoutes } from './entry.routes';

@NgModule({
  imports: [RemoteEntryComponent, RouterModule.forChild(remoteRoutes)],
})
export class RemoteEntryModule {}
