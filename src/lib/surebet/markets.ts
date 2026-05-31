export interface MarketSpec {
  key: string;
  apiMarket: string;
  point?: number;
  label: string;
  description: string;
}

export const MARKET_OPTIONS: MarketSpec[] = [
  {
    key: "h2h",
    apiMarket: "h2h",
    label: "1X2",
    description: "Vitória Time 1 / Empate / Vitória Time 2",
  },
  {
    key: "totals_1.5",
    apiMarket: "totals",
    point: 1.5,
    label: "O/U 1.5",
    description: "Over ou Under 1.5 gols",
  },
  {
    key: "totals_2.5",
    apiMarket: "totals",
    point: 2.5,
    label: "O/U 2.5",
    description: "Over ou Under 2.5 gols",
  },
  {
    key: "btts",
    apiMarket: "btts",
    label: "Ambos Marcam",
    description: "Ambos os times marcam (Sim / Não)",
  },
];

export function getMarketByKey(key: string): MarketSpec {
  return MARKET_OPTIONS.find((m) => m.key === key) ?? MARKET_OPTIONS[0];
}
