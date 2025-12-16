import { Component, input } from '@angular/core';
import { Suit } from '../../api/types/suit';
import { Rank } from '../../api/types/rank';

@Component({
  selector: 'app-card',
  imports: [],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss'
})
export class CardComponent {
  suit = input.required<Suit>();
  rank = input.required<Rank>();
  degree = input<number>(0);
}
