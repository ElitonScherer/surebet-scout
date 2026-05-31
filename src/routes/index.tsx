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
  const [botToken, setBotToken] = useState("");
  const [botChatId, setBotChatId] = useState("");
  const [botDuration, setBotDuration] = useState<number>(60);
  const [botRunning, setBotRunning] = useState(false);
  const [botTimeLeft, setBotTimeLeft] = useState<number>(0);
  const [botSentCount, setBotSentCount] = useState(0);
  const [botError, setBotError] = useState<string | null>(null);

  const botEndTimeRef = useRef<number | null>(null);
  const latestRef = useRef({
    sport, eventType, selectedMarkets, selectedBookies, investment, botToken, botChatId,
  });
  useEffect(() => {
    latestRef.current = { sport, eventType, selectedMarkets, selectedBookies, investment, botToken, botChatId };
  });

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

  // ── Telegram Bot ─────────────────────────────────────────────────────────
  const stopBot = () => {
    setBotRunning(false);
    botEndTimeRef.current = null;
  };

  useEffect(() => {
    if (!botRunning) return;

    const tick = async () => {
      const p = latestRef.current;
      const apiMarkets = buildApiMarketsParam(p.selectedMarkets);
      try {
        const { events } = await fetchOdds({
          data: {
            sportKey: p.sport,
            eventType: p.eventType,
            market: apiMarkets,
            bookmakers: p.selectedBookies.join(","),
          },
        });
        const opps = p.selectedMarkets.flatMap((key) =>
          findOpportunities(events as SportEvent[], p.selectedBookies, p.investment, "all", getMarketByKey(key)),
        );
        opps.sort((a, b) => b.profitPercent - a.profitPercent);
        for (const opp of opps) {
          const msg = formatForTelegram(opp, p.investment);
          await sendTelegram({ data: { token: p.botToken, chatId: p.botChatId, message: msg } });
        }
        if (opps.length > 0) setBotSentCount((n) => n + opps.length);
        setBotError(null);
      } catch (e) {
        setBotError(e instanceof Error ? e.message : "Erro no bot.");
      }

      if (botEndTimeRef.current && Date.now() >= botEndTimeRef.current) {
        setBotRunning(false);
      }
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [botRunning, fetchOdds, sendTelegram]);

  // Countdown timer
  useEffect(() => {
    if (!botRunning || !botEndTimeRef.current) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil(((botEndTimeRef.current ?? 0) - Date.now()) / 1000));
      setBotTimeLeft(left);
      if (left <= 0) setBotRunning(false);
    }, 1000);
    return () => clearInterval(id);
  }, [botRunning]);

  const startBot = () => {
    if (!botToken || !botChatId) {
      setBotError("Preencha o Token do Bot e o Chat ID antes de iniciar.");
      return;
    }
    setBotError(null);
    setBotSentCount(0);
    if (botDuration > 0) {
      botEndTimeRef.current = Date.now() + botDuration * 60 * 1000;
      setBotTimeLeft(botDuration * 60);
    } else {
      botEndTimeRef.current = null;
      setBotTimeLeft(0);
    }
    setBotRunning(true);
    setSettingsOpen(false);
  };

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
            {botRunning && (
              <Badge className="gap-1.5 bg-green-500/20 text-green-400 border-green-500/40 animate-pulse">
                <Bot className="h-3 w-3" />
                Bot ativo · {botSentCount} enviados
                {botEndTimeRef.current ? ` · ${formatTime(botTimeLeft)}` : ""}
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

        {/* Step 2 — Servidor, tipo de evento e Liga */}
        <Card className="border-border/60 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StepBadge n={2} />
              Servidor, tipo de evento e liga
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Servidor de dados</Label>
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
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Configurar Bot do Telegram
            </DialogTitle>
            <DialogDescription>
              O bot busca surebets a cada 1 minuto e envia alertas no Telegram enquanto estiver ativo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="bot-token">Token do Bot</Label>
              <Input
                id="bot-token"
                type="password"
                placeholder="123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxx"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Crie um bot com <span className="font-medium text-foreground">@BotFather</span> no Telegram para obter o token.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bot-chat">Chat ID</Label>
              <Input
                id="bot-chat"
                placeholder="-1001234567890 ou @seucanal"
                value={botChatId}
                onChange={(e) => setBotChatId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                ID do chat, grupo ou canal para receber os alertas.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Duração do bot</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 30,  label: "30 min" },
                  { value: 60,  label: "1 hora" },
                  { value: 120, label: "2 horas" },
                  { value: 0,   label: "∞ Ilimitado" },
                ].map(({ value, label }) => (
                  <FilterChip
                    key={value}
                    label={label}
                    active={botDuration === value}
                    onClick={() => setBotDuration(value)}
                  />
                ))}
              </div>
            </div>

            {botError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {botError}
              </div>
            )}

            {botRunning && (
              <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-400">
                <Timer className="h-4 w-4 shrink-0" />
                <span>
                  Bot ativo · <b>{botSentCount}</b> alertas enviados
                  {botEndTimeRef.current ? ` · restam ${formatTime(botTimeLeft)}` : ""}
                </span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {botRunning ? (
                <Button variant="destructive" className="flex-1" onClick={stopBot}>
                  <StopCircle className="h-4 w-4" />
                  Parar Bot
                </Button>
              ) : (
                <Button
                  className="flex-1 bg-[image:var(--gradient-profit)] text-primary-foreground hover:opacity-90"
                  onClick={startBot}
                  disabled={!botToken || !botChatId}
                >
                  <Send className="h-4 w-4" />
                  Iniciar Bot
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              O bot usa as configurações de casas, esporte e mercado da tela principal. Mantenha a aba aberta enquanto o bot estiver rodando.
            </p>
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
