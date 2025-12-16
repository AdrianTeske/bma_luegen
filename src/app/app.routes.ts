import { Routes } from '@angular/router';
import { PlayingFieldComponent } from './components/playing-field/playing-field.component';
import { MenuComponent } from './components/menu/menu.component';

export const routes: Routes = [
    {
    path: '',
    redirectTo: '/menu',
    pathMatch: 'full',
  },
  {
    path: 'menu',
    component: MenuComponent, // Login route
  },
  {
    path: 'play',
    component: PlayingFieldComponent, // Registration route
  },
];
