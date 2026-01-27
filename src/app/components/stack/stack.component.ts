import { Component, input } from '@angular/core';
import { CardComponent } from "../card/card.component";
import { Rank } from '../../api/types/rank';
import { Suit } from '../../api/types/suit';

@Component({
  selector: 'app-stack',
  imports: [CardComponent],
  templateUrl: './stack.component.html',
  styleUrl: './stack.component.scss'
})
export class StackComponent {
  cards = input.required<Array<{ suit: Suit; rank: Rank; degree: number }>>();
}
