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
  decks: number | string | null;
  loser?: string | null;
};

type SessionRow = {
  player_id: string;
  game_id: string;
  hand: Array<{ suit: string; rank: string }>;
  connected: boolean;
  last_seen: string | null;
  turn_order: number | string | null;
  display_name?: string | null;
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
  private pendingPlayed: Record<string, number> = {};
  selectedRank: Rank = Rank.Ace;

  turnSeconds = 60;
  remainingSeconds = 60;
  private timerInterval?: number;
  private turnStartMs = 0;
  private serverOffsetMs = 0;
  currentTurnPlayerId = '';

  private gameChannel?: RealtimeChannel;
  private sessionChannel?: RealtimeChannel;
  private redirecting = false;
  showLeaveConfirm = false;
  private actionInFlight = false;
  showEndSplash = false;
  endCountdown = 10;
  private endTimerInterval?: number;

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

    await this.supabaseService.loadSession();
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
    if (this.endTimerInterval) {
      window.clearInterval(this.endTimerInterval);
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
      .select('id, host, stack, rank, turn_order, last_turn, status, decks')
      .eq('id', this.gameId)
      .single();

    if (!error) {
      const rawStack = (data as GameRow)?.stack ?? [];
      const normalizedStack = Array.isArray(rawStack)
        ? (rawStack
            .map((card) => this.normalizeCard(card as any))
            .filter(Boolean) as Array<{ suit: Suit; rank: Rank }>)
        : [];
      this.game = { ...(data as GameRow), stack: normalizedStack };
      this.logStackState();
      if (this.game?.status && this.game.status === 'standby') {
        await this.navigateToLobby();
      }
    }
  }

  private async loadSessions() {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('session_public')
      .select(
        'player_id, game_id, hand, connected, last_seen, turn_order, display_name'
      )
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
          await this.loadSessions();
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
    const currentTurnOrder = this.toNumber(this.game?.turn_order ?? null);

    if (newCurrentId && newCurrentId !== this.currentTurnPlayerId) {
      this.currentTurnPlayerId = newCurrentId;
      this.resetTurnTimer();
    }
    void currentTurnOrder;

    const currentUserId = this.currentUserId;

    const roundResolved =
      this.game?.last_turn === null && this.game?.rank === null;
    if (roundResolved) {
      this.pendingPlayed = {};
      this.selectedIndices.clear();
    }

    if (this.game?.status === 'finished') {
      this.startEndSplash();
    } else if (this.showEndSplash) {
      this.showEndSplash = false;
      if (this.endTimerInterval) {
        window.clearInterval(this.endTimerInterval);
        this.endTimerInterval = undefined;
      }
    }

    console.log(this.sessions);
    console.log(this.currentUserId);


    const ownSession = this.sessions.find(
      (session) => session.player_id === currentUserId
    );

    const serverHand = (ownSession?.hand ?? [])
      .map((card) => this.normalizeCard(card))
      .filter(Boolean) as Array<{ suit: Suit; rank: Rank }>;

    console.log('serverHand raw', ownSession?.hand ?? []);
    console.log('serverHand normalized', serverHand);
    this.handCards = this.applyPendingRemovals(serverHand);
    this.handCards = this.sortHand(this.handCards);
    this.prunePendingRemovals(serverHand);
    console.log('handCards final', this.handCards);

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

  private logStackState() {
    console.log('stack raw', this.game?.stack ?? []);
    console.log('stack count', this.stackCount);
  }

  get orderedSessions() {
    return [...this.sessions].sort(
      (a, b) => this.toNumber(a.turn_order) - this.toNumber(b.turn_order)
    );
  }

  get isCurrentPlayerTurn() {
    return (
      this.getCurrentTurnSession()?.player_id ===
      this.currentUserId
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
    return this.hasSelection ? 'Lay Cards' : 'Lay';
  }

  get showDeclaredRankSelect() {
    return this.isCurrentPlayerTurn && this.game?.rank === null;
  }

  get isRankLocked() {
    return (
      !this.showDeclaredRankSelect ||
      this.hasSelection ||
      !this.isCurrentPlayerTurn
    );
  }

  get canCallBullshit() {
    return (
      this.stackCount > 0 &&
      this.isCurrentPlayerTurn &&
      !this.actionInFlight &&
      !this.hasSelection
    );
  }

  get canLay() {
    return (
      this.isCurrentPlayerTurn &&
      !this.actionInFlight &&
      this.hasSelection
    );
  }

  get isActionInFlight() {
    return this.actionInFlight;
  }

  get hasSelection() {
    return this.selectedIndices.size > 0;
  }

  get maxLayCount() {
    const decks = this.toNumber(this.game?.decks ?? 1) || 1;
    return Math.max(1, decks * 3);
  }

  get hasAceSelected() {
    return Array.from(this.selectedIndices).some(
      (index) => this.handCards[index]?.rank === Rank.Ace
    );
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
      if (this.selectedIndices.size >= this.maxLayCount) {
        return;
      }
      this.selectedIndices.add(index);
    }
    this.ensureDeclaredRankValid();
  }

  isSelected(index: number) {
    return this.selectedIndices.has(index);
  }

  async callBullshit() {
    if (!this.isCurrentPlayerTurn) {
      return;
    }
    if (this.actionInFlight) {
      return;
    }
    if (!this.canCallBullshit) {
      return;
    }
    this.actionInFlight = true;
    try {
      await this.supabaseService.turnAction({
        gameId: this.gameId,
        callLiar: true,
      });
    } catch (error) {
      console.error('Call Bullshit failed:', error);
    } finally {
      this.actionInFlight = false;
    }
  }

  async primaryAction() {
    if (!this.isCurrentPlayerTurn) {
      return;
    }
    if (this.actionInFlight) {
      return;
    }
    this.actionInFlight = true;
    if (!this.hasSelection) {
      this.actionInFlight = false;
      return;
    }

    const cards = Array.from(this.selectedIndices).map(
      (index) => this.handCards[index]
    );

    try {
      await this.supabaseService.turnAction({
        gameId: this.gameId,
        cards: cards.map((card) => ({
          suit: this.toDbSuit(card.suit),
          rank: this.toDbRank(card.rank),
        })),
        declaredRank: this.toDbRank(this.selectedRank),
        callLiar: false,
      });
      this.trackPendingRemovals(cards);
      this.removeCardsFromHand(this.selectedIndices);
      this.selectedIndices.clear();
    } catch (error) {
      console.error('Lay cards failed:', error);
    } finally {
      this.actionInFlight = false;
    }
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
    if (playerId === this.currentUserId) {
      return this.supabaseService.player().displayName || 'You';
    }
    const session = this.sessions.find(
      (item) => item.player_id === playerId && item.display_name
    );
    if (session?.display_name) {
      return session.display_name;
    }
    const known = this.supabaseService
      .players()
      .find((player) => player.id === playerId);
    if (known?.displayName) {
      return known.displayName;
    }
    return `Player ${playerId.slice(0, 4)}`;
  }

  private normalizeCard(card: { suit?: string; rank?: string; f1?: string; f2?: string } | string) {
    if (typeof card === 'string') {
      const parsed = this.parseCardTuple(card);
      if (!parsed) {
        return null;
      }
      const suit = this.toSuit(parsed.suit);
      const rank = this.toRank(parsed.rank);
      if (!suit || !rank) {
        return null;
      }
      return { suit, rank };
    }
    const rawSuit = card.suit ?? card.f2;
    const rawRank = card.rank ?? card.f1;
    const suit = this.toSuit(rawSuit);
    const rank = this.toRank(rawRank);
    if (!suit || !rank) {
      return null;
    }
    return { suit, rank };
  }

  private toSuit(value?: string | null) {
    if (!value) {
      return null;
    }
    const normalized = value.toString().toLowerCase();
    const alias =
      normalized === 'spade'
        ? 'spades'
        : normalized === 'club'
        ? 'clubs'
        : normalized === 'diamond'
        ? 'diamonds'
        : normalized === 'heart'
        ? 'hearts'
        : normalized;
    const match = Object.values(Suit).find(
      (suit) => suit.toString().toLowerCase() === alias
    );
    return match ?? null;
  }

  private toRank(value?: string | null) {
    if (!value) {
      return null;
    }
    const normalized = value.toString().toLowerCase();
    const match = Object.values(Rank).find(
      (rank) => rank.toString().toLowerCase() === normalized
    );
    if (match) {
      return match;
    }
    switch (normalized) {
      case 'a':
        return Rank.Ace;
      case 'k':
        return Rank.King;
      case 'q':
        return Rank.Queen;
      case 'j':
        return Rank.Jack;
      case 'two':
        return Rank.Two;
      case 'three':
        return Rank.Three;
      case 'four':
        return Rank.Four;
      case 'five':
        return Rank.Five;
      case 'six':
        return Rank.Six;
      case 'seven':
        return Rank.Seven;
      case 'eight':
        return Rank.Eight;
      case 'nine':
        return Rank.Nine;
      case 'ten':
        return Rank.Ten;
      case 'jack':
        return Rank.Jack;
      case 'queen':
        return Rank.Queen;
      case 'king':
        return Rank.King;
      case 'ace':
        return Rank.Ace;
      case '02':
        return Rank.Two;
      case '03':
        return Rank.Three;
      case '04':
        return Rank.Four;
      case '05':
        return Rank.Five;
      case '06':
        return Rank.Six;
      case '07':
        return Rank.Seven;
      case '08':
        return Rank.Eight;
      case '09':
        return Rank.Nine;
      case '2':
        return Rank.Two;
      case '3':
        return Rank.Three;
      case '4':
        return Rank.Four;
      case '5':
        return Rank.Five;
      case '6':
        return Rank.Six;
      case '7':
        return Rank.Seven;
      case '8':
        return Rank.Eight;
      case '9':
        return Rank.Nine;
      case '10':
        return Rank.Ten;
      default:
        return null;
    }
  }

  private parseCardTuple(value: string) {
    const trimmed = value.trim();
    const match = /^\(([^,]+),([^)]+)\)$/.exec(trimmed);
    if (!match) {
      return null;
    }
    return {
      rank: match[1]?.trim(),
      suit: match[2]?.trim(),
    };
  }

  private get currentUserId() {
    return (
      this.supabaseService.player().id ||
      this.supabaseService.session()?.user?.id ||
      ''
    );
  }

  get isHost() {
    return this.currentUserId && this.game?.host === this.currentUserId;
  }

  async leaveGame() {
    if (!this.gameId) {
      return;
    }
    const playerId = this.currentUserId;
    if (playerId) {
      await this.supabaseService
        .getClient()
        .from('session')
        .delete()
        .eq('game_id', this.gameId)
        .eq('player_id', playerId);
    }
    await this.supabaseService.stopLobbyPresence();
    this.game = null;
    this.sessions = [];
    this.supabaseService.lobbyId.set('');
    await this.navigateToLobby();
  }

  openLeaveConfirm() {
    this.showLeaveConfirm = true;
  }

  closeLeaveConfirm() {
    this.showLeaveConfirm = false;
  }

  async endGame() {
    if (!this.gameId || !this.isHost) {
      return;
    }
    await this.supabaseService
      .getClient()
      .from('game')
      .update({
        status: 'standby',
        last_turn: null,
        rank: null,
        stack: [],
        discarded_cards: null,
      })
      .eq('id', this.gameId);
  }

  private async navigateToLobby() {
    if (this.redirecting) {
      return;
    }
    this.redirecting = true;
    const lobbyId = this.gameId || this.supabaseService.lobbyId();
    if (lobbyId) {
      await this.router.navigate(['/lobby', lobbyId]);
    } else {
      await this.router.navigate(['/menu']);
    }
    this.redirecting = false;
  }

  private startEndSplash() {
    if (this.showEndSplash) {
      return;
    }
    this.showEndSplash = true;
    this.endCountdown = 10;
    if (this.endTimerInterval) {
      window.clearInterval(this.endTimerInterval);
    }
    this.endTimerInterval = window.setInterval(() => {
      this.endCountdown = Math.max(0, this.endCountdown - 1);
      if (this.endCountdown <= 0) {
        if (this.endTimerInterval) {
          window.clearInterval(this.endTimerInterval);
          this.endTimerInterval = undefined;
        }
        void this.navigateToLobby();
      }
    }, 1000);
  }


  private sortHand(cards: Array<{ suit: Suit; rank: Rank }>) {
    const rankOrder: Rank[] = [
      Rank.Two,
      Rank.Three,
      Rank.Four,
      Rank.Five,
      Rank.Six,
      Rank.Seven,
      Rank.Eight,
      Rank.Nine,
      Rank.Ten,
      Rank.Jack,
      Rank.Queen,
      Rank.King,
      Rank.Ace,
    ];
    return [...cards].sort((a, b) => {
      return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
    });
  }

  private removeCardsFromHand(indices: Set<number>) {
    const removal = new Set(indices);
    const next = this.handCards.filter((_, index) => !removal.has(index));
    this.handCards = this.sortHand(next);
  }

  private cardKey(card: { suit: Suit; rank: Rank }) {
    return `${card.rank}-${card.suit}`;
  }

  private trackPendingRemovals(cards: Array<{ suit: Suit; rank: Rank }>) {
    for (const card of cards) {
      const key = this.cardKey(card);
      this.pendingPlayed[key] = (this.pendingPlayed[key] ?? 0) + 1;
    }
  }

  private applyPendingRemovals(hand: Array<{ suit: Suit; rank: Rank }>) {
    if (!Object.keys(this.pendingPlayed).length) {
      return hand;
    }
    const counts = { ...this.pendingPlayed };
    const result: Array<{ suit: Suit; rank: Rank }> = [];
    for (const card of hand) {
      const key = this.cardKey(card);
      if (counts[key]) {
        counts[key] -= 1;
      } else {
        result.push(card);
      }
    }
    return result;
  }

  private prunePendingRemovals(serverHand: Array<{ suit: Suit; rank: Rank }>) {
    if (!Object.keys(this.pendingPlayed).length) {
      return;
    }
    const counts: Record<string, number> = {};
    for (const card of serverHand) {
      const key = this.cardKey(card);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    for (const key of Object.keys(this.pendingPlayed)) {
      if (!counts[key]) {
        delete this.pendingPlayed[key];
      }
    }
  }

  private toDbSuit(suit: Suit) {
    switch (suit) {
      case Suit.Spades:
        return 'spade';
      case Suit.Clubs:
        return 'club';
      case Suit.Diamonds:
        return 'diamond';
      case Suit.Hearts:
        return 'heart';
      default:
        return suit;
    }
  }

  private toDbRank(rank: Rank) {
    switch (rank) {
      case Rank.Ace:
        return 'A';
      case Rank.King:
        return 'K';
      case Rank.Queen:
        return 'Q';
      case Rank.Jack:
        return 'J';
      case Rank.Ten:
        return '10';
      case Rank.Nine:
        return '9';
      case Rank.Eight:
        return '8';
      case Rank.Seven:
        return '7';
      case Rank.Six:
        return '6';
      case Rank.Five:
        return '5';
      case Rank.Four:
        return '4';
      case Rank.Three:
        return '3';
      case Rank.Two:
        return '2';
      default:
        return rank;
    }
  }

  clearSelection() {
    this.selectedIndices.clear();
    this.ensureDeclaredRankValid();
  }

  onDeclaredRankChange() {
    this.ensureDeclaredRankValid();
  }

  get availableRanks() {
    return this.ranks.filter((rank) => rank !== Rank.Ace);
  }

  private ensureDeclaredRankValid(force = false) {
    if (this.hasAceSelected && (this.selectedRank === Rank.Ace || force)) {
      this.selectedRank = Rank.King;
    }
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
