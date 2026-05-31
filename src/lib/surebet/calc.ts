import type { SportEvent, SurebetOpportunity, BestOdd } from "./types";
import type { MarketSpec } from "./markets";

function findBestOddsPerOutcome(
  event: SportEvent,
  selectedBookmakers: Set<string>,
  spec: MarketSpec,
): Map<string, BestOdd> {
  const best = new Map<string, BestOdd>();

  for (const bm of event.bookmakers) {
    if (!selectedBookmakers.has(bm.key)) continue;
    const market = bm.markets.find((m) => m.key === spec.apiMarket);
    if (!market) continue;

    let outcomes = market.outcomes;
    if (spec.point !== undefined) {
      outcomes = outcomes.filter((o) => o.point === spec.point);
    }

    for (const outcome of outcomes) {
      const current = best.get(outcome.name);
      if (!current || outcome.price > current.price) {
        best.set(outcome.name, { bookmaker: bm.title, price: outcome.price });
      }
    }
  }
  return best;
}

export function computeSurebet(
  event: SportEvent,
  selectedBookmakers: Set<string>,
  investment: number,
  spec: MarketSpec,
): SurebetOpportunity | null {
  const best = findBestOddsPerOutcome(event, selectedBookmakers, spec);
  if (best.size < 2) return null;

  let arb = 0;
  for (const { price } of best.values()) arb += 1 / price;

  if (arb >= 1) return null;

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

  const guaranteedPayout = investment / arb;
  const profitValue = guaranteedPayout - investment;
  const profitPercent = (1 / arb - 1) * 100;

  if (spec.apiMarket === "h2h") {
    const order = (name: string) => {
      if (name === event.home_team) return 0;
      if (name === event.away_team) return 2;
      return 1;
    };
    stakes.sort((a, b) => order(a.name) - order(b.name));
  }

  const entries = Array.from(best.entries());
  const bestHome = best.get(event.home_team) ?? entries[0][1];
  const bestAway = best.get(event.away_team) ?? entries[1]?.[1] ?? entries[0][1];
  const bestDraw = best.get("Draw");

  return {
    eventId: event.id,
    sport: event.sport_title,
    commenceTime: event.commence_time,
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    marketLabel: spec.label,
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
  spec: MarketSpec,
): SurebetOpportunity[] {
  const selected = new Set(selectedBookmakers);
  const filtered =
    sportFilter === "all" ? events : events.filter((e) => e.sport_key === sportFilter);

  return filtered
    .map((e) => computeSurebet(e, selected, investment, spec))
    .filter((o): o is SurebetOpportunity => o !== null)
    .sort((a, b) => b.profitPercent - a.profitPercent);
}
