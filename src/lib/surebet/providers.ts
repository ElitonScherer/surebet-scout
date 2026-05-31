export interface ProviderInfo {
  key: string;
  label: string;
  description: string;
  available: boolean; // false = em breve
  unsupportedMarketKeys: string[]; // mercados não suportados por este servidor
  unsupportedReason: Record<string, string>; // key → mensagem de aviso
}

export const PROVIDERS: ProviderInfo[] = [
  {
    key: "the-odds",
    label: "The Odds API",
    description: "100+ casas de apostas · Odds em tempo real",
    available: true,
    unsupportedMarketKeys: ["btts"],
    unsupportedReason: {
      btts: "\"Ambos Marcam\" (BTTS) não está disponível na The Odds API. Mercados válidos: h2h, spreads, totals, outrights.",
    },
  },
];

export const DEFAULT_PROVIDER_KEY = "the-odds";

export function getProviderByKey(key: string): ProviderInfo {
  return PROVIDERS.find((p) => p.key === key) ?? PROVIDERS[0];
}
