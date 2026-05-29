import type { SportEvent, SurebetOpportunity, BestOdd } from "./types";

/**
 * For each outcome name in an event, find the bookmaker offering the highest odd
 * — restricted to the bookmakers the user selected.
 */
function findBestOddsPerOutcome(
  event: SportEvent,
  selectedBookmakers: Set<string>,
): Map<string, BestOdd> {
  const best = new Map<string, BestOdd>();

  for (const bm of event.bookmakers) {
    if (!selectedBookmakers.has(bm.key)) continue;
    const h2h = bm.markets.find((m) => m.key === "h2h");
    if (!h2h) continue;

    for (const outcome of h2h.outcomes) {
      const current = best.get(outcome.name);
      if (!current || outcome.price > current.price) {
        best.set(outcome.name, { bookmaker: bm.title, price: outcome.price });
      }
    }
  }
  return best;
}

/**
 * Compute the surebet opportunity for a single event, if it exists.
 * Supports 2-way (Home/Away) and 3-way (Home/Draw/Away) H2H markets.
 *
 * Formulas:
 *   Arb  = Σ (1 / Odd_i)
 *   Stake_i = Investment * (1 / Odd_i) / Arb
 * Profit is guaranteed only when Arb < 1.
 */
export function computeSurebet(
  event: SportEvent,
  selectedBookmakers: Set<string>,
  investment: number,
): SurebetOpportunity | null {
  const best = findBestOddsPerOutcome(event, selectedBookmakers);
  if (best.size < 2) return null;

  // Sum of inverse odds — the arbitrage factor.
  let arb = 0;
  for (const { price } of best.values()) arb += 1 / price;

  if (arb >= 1) return null; // no arbitrage

  const stakes = Array.from(best.entries()).map(([name, b]) => {
    const stake = (investment * (1 / b.price)) / arb;
    return {
      name,
      bookmaker: b.bookmaker,
      price: b.price,
      stake: Math.round(stake * 100) / 100,
      payout: Math.round(stake * b.price * 100) / 100,
    };
  });

  // Guaranteed payout (same for every outcome): investment / arb.
  const guaranteedPayout = investment / arb;
  const profitValue = guaranteedPayout - investment;
  const profitPercent = (1 / arb - 1) * 100;

  // Sort stakes so home comes first, away last, draw in the middle.
  const order = (name: string) => {
    if (name === event.home_team) return 0;
    if (name === event.away_team) return 2;
    return 1;
  };
  stakes.sort((a, b) => order(a.name) - order(b.name));

  const bestHome = best.get(event.home_team)!;
  const bestAway = best.get(event.away_team)!;
  const bestDraw = best.get("Draw");

  return {
    eventId: event.id,
    sport: event.sport_title,
    commenceTime: event.commence_time,
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    bestHome,
    bestAway,
    bestDraw,
    arb,
    profitPercent,
    profitValue,
    stakes,
  };
}

export function findOpportunities(
  events: SportEvent[],
  selectedBookmakers: string[],
  investment: number,
  sportFilter: string,
): SurebetOpportunity[] {
  const selected = new Set(selectedBookmakers);
  const filtered =
    sportFilter === "all" ? events : events.filter((e) => e.sport_key === sportFilter);

  return filtered
    .map((e) => computeSurebet(e, selected, investment))
    .filter((o): o is SurebetOpportunity => o !== null)
    .sort((a, b) => b.profitPercent - a.profitPercent);
}
