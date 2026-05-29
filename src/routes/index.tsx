import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  TrendingUp,
  Search,
  Loader2,
  AlertCircle,
  Sparkles,
  Trophy,
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

import { getOdds, getSports, type SportInfo } from "@/lib/surebet/odds.functions";
import { findOpportunities } from "@/lib/surebet/calc";
import type { SurebetOpportunity, SportEvent } from "@/lib/surebet/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Surebet Finder — Arbitragem Esportiva" },
      {
        name: "description",
        content:
          "Encontre oportunidades reais de arbitragem esportiva com lucro garantido. Compara odds entre dezenas de casas de aposta via The Odds API.",
      },
      { property: "og:title", content: "Surebet Finder — Arbitragem Esportiva" },
      {
        property: "og:description",
        content:
          "Oportunidades reais de surebet com odds ao vivo via The Odds API.",
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
  { key: "betano",          title: "Betano",       br: true },
  { key: "superbet",        title: "Superbet",     br: true },
  { key: "pinnacle",        title: "Pinnacle",     br: true },
  { key: "betfair_ex_eu",   title: "Betfair",      br: true },
  { key: "betmgm",          title: "BetMGM",       br: true },
  { key: "bet365",          title: "Bet365",       br: true },
  { key: "sportingbet",     title: "Sportingbet",  br: true },
  { key: "novibet",         title: "Novibet",      br: true },
  { key: "unibet_eu",       title: "Unibet",       br: true },
  { key: "williamhill",     title: "William Hill", br: true },
  { key: "1xbet",           title: "1xBet",        br: true },
  { key: "bwin",            title: "Bwin",         br: true },
];

const BR_KEYS = new Set(BRAZIL_BOOKMAKERS.map((b) => b.key));

function Index() {
  const fetchSports = useServerFn(getSports);
  const fetchOdds = useServerFn(getOdds);

  const [investment, setInvestment] = useState<number>(1000);
  const [sport, setSport] = useState<string>("upcoming");
  const [sports, setSports] = useState<SportInfo[]>([]);
  const [loadingSports, setLoadingSports] = useState(true);

  const [bookmakerList, setBookmakerList] = useState<BookmakerEntry[]>(BRAZIL_BOOKMAKERS);
  const [selectedBookies, setSelectedBookies] = useState<string[]>(
    BRAZIL_BOOKMAKERS.map((b) => b.key),
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SurebetOpportunity[] | null>(null);
  const [remaining, setRemaining] = useState<string | null>(null);
  const [lastEventCount, setLastEventCount] = useState<number>(0);
  const [rawEvents, setRawEvents] = useState<SportEvent[]>([]);

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

  const toggleBookie = (key: string) => {
    setSelectedBookies((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const recompute = (events: SportEvent[], selection: string[]) => {
    const opps = findOpportunities(events, selection, investment, "all");
    setResults(opps);
  };

  const handleSearch = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!investment || investment <= 0) {
        throw new Error("Informe um valor de investimento válido.");
      }

      const { events, remaining: rem } = await fetchOdds({
        data: { sportKey: sport },
      });
      setRemaining(rem);
      setLastEventCount(events.length);
      setRawEvents(events as SportEvent[]);

      const bmMap = new Map<string, string>();
      for (const ev of events as SportEvent[]) {
        for (const bm of ev.bookmakers) bmMap.set(bm.key, bm.title);
      }

      const merged = new Map<string, BookmakerEntry>();
      for (const b of BRAZIL_BOOKMAKERS) merged.set(b.key, b);
      for (const [key, title] of bmMap.entries()) {
        if (!merged.has(key)) merged.set(key, { key, title, br: false });
      }

      const sortedList = Array.from(merged.values()).sort((a, b) => {
        if (a.br && !b.br) return -1;
        if (!a.br && b.br) return 1;
        return a.title.localeCompare(b.title);
      });

      setBookmakerList(sortedList);

      const opps = findOpportunities(events, selectedBookies, investment, "all");
      setResults(opps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setResults(null);
    } finally {
      setLoading(false);
    }
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

  const brBookmakers = bookmakerList.filter((b) => b.br);
  const otherBookmakers = bookmakerList.filter((b) => !b.br);

  return (
    <div className="min-h-screen">
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
            {remaining && (
              <Badge variant="outline" className="border-border/60 text-muted-foreground">
                {remaining} req restantes
              </Badge>
            )}
            <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
              <Sparkles className="h-3 w-3" />
              The Odds API
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">

        {/* Step 1 — Casas de aposta */}
        <Card className="border-border/60 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
                Casas de aposta
              </CardTitle>
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  className="text-primary hover:text-primary/80 font-medium"
                  onClick={handleSelectBrOnly}
                >
                  Só Brasil
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={handleSelectAll}
                >
                  Todas
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={handleClearAll}
                >
                  Limpar
                </button>
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
                {brBookmakers.map((bm) => {
                  const active = selectedBookies.includes(bm.key);
                  return (
                    <BookieChip
                      key={bm.key}
                      label={bm.title}
                      active={active}
                      onToggle={() => handleBookieToggle(bm.key)}
                    />
                  );
                })}
              </div>
            </div>

            {otherBookmakers.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Outras casas disponíveis na busca
                </p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                  {otherBookmakers.map((bm) => {
                    const active = selectedBookies.includes(bm.key);
                    return (
                      <BookieChip
                        key={bm.key}
                        label={bm.title}
                        active={active}
                        onToggle={() => handleBookieToggle(bm.key)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {selectedBookies.length === 0
                ? "⚠️ Nenhuma casa selecionada."
                : `${selectedBookies.length} casa${selectedBookies.length === 1 ? "" : "s"} selecionada${selectedBookies.length === 1 ? "" : "s"}.`}{" "}
              {rawEvents.length > 0 && "Os resultados são recalculados automaticamente ao alterar a seleção."}
            </p>
          </CardContent>
        </Card>

        {/* Step 2 — Esporte e busca */}
        <Card className="border-border/60 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
              Esporte e investimento
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="investment">Valor do investimento total</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
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

            <div className="space-y-2">
              <Label htmlFor="sport">Esporte / Liga</Label>
              <Select value={sport} onValueChange={setSport} disabled={loadingSports}>
                <SelectTrigger id="sport">
                  <SelectValue
                    placeholder={loadingSports ? "Carregando esportes..." : "Selecione"}
                  />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="upcoming">
                    ⭐ Próximos eventos (todos esportes)
                  </SelectItem>
                  {sportGroups.map((g) => (
                    <SelectGroup key={g.group}>
                      <SelectLabel>{g.group}</SelectLabel>
                      {g.items.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              size="lg"
              onClick={handleSearch}
              disabled={loading || loadingSports || selectedBookies.length === 0}
              className="bg-[image:var(--gradient-profit)] text-primary-foreground hover:opacity-90 shadow-[var(--shadow-glow)] font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Buscar Surebets
                </>
              )}
            </Button>
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
                  {lastEventCount} eventos analisados · investimento por evento: {currency(investment)}
                </p>
              </div>
              {results.length > 0 && (
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Lucro total potencial
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {currency(totalProfit)}
                  </div>
                </div>
              )}
            </div>

            {results.length === 0 ? (
              <Card className="border-dashed border-border/60">
                <CardContent className="py-12 text-center text-muted-foreground space-y-1">
                  <p>Nenhuma surebet encontrada com as casas selecionadas.</p>
                  <p className="text-xs">
                    Tente incluir mais casas, outro esporte, ou aguarde — as odds mudam constantemente.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {results.map((opp) => (
                  <OpportunityCard key={opp.eventId} opp={opp} />
                ))}
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
                Selecione as casas, escolha o esporte e clique em{" "}
                <span className="text-foreground">Buscar Surebets</span>.
              </p>
            </CardContent>
          </Card>
        )}

        <footer className="pt-6 text-center text-xs text-muted-foreground">
          Odds em tempo real via{" "}
          <a
            href="https://the-odds-api.com/"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            The Odds API
          </a>
          . Apostas envolvem risco — verifique cada odd manualmente antes de apostar.
        </footer>
      </main>
    </div>
  );
}

function BookieChip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer transition-colors text-sm select-none ${
        active
          ? "border-primary/60 bg-primary/10 text-foreground"
          : "border-border hover:bg-secondary text-muted-foreground"
      }`}
    >
      <Checkbox checked={active} onCheckedChange={onToggle} />
      <span className="font-medium">{label}</span>
    </label>
  );
}

function OpportunityCard({ opp }: { opp: SurebetOpportunity }) {
  const date = new Date(opp.commenceTime).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <Card className="border-border/60 overflow-hidden relative group">
      <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--gradient-profit)]" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge variant="secondary" className="text-xs mb-2">
              {opp.sport}
            </Badge>
            <CardTitle className="text-base leading-tight">
              {opp.homeTeam}{" "}
              <span className="text-muted-foreground font-normal">vs</span>{" "}
              {opp.awayTeam}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{date}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Lucro
            </div>
            <div className="text-xl font-bold text-primary">
              +{opp.profitPercent.toFixed(2)}%
            </div>
            <div className="text-xs text-primary/80">
              {currency(opp.profitValue)}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {opp.stakes.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2.5 border border-border/40"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{s.name}</div>
              <div className="text-xs text-muted-foreground">
                {s.bookmaker} · odd {s.price.toFixed(2)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-semibold">{currency(s.stake)}</div>
              <div className="text-xs text-muted-foreground">
                retorna {currency(s.payout)}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
