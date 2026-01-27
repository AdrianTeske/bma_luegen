import { Component, input } from '@angular/core';
import { CardComponent } from "../card/card.component";
import { Suit } from '../../api/types/suit';
import { Rank } from '../../api/types/rank';

@Component({
  selector: 'app-player-hand',
  imports: [CardComponent],
  templateUrl: './player-hand.component.html',
  styleUrl: './player-hand.component.scss'
})
export class PlayerHandComponent {
  cards = input.required<Array<{ suit: Suit; rank: Rank }>>();
}
