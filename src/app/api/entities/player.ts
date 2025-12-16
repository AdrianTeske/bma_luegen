import { Card } from "./card";

export class Player {
    id: string;
    displayName: string;
    hand: Card[];

    constructor(id: string, displayName: string) {
        this.id = id;
        this.displayName = displayName;
        this.hand = [];
    }
}