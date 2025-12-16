import { Injectable } from '@angular/core';
import { Player } from '../api/entities/player';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  players: any[] = [];
  
}
