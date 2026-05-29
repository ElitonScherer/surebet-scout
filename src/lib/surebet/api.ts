import type { SportEvent } from "./types";
import { MOCK_EVENTS } from "./mock";

/**
 * Service layer. By default returns mocked data so the UI works without an API key.
 *
 * To use The Odds API for real:
 *   1. Get a free key at https://the-odds-api.com/
 *   2. Set VITE_ODDS_API_KEY in your environment (publishable — used from the client),
 *      OR move this call into a server function and use process.env.ODDS_API_KEY.
 *
 * Endpoint reference:
 *   GET https://api.the-odds-api.com/v4/sports/{sport}/odds/
 *       ?apiKey=...&regions=eu,uk&markets=h2h&oddsFormat=decimal
 */
export async function fetchOdds(sportKey: string): Promise<SportEvent[]> {
  const apiKey = import.meta.env.VITE_ODDS_API_KEY as string | undefined;

  if (!apiKey) {
    // Mocked path — simulate network latency for realistic UX.
    await new Promise((r) => setTimeout(r, 600));
    return MOCK_EVENTS;
  }

  const sport = sportKey === "all" ? "upcoming" : sportKey;
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds/`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "eu,uk,us");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`The Odds API error: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as SportEvent[];
}
