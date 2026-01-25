import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../components/card/card.component';
import { Rank } from '../../api/types/rank';
import { Suit } from '../../api/types/suit';
import { SupabaseService } from '../../services/supabase.service';

type GameRow = {
  id: string;
  host: string | null;
  stack: Array<{ suit: string; rank: string }>;
  rank: string | null;
  turn_order: number | string | null;
  last_turn: string | null;
  status: string;
};

type SessionRow = {
  player_id: string;
  game_id: string;
  hand: Array<{ suit: string; rank: string }>;
  connected: boolean;
  last_seen: string | null;
  turn_order: number | string | null;
};

@Component({
  selector: 'app-playing-field',
  standalone: true,
  imports: [CardComponent, FormsModule],
  templateUrl: './playing-field.component.html',
  styleUrl: './playing-field.component.scss',
})
export class PlayingFieldComponent {
  supabaseService = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  gameId = '';
  game: GameRow | null = null;
  sessions: SessionRow[] = [];
  handCards: Array<{ suit: Suit; rank: Rank }> = [];
  selectedIndices = new Set<number>();
  selectedRank: Rank = Rank.Ace;

  turnSeconds = 30;
  remainingSeconds = 30;
  private timerInterval?: number;
  private turnStartMs = 0;
  private serverOffsetMs = 0;
  currentTurnPlayerId = '';

  private gameChannel?: RealtimeChannel;
  private sessionChannel?: RealtimeChannel;

  get ranks() {
    return Object.values(Rank);
  }

  async ngOnInit() {
    const gameIdFromQuery =
      this.route.snapshot.queryParamMap.get('lobbyId') ?? '';
    const gameIdFromSignal = this.supabaseService.lobbyId();
    this.gameId = gameIdFromQuery || gameIdFromSignal;

    if (!this.gameId) {
      await this.router.navigate(['/menu']);
      return;
    }

    await this.loadGameState();
    await this.supabaseService.startLobbyPresence(this.gameId);
    await this.subscribeRealtime();
  }

  async ngOnDestroy() {
    if (this.gameChannel) {
      this.supabaseService.getClient().removeChannel(this.gameChannel);
    }
    if (this.sessionChannel) {
      this.supabaseService.getClient().removeChannel(this.sessionChannel);
    }
    if (this.timerInterval) {
      window.clearInterval(this.timerInterval);
    }
    await this.supabaseService.stopLobbyPresence();
  }

  private async loadGameState() {
    await this.loadGame();
    await this.loadSessions();
    this.updateDerivedState();
  }

  private async loadGame() {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('game')
      .select('id, host, stack, rank, turn_order, last_turn, status')
      .eq('id', this.gameId)
      .single();

    if (!error) {
      this.game = data as GameRow;
    }
  }

  private async loadSessions() {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('session')
      .select('player_id, game_id, hand, connected, last_seen, turn_order')
      .eq('game_id', this.gameId);

    if (!error) {
      this.sessions = (data ?? []) as SessionRow[];
    }
  }

  private async subscribeRealtime() {
    const client = this.supabaseService.getClient();

    this.gameChannel = client
      .channel(`game:${this.gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game', filter: `id=eq.${this.gameId}` },
        async () => {
          await this.loadGame();
          this.updateDerivedState();
        }
      )
      .subscribe();

    this.sessionChannel = client
      .channel(`session:${this.gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session',
          filter: `game_id=eq.${this.gameId}`,
        },
        async () => {
          await this.loadSessions();
          this.updateDerivedState();
        }
      )
      .subscribe();
  }

  private updateDerivedState() {
    const currentSession = this.getCurrentTurnSession();
    const newCurrentId = currentSession?.player_id ?? '';

    if (newCurrentId && newCurrentId !== this.currentTurnPlayerId) {
      this.currentTurnPlayerId = newCurrentId;
      this.resetTurnTimer();
    }

    const ownSession = this.sessions.find(
      (session) => session.player_id === this.supabaseService.player().id
    );

    this.handCards = (ownSession?.hand ?? [])
      .map((card) => this.normalizeCard(card))
      .filter(Boolean) as Array<{ suit: Suit; rank: Rank }>;

    if (!this.isCurrentPlayerTurn) {
      this.selectedIndices.clear();
    }

    if (this.game?.rank) {
      this.selectedRank = this.toRank(this.game.rank) ?? this.selectedRank;
    }
  }

  private resetTurnTimer() {
    if (this.timerInterval) {
      window.clearInterval(this.timerInterval);
    }

    const turnStartSource =
      (this.game?.last_turn && this.parseDate(this.game.last_turn)) ||
      (this.getCurrentTurnSession()?.last_seen &&
        this.parseDate(this.getCurrentTurnSession()?.last_seen ?? ''));

    if (turnStartSource) {
      this.serverOffsetMs = turnStartSource.getTime() - Date.now();
      this.turnStartMs = turnStartSource.getTime();
    } else {
      this.turnStartMs = Date.now() + this.serverOffsetMs;
    }

    this.tickTimer();
    this.timerInterval = window.setInterval(() => this.tickTimer(), 500);
  }

  private tickTimer() {
    const nowServer = Date.now() + this.serverOffsetMs;
    const elapsed = Math.max(0, (nowServer - this.turnStartMs) / 1000);
    this.remainingSeconds = Math.max(
      0,
      Math.ceil(this.turnSeconds - elapsed)
    );
  }

  get stackCount() {
    return this.game?.stack?.length ?? 0;
  }

  get stackCards() {
    const cardsToShow = Math.min(this.stackCount, 6);
    const degrees = [-8, -5, -2, 1, 4, 7];
    return Array.from({ length: cardsToShow }).map((_, index) => ({
      suit: Suit.Back,
      rank: Rank.Two,
      degree: degrees[index] ?? 0,
      top: index * 2,
      left: index * 2,
    }));
  }

  get orderedSessions() {
    return [...this.sessions].sort(
      (a, b) => this.toNumber(a.turn_order) - this.toNumber(b.turn_order)
    );
  }

  get isCurrentPlayerTurn() {
    return (
      this.getCurrentTurnSession()?.player_id ===
      this.supabaseService.player().id
    );
  }

  get currentPlayerName() {
    const currentId = this.getCurrentTurnSession()?.player_id ?? '';
    return this.getPlayerName(currentId);
  }

  get declaredRankLabel() {
    return this.game?.rank ? this.rankLabel(this.game.rank) : 'Any';
  }

  get primaryActionLabel() {
    if (this.stackCount > 0) {
      return this.hasSelection ? 'Lay Cards' : 'Call Bullshit';
    }
    return this.hasSelection ? 'Lay Cards' : 'Lie';
  }

  get primaryActionDisabled() {
    if (!this.isCurrentPlayerTurn) {
      return true;
    }
    if (this.stackCount === 0 && !this.hasSelection) {
      return true;
    }
    return false;
  }

  get hasSelection() {
    return this.selectedIndices.size > 0;
  }

  get currentSessionDisconnected() {
    return this.getCurrentTurnSession()?.connected === false;
  }

  toggleSelectCard(index: number) {
    if (!this.isCurrentPlayerTurn) {
      return;
    }
    if (this.selectedIndices.has(index)) {
      this.selectedIndices.delete(index);
    } else {
      this.selectedIndices.add(index);
    }
  }

  isSelected(index: number) {
    return this.selectedIndices.has(index);
  }

  async primaryAction() {
    if (!this.isCurrentPlayerTurn) {
      return;
    }
    if (this.stackCount > 0 && !this.hasSelection) {
      await this.supabaseService.turnAction({
        gameId: this.gameId,
        callLiar: true,
      });
      return;
    }

    if (!this.hasSelection) {
      return;
    }

    const cards = Array.from(this.selectedIndices).map(
      (index) => this.handCards[index]
    );

    await this.supabaseService.turnAction({
      gameId: this.gameId,
      cards: cards.map((card) => ({ suit: card.suit, rank: card.rank })),
      declaredRank: this.selectedRank,
      callLiar: false,
    });

    this.selectedIndices.clear();
  }

  private getCurrentTurnSession() {
    const currentOrder = this.toNumber(this.game?.turn_order ?? null);
    return this.sessions.find(
      (session) => this.toNumber(session.turn_order) === currentOrder
    );
  }

  getPlayerName(playerId: string) {
    if (!playerId) {
      return 'Unknown';
    }
    if (playerId === this.supabaseService.player().id) {
      return this.supabaseService.player().displayName || 'You';
    }
    const known = this.supabaseService
      .players()
      .find((player) => player.id === playerId);
    if (known?.displayName) {
      return known.displayName;
    }
    return `Player ${playerId.slice(0, 4)}`;
  }

  private normalizeCard(card: { suit?: string; rank?: string }) {
    const suit = this.toSuit(card.suit);
    const rank = this.toRank(card.rank);
    if (!suit || !rank) {
      return null;
    }
    return { suit, rank };
  }

  private toSuit(value?: string | null) {
    if (!value) {
      return null;
    }
    const match = Object.values(Suit).find(
      (suit) => suit.toString() === value
    );
    return match ?? null;
  }

  private toRank(value?: string | null) {
    if (!value) {
      return null;
    }
    const match = Object.values(Rank).find(
      (rank) => rank.toString() === value
    );
    return match ?? null;
  }

  rankLabel(value: string) {
    switch (value) {
      case Rank.Ace:
        return 'Ace';
      case Rank.King:
        return 'King';
      case Rank.Queen:
        return 'Queen';
      case Rank.Jack:
        return 'Jack';
      case Rank.Ten:
        return 'Ten';
      case Rank.Nine:
        return 'Nine';
      case Rank.Eight:
        return 'Eight';
      case Rank.Seven:
        return 'Seven';
      case Rank.Six:
        return 'Six';
      case Rank.Five:
        return 'Five';
      case Rank.Four:
        return 'Four';
      case Rank.Three:
        return 'Three';
      case Rank.Two:
        return 'Two';
      default:
        return value;
    }
  }

  private parseDate(value?: string | null) {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  toNumber(value: number | string | null | undefined) {
    if (value === null || value === undefined) {
      return 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
}
