import { RouterModule, Routes } from '@angular/router';
import { SelAngBrushComponent } from './sel-ang-brush/sel-ang-brush.component';
import { PageNotFoundComponent } from './pagenotfound/pagenotfound.component';
import { ReferenceComponent } from './reference/reference.component';
import { AboutComponent } from './about/about.component';

export const routes: Routes = [
  { path: '', component: SelAngBrushComponent },
  { path: 'reference', component: ReferenceComponent },
  { path: 'about', component: AboutComponent },
  { path: '**', component: PageNotFoundComponent }
];

export const AppRoutes = RouterModule.forRoot(routes);
