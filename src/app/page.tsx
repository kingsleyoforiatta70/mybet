import { SiteHeader } from "@/components/site-header";
import { DailyPickCard } from "@/components/daily-pick-card";
import { DateNav } from "@/components/date-nav";
import { MatchCard } from "@/components/match-card";
import { PredictionsTable } from "@/components/predictions-table";
import { TeamLogo } from "@/components/team-logo";
import { getFixturesForDate, getPredictionsForFixtures, todayIso } from "@/lib/data";
import { FEATURED_LEAGUE_IDS, compareLeagues } from "@/lib/leagues";
import type { Fixture } from "@/lib/types";

export const revalidate = 900;

const DAILY_PICKS_COUNT = 4;

// API-Football's free plan caps out at 10 requests/minute AND 100/day,
// shared across the whole app (fixtures list, this scan, match detail
// pages). Keeping the pool at or under that per-minute cap means a cold
// load never has to wait on the rate gate — it just costs up to this many
// requests once, then serves from cache for 6h. A bigger pool is possible
// but turns a page load into a multi-minute wait (see api-football.ts's
// rateLimitGate) and eats the daily budget fast.
const SCAN_POOL_CAP = 9;
const BEST_PICKS_LIMIT = 20;
const MIN_BEST_PICK_CONFIDENCE = 55;

function groupByLeague(fixtures: Fixture[]) {
  const groups = new Map<number, { league: Fixture["league"]; fixtures: Fixture[] }>();
  for (const fixture of fixtures) {
    const existing = groups.get(fixture.league.id);
    if (existing) existing.fixtures.push(fixture);
    else groups.set(fixture.league.id, { league: fixture.league, fixtures: [fixture] });
  }
  return [...groups.values()].sort((a, b) => compareLeagues(a.league, b.league));
}

function isValidIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const today = todayIso();
  const selectedDate = isValidIsoDate(params.date) ? params.date : today;
  const isToday = selectedDate === today;

  const { fixtures, source } = await getFixturesForDate(selectedDate);
  const featured = fixtures.filter((f) => FEATURED_LEAGUE_IDS.has(f.league.id));
  const rest = fixtures.filter((f) => !FEATURED_LEAGUE_IDS.has(f.league.id));

  // Featured leagues fill the scan pool first (best-tracked data, most
  // likely to produce confident picks); remaining slots fill from everything
  // else so Best Picks isn't limited to just the 9 featured competitions.
  const candidatePool = [...featured, ...rest].slice(0, SCAN_POOL_CAP);
  const candidateIds = new Set(candidatePool.map((f) => f.id));
  const otherGroups = groupByLeague(fixtures.filter((f) => !candidateIds.has(f.id)));

  const dateLabel = new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const predictionRows = candidatePool.length ? await getPredictionsForFixtures(candidatePool) : [];
  const featuredIds = new Set(featured.map((f) => f.id));

  const topLeagueRows = predictionRows.filter((r) => featuredIds.has(r.fixture.id));
  const bestPicks = predictionRows
    .filter((r) => r.predictions.headline.confidence >= MIN_BEST_PICK_CONFIDENCE)
    .sort((a, b) => b.predictions.headline.confidence - a.predictions.headline.confidence)
    .slice(0, BEST_PICKS_LIMIT);
  const dailyFour = bestPicks.slice(0, DAILY_PICKS_COUNT);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isToday ? "Today's Matches" : "Matches"}
            </h1>
            <span className="text-sm text-muted-foreground">{dateLabel}</span>
          </div>
          <DateNav date={selectedDate} />
        </div>

        {source === "mock" && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Showing sample data — add <code className="font-mono">API_FOOTBALL_KEY</code> to{" "}
            <code className="font-mono">.env.local</code> to pull real fixtures.
          </div>
        )}

        {fixtures.length === 0 && (
          <p className="text-sm text-muted-foreground">No matches found for this date.</p>
        )}

        {dailyFour.length > 0 && (
          <section className="mb-10">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                {isToday ? "Today's 4" : "Top 4"}
              </h2>
              <span className="text-xs text-muted-foreground">The day&apos;s highest-confidence picks</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {dailyFour.map(({ fixture, predictions }) => (
                <DailyPickCard key={fixture.id} fixture={fixture} predictions={predictions} />
              ))}
            </div>
          </section>
        )}

        {bestPicks.length > 0 && (
          <section className="mb-10">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                {isToday ? "Best Picks Today" : "Best Picks"}
              </h2>
              <span className="text-xs text-muted-foreground">
                {bestPicks.length} pick{bestPicks.length === 1 ? "" : "s"} at {MIN_BEST_PICK_CONFIDENCE}%+ confidence
              </span>
            </div>
            <PredictionsTable rows={bestPicks} />
          </section>
        )}

        {topLeagueRows.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Top Leagues — Predictions
            </h2>
            <PredictionsTable rows={topLeagueRows} />
          </section>
        )}

        {otherGroups.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              {isToday ? "Other Matches Today" : "Other Matches"}
            </h2>
            <div className="space-y-8">
              {otherGroups.map(({ league, fixtures }) => (
                <div key={league.id}>
                  <div className="mb-3 flex items-center gap-2">
                    <TeamLogo name={league.name} logo={league.logo} className="h-5 w-5" />
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {league.country} — {league.name}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {fixtures.map((fixture) => (
                      <MatchCard key={fixture.id} fixture={fixture} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
