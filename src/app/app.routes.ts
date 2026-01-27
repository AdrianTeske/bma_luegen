import { Routes } from '@angular/router';
import { PlayingFieldComponent } from './pages/playing-field/playing-field.component';
import { MenuComponent } from './pages/menu/menu.component';
import { LobbyCreateComponent } from './pages/lobby-create/lobby-create.component';
import { LobbyJoinComponent } from './pages/lobby-join/lobby-join.component';
import { LobbyRoomComponent } from './pages/lobby-room/lobby-room.component';

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
    path: 'lobby/create',
    component: LobbyCreateComponent,
  },
  {
    path: 'lobby',
    component: LobbyRoomComponent,
  },
  {
    path: 'lobby/join',
    component: LobbyJoinComponent,
  },
  {
    path: 'lobby/join/:code',
    component: LobbyJoinComponent,
  },
  {
    path: 'lobby/:id',
    component: LobbyRoomComponent,
  },
  {
    path: 'lobby/:lobbyId',
    component: LobbyRoomComponent,
  },
  {
    path: 'play',
    component: PlayingFieldComponent, // Registration route
  },
];
