export interface Outcome {
  name: string;
  price: number;
  point?: number; // used by totals market (1.5, 2.5, etc.)
}

export interface Market {
  key: string; // 'h2h' | 'totals' | 'btts'
  outcomes: Outcome[];
}

export interface BookmakerOdds {
  key: string;
  title: string;
  markets: Market[];
}

export interface SportEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: BookmakerOdds[];
}

export interface BestOdd {
  bookmaker: string;
  price: number;
}

export interface SurebetOpportunity {
  eventId: string;
  sport: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  marketLabel: string;
  bestHome: BestOdd;
  bestAway: BestOdd;
  bestDraw?: BestOdd;
  arb: number;
  profitPercent: number;
  profitValue: number;
  stakes: { name: string; bookmaker: string; price: number; stake: number; payout: number }[];
}
