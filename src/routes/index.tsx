import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  TrendingUp,
  Search,
  Loader2,
  AlertCircle,
  Sparkles,
  Trophy,
  Settings,
  Bot,
  StopCircle,
  Send,
  Timer,
  Play,
  Plus,
  Server,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { getOdds, getSports, type SportInfo, type EventType } from "@/lib/surebet/odds.functions";
import { findOpportunities } from "@/lib/surebet/calc";
import { MARKET_OPTIONS, getMarketByKey, buildApiMarketsParam } from "@/lib/surebet/markets";
import { PROVIDERS, getProviderByKey, DEFAULT_PROVIDER_KEY } from "@/lib/surebet/providers";
import { sendTelegramMessage } from "@/lib/telegram.server";
import type { SurebetOpportunity, SportEvent } from "@/lib/surebet/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Surebet Finder — Arbitragem Esportiva" },
      {
        name: "description",
        content:
          "Encontre oportunidades reais de arbitragem esportiva com lucro garantido.",
      },
    ],
  }),
  component: Index,
});

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface SportGroup {
  group: string;
  items: SportInfo[];
}

interface BookmakerEntry {
  key: string;
  title: string;
  br: boolean;
}

const BRAZIL_BOOKMAKERS: BookmakerEntry[] = [
  { key: "betano",        title: "Betano",       br: true },
  { key: "superbet",      title: "Superbet",     br: true },
  { key: "pinnacle",      title: "Pinnacle",     br: true },
  { key: "betfair_ex_eu", title: "Betfair",      br: true },
  { key: "betmgm",        title: "BetMGM",       br: true },
  { key: "bet365",        title: "Bet365",       br: true },
  { key: "sportingbet",   title: "Sportingbet",  br: true },
  { key: "novibet",       title: "Novibet",      br: true },
  { key: "unibet_eu",     title: "Unibet",       br: true },
  { key: "williamhill",   title: "William Hill", br: true },
  { key: "1xbet",         title: "1xBet",        br: true },
  { key: "bwin",          title: "Bwin",         br: true },
];

interface BotConfig {
  id: string;
  token: string;
  chatId: string;
  duration: number;
  running: boolean;
  timeLeft: number;
  sentCount: number;
  error: string | null;
  endTime: number | null;
}

function makeBotId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function formatForTelegram(opp: SurebetOpportunity, investment: number): string {
  const date = new Date(opp.commenceTime).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const stakes = opp.stakes
    .map((s) => `• ${s.name} @ ${s.price.toFixed(2)} — <b>${s.bookmaker}</b> → ${currency(s.stake)}`)
    .join("\n");

  return [
    `🎯 <b>SUREBET ENCONTRADA!</b>`,
    ``,
    `⚽ ${opp.sport} | ${opp.marketLabel}`,
    `🏟️ <b>${opp.homeTeam}</b> vs <b>${opp.awayTeam}</b>`,
    `📅 ${date}`,
    ``,
    `💰 Lucro: <b>+${opp.profitPercent.toFixed(2)}%</b> (${currency(opp.profitValue)})`,
    `💵 Investimento: ${currency(investment)}`,
    ``,
    `📌 <b>Apostas:</b>`,
    stakes,
  ].join("\n");
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function Index() {
  const fetchOdds = useServerFn(getOdds);
  const fetchSports = useServerFn(getSports);
  const sendTelegram = useServerFn(sendTelegramMessage);

  // ── Bookmakers ──────────────────────────────────────────────────────────
  const [bookmakerList, setBookmakerList] = useState<BookmakerEntry[]>(BRAZIL_BOOKMAKERS);
  const [selectedBookies, setSelectedBookies] = useState<string[]>(
    BRAZIL_BOOKMAKERS.map((b) => b.key),
  );

  // ── Event type & sport ───────────────────────────────────────────────────
  const [eventType, setEventType] = useState<EventType>("all");
  const [sport, setSport] = useState<string>("upcoming");
  const [sports, setSports] = useState<SportInfo[]>([]);
  const [loadingSports, setLoadingSports] = useState(true);

  // ── Provider / server ────────────────────────────────────────────────────
  const [selectedProvider, setSelectedProvider] = useState<string>(DEFAULT_PROVIDER_KEY);

  // ── Markets (multi-select) ────────────────────────────────────────────────
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(["h2h"]);

  // ── Investment & search ──────────────────────────────────────────────────
  const [investment, setInvestment] = useState<number>(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SurebetOpportunity[] | null>(null);
  const [remaining, setRemaining] = useState<string | null>(null);
  const [lastEventCount, setLastEventCount] = useState<number>(0);
  const [rawEvents, setRawEvents] = useState<SportEvent[]>([]);

  // ── Telegram Bot ─────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsProvider, setSettingsProvider] = useState<string>(DEFAULT_PROVIDER_KEY);
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [creatingBot, setCreatingBot] = useState(false);
  const [newBotToken, setNewBotToken] = useState("");
  const [newBotChatId, setNewBotChatId] = useState("");
  const [newBotDuration, setNewBotDuration] = useState<number>(60);
  const [newBotError, setNewBotError] = useState<string | null>(null);
  const [expandedBotId, setExpandedBotId] = useState<string | null>(null);
  const botsRef = useRef<BotConfig[]>([]);
  useEffect(() => { botsRef.current = bots; }, [bots]);



  // ── Load sports ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetchSports()
      .then((s) => { if (!cancelled) setSports(s); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar esportes"); })
      .finally(() => !cancelled && setLoadingSports(false));
    return () => { cancelled = true; };
  }, [fetchSports]);

  const sportGroups: SportGroup[] = useMemo(() => {
    const map = new Map<string, SportInfo[]>();
    for (const s of sports) {
      if (!map.has(s.group)) map.set(s.group, []);
      map.get(s.group)!.push(s);
    }
    return Array.from(map.entries())
      .map(([group, items]) => ({ group, items }))
      .sort((a, b) => a.group.localeCompare(b.group));
  }, [sports]);

  const totalProfit = useMemo(
    () => results?.reduce((acc, r) => acc + r.profitValue, 0) ?? 0,
    [results],
  );

  // ── Bookmaker helpers ────────────────────────────────────────────────────
  const brBookmakers = bookmakerList.filter((b) => b.br);
  const otherBookmakers = bookmakerList.filter((b) => !b.br);

  const recompute = (events: SportEvent[], selection: string[], mKeys = selectedMarkets) => {
    const allOpps = mKeys.flatMap((key) =>
      findOpportunities(events, selection, investment, "all", getMarketByKey(key)),
    );
    allOpps.sort((a, b) => b.profitPercent - a.profitPercent);
    setResults(allOpps);
  };

  const handleBookieToggle = (key: string) => {
    const next = selectedBookies.includes(key)
      ? selectedBookies.filter((k) => k !== key)
      : [...selectedBookies, key];
    setSelectedBookies(next);
    if (rawEvents.length > 0) recompute(rawEvents, next);
  };

  const handleSelectAll = () => {
    const all = bookmakerList.map((b) => b.key);
    setSelectedBookies(all);
    if (rawEvents.length > 0) recompute(rawEvents, all);
  };
  const handleClearAll = () => {
    setSelectedBookies([]);
    if (rawEvents.length > 0) recompute(rawEvents, []);
  };
  const handleSelectBrOnly = () => {
    const brOnly = bookmakerList.filter((b) => b.br).map((b) => b.key);
    setSelectedBookies(brOnly);
    if (rawEvents.length > 0) recompute(rawEvents, brOnly);
  };

  // ── Provider change ──────────────────────────────────────────────────────
  const handleProviderChange = (key: string) => {
    setSelectedProvider(key);
    const provider = getProviderByKey(key);
    const valid = selectedMarkets.filter((mk) => !provider.unsupportedMarketKeys.includes(mk));
    const next = valid.length > 0 ? valid : ["h2h"];
    setSelectedMarkets(next);
    if (rawEvents.length > 0) recompute(rawEvents, selectedBookies, next);
  };

  // ── Market toggle (multi-select) ─────────────────────────────────────────
  const handleMarketToggle = (key: string) => {
    const provider = getProviderByKey(selectedProvider);
    if (provider.unsupportedMarketKeys.includes(key)) return; // blocked by provider
    const next = selectedMarkets.includes(key)
      ? selectedMarkets.filter((k) => k !== key).length > 0
        ? selectedMarkets.filter((k) => k !== key)
        : selectedMarkets // prevent deselecting the last one
      : [...selectedMarkets, key];
    setSelectedMarkets(next);
    if (rawEvents.length > 0) recompute(rawEvents, selectedBookies, next);
  };

  // ── Search ───────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!investment || investment <= 0) throw new Error("Informe um valor de investimento válido.");
      if (selectedMarkets.length === 0) throw new Error("Selecione ao menos um mercado.");

      // Use bookmakers param for quota efficiency (per docs: each 10 bookies = 1 region)
      const apiMarkets = buildApiMarketsParam(selectedMarkets);
      const { events, remaining: rem } = await fetchOdds({
        data: {
          sportKey: sport,
          eventType,
          market: apiMarkets,
          bookmakers: selectedBookies.join(","),
        },
      });
      setRemaining(rem);
      setLastEventCount(events.length);
      setRawEvents(events as SportEvent[]);

      // Discover any extra bookmakers returned and merge into list
      const bmMap = new Map<string, string>();
      for (const ev of events as SportEvent[])
        for (const bm of ev.bookmakers) bmMap.set(bm.key, bm.title);

      const merged = new Map<string, BookmakerEntry>();
      for (const b of BRAZIL_BOOKMAKERS) merged.set(b.key, b);
      for (const [key, title] of bmMap.entries())
        if (!merged.has(key)) merged.set(key, { key, title, br: false });

      const sortedList = Array.from(merged.values()).sort((a, b) => {
        if (a.br && !b.br) return -1;
        if (!a.br && b.br) return 1;
        return a.title.localeCompare(b.title);
      });
      setBookmakerList(sortedList);

      // Run calc for each selected market spec, merge + sort results
      const allOpps = selectedMarkets.flatMap((key) =>
        findOpportunities(events as SportEvent[], selectedBookies, investment, "all", getMarketByKey(key)),
      );
      allOpps.sort((a, b) => b.profitPercent - a.profitPercent);
      setResults(allOpps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  // ── Telegram Bot (multi) ─────────────────────────────────────────────────
  const stopBot = (id: string) => {
    setBots((prev) => prev.map((b) => b.id === id ? { ...b, running: false, endTime: null } : b));
  };

  const resumeBot = (id: string) => {
    setBots((prev) => prev.map((b) => {
      if (b.id !== id) return b;
      const endTime = b.duration > 0 ? Date.now() + b.duration * 60 * 1000 : null;
      return { ...b, running: true, endTime, timeLeft: b.duration * 60, error: null };
    }));
  };

  // Per-bot tick effect — runs whenever bots list changes
  useEffect(() => {
    const runningBots = bots.filter((b) => b.running);
    if (runningBots.length === 0) return;

    const intervals: ReturnType<typeof setInterval>[] = [];

    for (const bot of runningBots) {
      const tick = async () => {
        const current = botsRef.current.find((b) => b.id === bot.id);
        if (!current?.running) return;

        const apiMarkets = buildApiMarketsParam(selectedMarkets);
        try {
          const { events } = await fetchOdds({
            data: {
              sportKey: sport,
              eventType,
              market: apiMarkets,
              bookmakers: selectedBookies.join(","),
            },
          });
          const opps = selectedMarkets.flatMap((key) =>
            findOpportunities(events as SportEvent[], selectedBookies, investment, "all", getMarketByKey(key)),
          );
          opps.sort((a, b) => b.profitPercent - a.profitPercent);
          for (const opp of opps) {
            const msg = formatForTelegram(opp, investment);
            await sendTelegram({ data: { token: current.token, chatId: current.chatId, message: msg } });
          }
          setBots((prev) => prev.map((b) =>
            b.id === current.id ? { ...b, sentCount: b.sentCount + opps.length, error: null } : b,
          ));
        } catch (e) {
          setBots((prev) => prev.map((b) =>
            b.id === current.id ? { ...b, error: e instanceof Error ? e.message : "Erro no bot." } : b,
          ));
        }

        // Check expiry
        setBots((prev) => prev.map((b) => {
          if (b.id !== current.id || !b.endTime) return b;
          if (Date.now() >= b.endTime) return { ...b, running: false, endTime: null };
          return b;
        }));
      };

      tick();
      intervals.push(setInterval(tick, 60_000));
    }

    return () => intervals.forEach(clearInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots.map((b) => `${b.id}:${b.running}`).join(",")]);

  // Countdown timers
  useEffect(() => {
    const hasRunning = bots.some((b) => b.running && b.endTime !== null);
    if (!hasRunning) return;
    const id = setInterval(() => {
      setBots((prev) => prev.map((b) => {
        if (!b.running || !b.endTime) return b;
        const left = Math.max(0, Math.ceil((b.endTime - Date.now()) / 1000));
        if (left <= 0) return { ...b, running: false, endTime: null, timeLeft: 0 };
        return { ...b, timeLeft: left };
      }));
    }, 1000);
    return () => clearInterval(id);
  }, [bots]);

  const createBot = () => {
    if (!newBotToken || !newBotChatId) {
      setNewBotError("Preencha o Token e o Chat ID.");
      return;
    }
    const id = makeBotId();
    const endTime = newBotDuration > 0 ? Date.now() + newBotDuration * 60 * 1000 : null;
    const newBot: BotConfig = {
      id,
      token: newBotToken,
      chatId: newBotChatId,
      duration: newBotDuration,
      running: true,
      timeLeft: newBotDuration * 60,
      sentCount: 0,
      error: null,
      endTime,
    };
    setBots((prev) => [...prev, newBot]);
    setNewBotToken("");
    setNewBotChatId("");
    setNewBotDuration(60);
    setNewBotError(null);
    setCreatingBot(false);
  };

  const anyBotRunning = bots.some((b) => b.running);



  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/60 backdrop-blur-md sticky top-0 z-10 bg-background/70">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-[image:var(--gradient-profit)] text-primary-foreground shadow-[var(--shadow-glow)]">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">Surebet Finder</h1>
              <p className="text-xs text-muted-foreground">Arbitragem esportiva ao vivo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {anyBotRunning && (
              <Badge className="gap-1.5 bg-green-500/20 text-green-400 border-green-500/40 animate-pulse">
                <Bot className="h-3 w-3" />
                {bots.filter((b) => b.running).length} bot{bots.filter((b) => b.running).length > 1 ? "s" : ""} ativo{bots.filter((b) => b.running).length > 1 ? "s" : ""} · {bots.reduce((a, b) => a + b.sentCount, 0)} enviados
              </Badge>
            )}
            {remaining && (
              <Badge variant="outline" className="border-border/60 text-muted-foreground">
                {remaining} req restantes
              </Badge>
            )}
            <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
              <Sparkles className="h-3 w-3" />
              The Odds API
            </Badge>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-border/60"
              onClick={() => setSettingsOpen(true)}
              title="Configurações do Bot"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">

        {/* Step 1 — Casas */}
        <Card className="border-border/60 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <StepBadge n={1} />
                Casas de aposta
              </CardTitle>
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-primary hover:text-primary/80 font-medium" onClick={handleSelectBrOnly}>Só Brasil</button>
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={handleSelectAll}>Todas</button>
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={handleClearAll}>Limpar</button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                🇧🇷 <span className="font-medium text-foreground">Operando no Brasil</span>
                <span className="ml-1">· {selectedBookies.filter((k) => brBookmakers.some((b) => b.key === k)).length}/{brBookmakers.length} selecionadas</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {brBookmakers.map((bm) => (
                  <BookieChip key={bm.key} label={bm.title} active={selectedBookies.includes(bm.key)} onToggle={() => handleBookieToggle(bm.key)} />
                ))}
              </div>
            </div>
            {otherBookmakers.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Outras casas disponíveis</p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                  {otherBookmakers.map((bm) => (
                    <BookieChip key={bm.key} label={bm.title} active={selectedBookies.includes(bm.key)} onToggle={() => handleBookieToggle(bm.key)} />
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {selectedBookies.length === 0
                ? "⚠️ Nenhuma casa selecionada."
                : `${selectedBookies.length} casa${selectedBookies.length === 1 ? "" : "s"} selecionada${selectedBookies.length === 1 ? "" : "s"}.`}
              {rawEvents.length > 0 && " Resultados recalculados ao alterar a seleção."}
            </p>
          </CardContent>
        </Card>

        {/* Step 2 — Tipo de evento e liga */}
        <Card className="border-border/60 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StepBadge n={2} />
              Tipo de evento e liga
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de evento</Label>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: "all",      label: "Todos" },
                  { value: "upcoming", label: "🕐 Próximos" },
                  { value: "live",     label: "🔴 Ao vivo" },
                ] as { value: EventType; label: string }[]).map(({ value, label }) => (
                  <FilterChip key={value} label={label} active={eventType === value} onClick={() => setEventType(value)} />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sport">Esporte / Liga</Label>
              <Select value={sport} onValueChange={setSport} disabled={loadingSports}>
                <SelectTrigger id="sport">
                  <SelectValue placeholder={loadingSports ? "Carregando esportes..." : "Selecione"} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="upcoming">⭐ Próximos eventos (todos esportes)</SelectItem>
                  {sportGroups.map((g) => (
                    <SelectGroup key={g.group}>
                      <SelectLabel>{g.group}</SelectLabel>
                      {g.items.map((s) => (
                        <SelectItem key={s.key} value={s.key}>{s.title}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Step 3 — Mercado e investimento */}
        <Card className="border-border/60 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StepBadge n={3} />
              Mercado e investimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>
                Mercado
                <span className="ml-2 text-xs font-normal text-muted-foreground">selecione um ou mais</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {MARKET_OPTIONS.map((m) => {
                  const provider = getProviderByKey(selectedProvider);
                  const unsupported = provider.unsupportedMarketKeys.includes(m.key);
                  const reason = provider.unsupportedReason[m.key];
                  const active = !unsupported && selectedMarkets.includes(m.key);

                  const btn = (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => handleMarketToggle(m.key)}
                      aria-disabled={unsupported}
                      className={`flex flex-col items-start px-4 py-2.5 rounded-md border text-sm transition-colors text-left ${
                        unsupported
                          ? "border-border/40 text-muted-foreground/40 cursor-not-allowed select-none"
                          : active
                            ? "border-primary/60 bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className="font-semibold flex items-center gap-1.5">
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                        {m.label}
                        {unsupported && (
                          <span className="text-[10px] bg-border/40 text-muted-foreground/60 px-1.5 py-0.5 rounded ml-1">
                            indisponível
                          </span>
                        )}
                      </span>
                      <span className="text-xs opacity-60">{m.description}</span>
                    </button>
                  );

                  if (unsupported && reason) {
                    return (
                      <CssTooltip key={m.key} message={reason}>
                        {btn}
                      </CssTooltip>
                    );
                  }

                  return <div key={m.key}>{btn}</div>;
                })}
              </div>
            </div>
            <div className="flex gap-4 items-end flex-wrap">
              <div className="space-y-2 flex-1 min-w-48">
                <Label htmlFor="investment">Valor do investimento total</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <Input
                    id="investment"
                    type="number"
                    min={1}
                    step={10}
                    value={investment}
                    onChange={(e) => setInvestment(Number(e.target.value))}
                    className="pl-9 text-base font-medium"
                  />
                </div>
              </div>
              <Button
                size="lg"
                onClick={handleSearch}
                disabled={loading || loadingSports || selectedBookies.length === 0}
                className="bg-[image:var(--gradient-profit)] text-primary-foreground hover:opacity-90 shadow-[var(--shadow-glow)] font-semibold"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Buscando...</>
                ) : (
                  <><Search className="h-4 w-4" />Buscar Surebets</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {results && (
          <section className="space-y-4">
            <div className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  {results.length} oportunidade{results.length === 1 ? "" : "s"} de arbitragem
                </h2>
                <p className="text-sm text-muted-foreground">
                  {lastEventCount} eventos analisados · {selectedMarkets.map((k) => getMarketByKey(k).label).join(", ")} · investimento: {currency(investment)}
                </p>
              </div>
              {results.length > 0 && (
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Lucro total potencial</div>
                  <div className="text-2xl font-bold text-primary">{currency(totalProfit)}</div>
                </div>
              )}
            </div>

            {results.length === 0 ? (
              <Card className="border-dashed border-border/60">
                <CardContent className="py-12 text-center text-muted-foreground space-y-1">
                  <p>Nenhuma surebet encontrada com as configurações atuais.</p>
                  <p className="text-xs">Tente incluir mais casas, outro esporte, mercado diferente, ou aguarde — as odds mudam constantemente.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {results.map((opp) => <OpportunityCard key={`${opp.eventId}-${opp.marketLabel}`} opp={opp} />)}
              </div>
            )}
          </section>
        )}

        {!results && !loading && (
          <Card className="border-dashed border-border/60">
            <CardContent className="py-16 text-center space-y-2">
              <Trophy className="h-10 w-10 mx-auto text-primary/60" />
              <p className="text-base font-medium">Pronto para encontrar lucro garantido</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Configure as casas, tipo de evento, liga e mercado — depois clique em{" "}
                <span className="text-foreground">Buscar Surebets</span>.
              </p>
            </CardContent>
          </Card>
        )}

        <footer className="pt-6 text-center text-xs text-muted-foreground">
          Odds em tempo real via{" "}
          <a href="https://the-odds-api.com/" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            The Odds API
          </a>
          . Apostas envolvem risco — verifique cada odd manualmente antes de apostar.
        </footer>
      </main>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={(open) => { setSettingsOpen(open); if (!open) setCreatingBot(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Configurações
            </DialogTitle>
            <DialogDescription>
              Gerencie o servidor de dados e os bots do Telegram.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">

            {/* ── Servidor de dados ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Servidor de dados</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    disabled={!p.available}
                    onClick={() => p.available && handleProviderChange(p.key)}
                    className={`flex flex-col items-start px-4 py-2.5 rounded-md border text-sm transition-colors text-left ${
                      !p.available
                        ? "border-border/40 text-muted-foreground/40 cursor-not-allowed opacity-50"
                        : selectedProvider === p.key
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <span className="font-semibold flex items-center gap-1.5">
                      {selectedProvider === p.key && p.available && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                      {p.label}
                      {!p.available && (
                        <span className="ml-1 text-[10px] bg-border/60 text-muted-foreground px-1.5 py-0.5 rounded">
                          em breve
                        </span>
                      )}
                    </span>
                    <span className="text-xs opacity-60">{p.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border/40" />

            {/* ── Bots do Telegram ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Bots do Telegram</h3>
                  {bots.length > 0 && (
                    <Badge variant="outline" className="text-xs border-border/60">
                      {bots.length} bot{bots.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                {!creatingBot && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10"
                    onClick={() => setCreatingBot(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Novo bot
                  </Button>
                )}
              </div>

              {/* Bot list */}
              {bots.length === 0 && !creatingBot && (
                <div className="rounded-md border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
                  Nenhum bot criado. Clique em <span className="text-foreground font-medium">Novo bot</span> para começar.
                </div>
              )}

              {bots.map((bot) => (
                <div
                  key={bot.id}
                  className={`rounded-md border px-4 py-3 space-y-2 transition-colors ${
                    bot.running
                      ? "border-green-500/40 bg-green-500/5"
                      : "border-border/60 bg-secondary/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${bot.running ? "bg-green-400 animate-pulse" : "bg-border"}`}
                      />
                      <span className="text-xs font-mono font-semibold text-muted-foreground">#{bot.id}</span>
                      <span className="text-sm font-medium truncate">{bot.chatId}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {bot.running ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                          onClick={() => stopBot(bot.id)}
                        >
                          <StopCircle className="h-3.5 w-3.5" />
                          Parar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs border-green-500/40 text-green-400 hover:bg-green-500/10"
                          onClick={() => resumeBot(bot.id)}
                        >
                          <Play className="h-3.5 w-3.5" />
                          Retomar
                        </Button>
                      )}
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setExpandedBotId(expandedBotId === bot.id ? null : bot.id)}
                      >
                        {expandedBotId === bot.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Status row */}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {bot.running ? (
                      <>
                        <span className="text-green-400 font-medium flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          {bot.endTime ? `Restam ${formatTime(bot.timeLeft)}` : "Ilimitado"}
                        </span>
                        <span>{bot.sentCount} alertas enviados</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/60">Inativo · {bot.sentCount} alertas enviados</span>
                    )}
                    {bot.duration > 0 && (
                      <span>Duração: {bot.duration < 60 ? `${bot.duration} min` : `${bot.duration / 60}h`}</span>
                    )}
                  </div>

                  {/* Expanded details */}
                  {expandedBotId === bot.id && (
                    <div className="pt-1 space-y-1 text-xs text-muted-foreground border-t border-border/40 mt-2">
                      <div>Chat ID: <span className="text-foreground font-medium">{bot.chatId}</span></div>
                      <div>Token: <span className="font-mono text-foreground/70">{"•".repeat(12)}{bot.token.slice(-6)}</span></div>
                    </div>
                  )}

                  {bot.error && (
                    <div className="flex items-center gap-1.5 rounded border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {bot.error}
                    </div>
                  )}
                </div>
              ))}

              {/* Create bot form */}
              {creatingBot && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <p className="text-sm font-semibold">Novo bot</p>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-bot-token" className="text-xs">Token do Bot</Label>
                    <Input
                      id="new-bot-token"
                      type="password"
                      placeholder="123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={newBotToken}
                      onChange={(e) => setNewBotToken(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Obtenha via <span className="font-medium text-foreground">@BotFather</span> no Telegram.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-bot-chat" className="text-xs">Chat ID</Label>
                    <Input
                      id="new-bot-chat"
                      placeholder="-1001234567890 ou @seucanal"
                      value={newBotChatId}
                      onChange={(e) => setNewBotChatId(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Duração</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { value: 30,  label: "30 min" },
                        { value: 60,  label: "1h" },
                        { value: 120, label: "2h" },
                        { value: 0,   label: "∞" },
                      ].map(({ value, label }) => (
                        <FilterChip
                          key={value}
                          label={label}
                          active={newBotDuration === value}
                          onClick={() => setNewBotDuration(value)}
                        />
                      ))}
                    </div>
                  </div>

                  {newBotError && (
                    <div className="flex items-center gap-1.5 rounded border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {newBotError}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => { setCreatingBot(false); setNewBotError(null); }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs bg-[image:var(--gradient-profit)] text-primary-foreground hover:opacity-90"
                      onClick={createBot}
                      disabled={!newBotToken || !newBotChatId}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Criar e iniciar
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Os bots usam as configurações de casas, esporte e mercado da tela principal. Mantenha a aba aberta enquanto estiverem ativos.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0">
      {n}
    </span>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 rounded-md border text-sm font-medium transition-colors ${
        active
          ? "border-primary/60 bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-secondary"
      }`}
    >
      {label}
    </button>
  );
}

function BookieChip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <label className={`flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer transition-colors text-sm select-none ${
      active ? "border-primary/60 bg-primary/10 text-foreground" : "border-border hover:bg-secondary text-muted-foreground"
    }`}>
      <Checkbox checked={active} onCheckedChange={onToggle} />
      <span className="font-medium">{label}</span>
    </label>
  );
}

function CssTooltip({ message, children }: { message: string; children: ReactNode }) {
  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block group-focus-within:block z-50 pointer-events-none">
        <div className="bg-popover text-popover-foreground border border-border text-xs rounded-md px-3 py-2 shadow-lg w-72 whitespace-normal text-left leading-snug">
          {message}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
      </div>
    </div>
  );
}

function OpportunityCard({ opp }: { opp: SurebetOpportunity }) {
  const date = new Date(opp.commenceTime).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <Card className="border-border/60 overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--gradient-profit)]" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex gap-1.5 mb-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">{opp.sport}</Badge>
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">{opp.marketLabel}</Badge>
            </div>
            <CardTitle className="text-base leading-tight">
              {opp.homeTeam} <span className="text-muted-foreground font-normal">vs</span> {opp.awayTeam}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{date}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Lucro</div>
            <div className="text-xl font-bold text-primary">+{opp.profitPercent.toFixed(2)}%</div>
            <div className="text-xs text-primary/80">{currency(opp.profitValue)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {opp.stakes.map((s) => (
          <div key={s.name} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2.5 border border-border/40">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.bookmaker} · odd {s.price.toFixed(2)}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-semibold">{currency(s.stake)}</div>
              <div className="text-xs text-muted-foreground">retorna {currency(s.payout)}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
