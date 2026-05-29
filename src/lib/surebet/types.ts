export interface Outcome {
  name: string;
  price: number;
}

export interface Market {
  key: string; // 'h2h'
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
  bestHome: BestOdd;
  bestAway: BestOdd;
  bestDraw?: BestOdd;
  arb: number; // sum of inverse odds
  profitPercent: number; // (1 - arb) * 100 over investment? we use (1/arb - 1)
  profitValue: number;
  stakes: { name: string; bookmaker: string; price: number; stake: number; payout: number }[];
}
