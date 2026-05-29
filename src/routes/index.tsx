import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TrendingUp, Search, Loader2, AlertCircle, Sparkles, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { fetchOdds } from "@/lib/surebet/api";
import { findOpportunities } from "@/lib/surebet/calc";
import { MOCK_BOOKMAKERS, MOCK_SPORTS } from "@/lib/surebet/mock";
import type { SurebetOpportunity } from "@/lib/surebet/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Surebet Finder — Arbitragem Esportiva" },
      {
        name: "description",
        content:
          "Encontre oportunidades de arbitragem esportiva (surebets) com lucro garantido. Compare odds entre casas de aposta em tempo real.",
      },
      { property: "og:title", content: "Surebet Finder — Arbitragem Esportiva" },
      {
        property: "og:description",
        content:
          "Encontre oportunidades de arbitragem esportiva com lucro garantido.",
      },
    ],
  }),
  component: Index,
});

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Index() {
  const [investment, setInvestment] = useState<number>(1000);
  const [sport, setSport] = useState<string>("all");
  const [selectedBookies, setSelectedBookies] = useState<string[]>(
    MOCK_BOOKMAKERS.map((b) => b.key),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SurebetOpportunity[] | null>(null);

  const totalProfit = useMemo(
    () => results?.reduce((acc, r) => acc + r.profitValue, 0) ?? 0,
    [results],
  );

  const toggleBookie = (key: string) => {
    setSelectedBookies((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSearch = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!investment || investment <= 0) {
        throw new Error("Informe um valor de investimento válido.");
      }
      if (selectedBookies.length < 2) {
        throw new Error("Selecione pelo menos 2 casas de aposta.");
      }
      const events = await fetchOdds(sport);
      const opps = findOpportunities(events, selectedBookies, investment, sport);
      setResults(opps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setResults(null);
    } finally {
      setLoading(false);
    }
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
              <p className="text-xs text-muted-foreground">Arbitragem esportiva</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
            <Sparkles className="h-3 w-3" />
            Modo demo (mock)
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Control Panel */}
        <Card className="border-border/60 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Painel de controle
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
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
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger id="sport">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_SPORTS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              size="lg"
              onClick={handleSearch}
              disabled={loading}
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

            <div className="md:col-span-3 space-y-2">
              <Label>Casas de aposta</Label>
              <div className="flex flex-wrap gap-2">
                {MOCK_BOOKMAKERS.map((bm) => {
                  const active = selectedBookies.includes(bm.key);
                  return (
                    <label
                      key={bm.key}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                        active
                          ? "border-primary/60 bg-primary/10"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      <Checkbox
                        checked={active}
                        onCheckedChange={() => toggleBookie(bm.key)}
                      />
                      <span className="text-sm font-medium">{bm.title}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <section className="space-y-4">
            <div className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  {results.length} oportunidade{results.length === 1 ? "" : "s"} encontrada
                  {results.length === 1 ? "" : "s"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Investimento por evento: {currency(investment)}
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
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma surebet encontrada para os filtros atuais. Tente incluir
                  mais casas de aposta ou outro esporte.
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
                Configure o investimento, selecione as casas de aposta e clique em
                <span className="text-foreground"> Buscar Surebets</span>.
              </p>
            </CardContent>
          </Card>
        )}

        <footer className="pt-6 text-center text-xs text-muted-foreground">
          Dados de demonstração. Conecte sua chave da{" "}
          <a
            href="https://the-odds-api.com/"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            The Odds API
          </a>{" "}
          via variável <code className="font-mono">VITE_ODDS_API_KEY</code>.
        </footer>
      </main>
    </div>
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
          <div>
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
