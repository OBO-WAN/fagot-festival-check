import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./app').then(module => module.App) },
  { path: 'organizacion', loadComponent: () => import('./organizer-dashboard').then(module => module.OrganizerDashboard) },
  { path: '**', redirectTo: '' },
];
