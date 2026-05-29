import { createServerFn } from "@tanstack/react-start";
import type { SportEvent } from "./types";

const API_BASE = "https://api.the-odds-api.com/v4";

export interface SportInfo {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

/**
 * List active sports. Used to populate the sport filter dropdown.
 * Docs: https://the-odds-api.com/liveapi/guides/v4/#get-sports
 */
export const getSports = createServerFn({ method: "GET" }).handler(async () => {
  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) throw new Error("THE_ODDS_API_KEY is not configured");

  const res = await fetch(`${API_BASE}/sports/?apiKey=${apiKey}`);
  if (!res.ok) {
    throw new Error(`Falha ao buscar esportes (${res.status})`);
  }
  const sports = (await res.json()) as SportInfo[];
  // Hide outrights (futures/winners) — they don't fit 2-way/3-way h2h arbitrage cleanly
  return sports.filter((s) => s.active && !s.has_outrights);
});

/**
 * Fetch odds for a given sport key (or "upcoming" for all sports in the next 8h).
 * Docs: https://the-odds-api.com/liveapi/guides/v4/#get-odds
 */
export const getOdds = createServerFn({ method: "POST" })
  .inputValidator((input: { sportKey: string; regions?: string }) => ({
    sportKey: String(input.sportKey || "upcoming"),
    regions: String(input.regions || "eu,uk,us,au"),
  }))
  .handler(async ({ data }): Promise<{ events: SportEvent[]; remaining: string | null }> => {
    const apiKey = process.env.THE_ODDS_API_KEY;
    if (!apiKey) throw new Error("THE_ODDS_API_KEY is not configured");

    const url = new URL(`${API_BASE}/sports/${data.sportKey}/odds/`);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", data.regions);
    url.searchParams.set("markets", "h2h");
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("dateFormat", "iso");

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`The Odds API ${res.status}: ${text.slice(0, 200)}`);
    }

    const events = (await res.json()) as SportEvent[];
    const remaining = res.headers.get("x-requests-remaining");
    return { events, remaining };
  });
