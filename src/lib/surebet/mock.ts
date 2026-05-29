import type { SportEvent } from "./types";

// Mock data shaped exactly like The Odds API /v4/sports/{sport}/odds response.
// Contains a couple of intentional arbitrage opportunities so the UI can be validated.
export const MOCK_EVENTS: SportEvent[] = [
  {
    id: "evt_1",
    sport_key: "tennis_atp",
    sport_title: "ATP Tennis",
    commence_time: "2026-06-02T18:00:00Z",
    home_team: "Carlos Alcaraz",
    away_team: "Jannik Sinner",
    bookmakers: [
      {
        key: "bet365",
        title: "Bet365",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Carlos Alcaraz", price: 2.15 },
              { name: "Jannik Sinner", price: 1.75 },
            ],
          },
        ],
      },
      {
        key: "betfair",
        title: "Betfair",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Carlos Alcaraz", price: 2.05 },
              { name: "Jannik Sinner", price: 2.10 }, // surebet pair: 1/2.15 + 1/2.10 = 0.941
            ],
          },
        ],
      },
      {
        key: "pinnacle",
        title: "Pinnacle",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Carlos Alcaraz", price: 2.00 },
              { name: "Jannik Sinner", price: 1.95 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "evt_2",
    sport_key: "soccer_epl",
    sport_title: "EPL",
    commence_time: "2026-06-03T15:30:00Z",
    home_team: "Arsenal",
    away_team: "Chelsea",
    bookmakers: [
      {
        key: "bet365",
        title: "Bet365",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Arsenal", price: 2.20 },
              { name: "Chelsea", price: 3.40 },
              { name: "Draw", price: 3.30 },
            ],
          },
        ],
      },
      {
        key: "william_hill",
        title: "William Hill",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Arsenal", price: 2.10 },
              { name: "Chelsea", price: 3.60 },
              { name: "Draw", price: 3.20 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "evt_3",
    sport_key: "basketball_nba",
    sport_title: "NBA",
    commence_time: "2026-06-04T23:00:00Z",
    home_team: "Lakers",
    away_team: "Celtics",
    bookmakers: [
      {
        key: "bet365",
        title: "Bet365",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Lakers", price: 1.95 },
              { name: "Celtics", price: 1.95 },
            ],
          },
        ],
      },
      {
        key: "betfair",
        title: "Betfair",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Lakers", price: 2.20 },
              { name: "Celtics", price: 2.05 }, // 1/2.20 + 1/2.05 = 0.942
            ],
          },
        ],
      },
    ],
  },
];

export const MOCK_BOOKMAKERS = [
  { key: "bet365", title: "Bet365" },
  { key: "betfair", title: "Betfair" },
  { key: "pinnacle", title: "Pinnacle" },
  { key: "william_hill", title: "William Hill" },
];

export const MOCK_SPORTS = [
  { key: "all", title: "Todos os esportes" },
  { key: "tennis_atp", title: "Tênis (ATP)" },
  { key: "soccer_epl", title: "Futebol (EPL)" },
  { key: "basketball_nba", title: "Basquete (NBA)" },
];
