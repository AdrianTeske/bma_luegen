import { Rank } from "../types/rank";
import { Suit } from "../types/suit";

export class Card {
    suit: Suit;
    rank: Rank;

    constructor(suit: Suit, rank: Rank) {
        this.suit = suit;
        this.rank = rank;
    }
}