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

export type EventType = "all" | "upcoming" | "live";

/**
 * Fetch odds for a given sport key (or "upcoming" for all sports in the next 8h).
 * eventType controls time filtering:
 *   - "upcoming": only future events (commence_time > now)
 *   - "live":     only started events (commence_time <= now, up to 24h ago)
 *   - "all":      no time filter
 * Docs: https://the-odds-api.com/liveapi/guides/v4/#get-odds
 */
export const getOdds = createServerFn({ method: "POST" })
  .inputValidator((input: { sportKey: string; regions?: string; eventType?: string }) => ({
    sportKey: String(input.sportKey || "upcoming"),
    regions: String(input.regions || "eu,uk,us,au"),
    eventType: String(input.eventType || "all") as EventType,
  }))
  .handler(async ({ data }): Promise<{ events: SportEvent[]; remaining: string | null }> => {
    const apiKey = process.env.THE_ODDS_API_KEY;
    if (!apiKey) throw new Error("THE_ODDS_API_KEY is not configured");

    const now = new Date();

    const url = new URL(`${API_BASE}/sports/${data.sportKey}/odds/`);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", data.regions);
    url.searchParams.set("markets", "h2h");
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("dateFormat", "iso");

    if (data.eventType === "upcoming") {
      url.searchParams.set("commenceTimeFrom", now.toISOString());
    } else if (data.eventType === "live") {
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      url.searchParams.set("commenceTimeFrom", from.toISOString());
      url.searchParams.set("commenceTimeTo", now.toISOString());
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`The Odds API ${res.status}: ${text.slice(0, 200)}`);
    }

    const events = (await res.json()) as SportEvent[];
    const remaining = res.headers.get("x-requests-remaining");

    // Extra client-side guard to ensure only active events are shown
    const now2 = new Date();
    const filtered = events.filter((e) => {
      const t = new Date(e.commence_time);
      if (data.eventType === "upcoming") return t > now2;
      if (data.eventType === "live") return t <= now2;
      return true;
    });

    return { events: filtered, remaining };
  });
