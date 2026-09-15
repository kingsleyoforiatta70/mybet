import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { TeamLogo } from "@/components/team-logo";
import { HeadlinePick } from "@/components/headline-pick";
import { PredictionBar } from "@/components/prediction-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMatchInsights } from "@/lib/data";
import { buildPredictions } from "@/lib/predictions/engine";

export const revalidate = 900;

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fixtureId = Number(id);
  if (!Number.isFinite(fixtureId)) notFound();

  const insights = await getMatchInsights(fixtureId);
  const predictions = buildPredictions(insights);
  const { fixture, homeForm, awayForm, h2h, homeDeepStats, awayDeepStats } = insights;

  const kickoff = new Date(fixture.date).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Today&apos;s matches
        </Link>

        {insights.dataSource === "mock" && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Showing sample data — add <code className="font-mono">API_FOOTBALL_KEY</code> to see real stats for this
            match.
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-2 text-center">
          <span className="text-xs text-muted-foreground">
            {fixture.league.country} — {fixture.league.name} · {kickoff}
          </span>
          <div className="flex w-full items-center justify-center gap-6 py-4">
            <div className="flex flex-1 flex-col items-center gap-2">
              <TeamLogo name={fixture.home.name} logo={fixture.home.logo} className="h-14 w-14" />
              <span className="text-center font-medium">{fixture.home.name}</span>
            </div>
            <span className="text-sm text-muted-foreground">vs</span>
            <div className="flex flex-1 flex-col items-center gap-2">
              <TeamLogo name={fixture.away.name} logo={fixture.away.logo} className="h-14 w-14" />
              <span className="text-center font-medium">{fixture.away.name}</span>
            </div>
          </div>
        </div>

        <div className="mt-2 mb-8">
          <HeadlinePick pick={predictions.headline} />
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="markets">Markets</TabsTrigger>
            <TabsTrigger value="h2h">Head-to-Head</TabsTrigger>
            <TabsTrigger value="scorers">Player to Score</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Match Result</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <PredictionBar
                  label={fixture.home.name}
                  pct={predictions.matchResult.home}
                  highlight={predictions.matchResult.pick.selection === `${fixture.home.name} Win`}
                />
                <PredictionBar
                  label="Draw"
                  pct={predictions.matchResult.draw}
                  highlight={predictions.matchResult.pick.selection === "Draw"}
                />
                <PredictionBar
                  label={fixture.away.name}
                  pct={predictions.matchResult.away}
                  highlight={predictions.matchResult.pick.selection === `${fixture.away.name} Win`}
                />
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Both Teams to Score</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <PredictionBar label="Yes" pct={predictions.btts.yesPct} highlight={predictions.btts.pick.selection === "Yes"} />
                  <PredictionBar label="No" pct={predictions.btts.noPct} highlight={predictions.btts.pick.selection === "No"} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Total Goals ({predictions.totalGoals.line})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <PredictionBar
                    label={`Over ${predictions.totalGoals.line}`}
                    pct={predictions.totalGoals.overPct}
                    highlight={predictions.totalGoals.pick.selection.startsWith("Over")}
                  />
                  <PredictionBar
                    label={`Under ${predictions.totalGoals.line}`}
                    pct={predictions.totalGoals.underPct}
                    highlight={predictions.totalGoals.pick.selection.startsWith("Under")}
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Most Likely Scorelines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  {predictions.correctScoreTop.map((s) => (
                    <div key={s.score} className="flex-1 rounded-lg border border-border px-4 py-3 text-center">
                      <div className="font-mono text-lg font-semibold">{s.score}</div>
                      <div className="text-xs text-muted-foreground">{s.probability}%</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="markets" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Cards {predictions.cards ? `(${predictions.cards.line})` : ""}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {predictions.cards ? (
                  <>
                    <PredictionBar
                      label={`Over ${predictions.cards.line}`}
                      pct={predictions.cards.overPct}
                      highlight={predictions.cards.pick.selection.startsWith("Over")}
                    />
                    <PredictionBar
                      label={`Under ${predictions.cards.line}`}
                      pct={predictions.cards.underPct}
                      highlight={predictions.cards.pick.selection.startsWith("Under")}
                    />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not enough card data available for this fixture.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Corners {predictions.corners ? `(${predictions.corners.line})` : ""}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {predictions.corners ? (
                  <>
                    <PredictionBar
                      label={`Over ${predictions.corners.line}`}
                      pct={predictions.corners.overPct}
                      highlight={predictions.corners.pick.selection.startsWith("Over")}
                    />
                    <PredictionBar
                      label={`Under ${predictions.corners.line}`}
                      pct={predictions.corners.underPct}
                      highlight={predictions.corners.pick.selection.startsWith("Under")}
                    />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not enough recent match data to estimate corners for this fixture.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Fouls {predictions.fouls ? `(${predictions.fouls.line})` : ""}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {predictions.fouls ? (
                  <>
                    <PredictionBar
                      label={`Over ${predictions.fouls.line}`}
                      pct={predictions.fouls.overPct}
                      highlight={predictions.fouls.pick.selection.startsWith("Over")}
                    />
                    <PredictionBar
                      label={`Under ${predictions.fouls.line}`}
                      pct={predictions.fouls.underPct}
                      highlight={predictions.fouls.pick.selection.startsWith("Under")}
                    />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not enough recent match data to estimate fouls for this fixture.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Shots {predictions.shots ? `(${predictions.shots.line})` : ""}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {predictions.shots ? (
                  <>
                    <PredictionBar
                      label={`Over ${predictions.shots.line}`}
                      pct={predictions.shots.overPct}
                      highlight={predictions.shots.pick.selection.startsWith("Over")}
                    />
                    <PredictionBar
                      label={`Under ${predictions.shots.line}`}
                      pct={predictions.shots.underPct}
                      highlight={predictions.shots.pick.selection.startsWith("Under")}
                    />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not enough recent match data to estimate shots for this fixture.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <TeamFormCard name={fixture.home.name} form={homeForm} deep={homeDeepStats} />
              <TeamFormCard name={fixture.away.name} form={awayForm} deep={awayDeepStats} />
            </div>
          </TabsContent>

          <TabsContent value="h2h" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Last {h2h.length} Meetings</CardTitle>
              </CardHeader>
              <CardContent>
                {h2h.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No previous meetings found.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Match</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {h2h.map((m, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">
                            {new Date(m.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                          </TableCell>
                          <TableCell>
                            {m.homeTeam} vs {m.awayTeam}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {m.homeGoals}-{m.awayGoals}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scorers" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Likeliest Goalscorers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {predictions.playerToScore.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No player scoring data available.</p>
                ) : (
                  predictions.playerToScore.map(({ player, probability }) => (
                    <div key={player.playerId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          {player.name}
                          <Badge variant="outline" className="text-[10px]">
                            {player.team === "home" ? fixture.home.name : fixture.away.name}
                          </Badge>
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {probability}% · {player.goalsSeason} goals this season
                        </span>
                      </div>
                      <PredictionBar label="" pct={probability} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function TeamFormCard({
  name,
  form,
  deep,
}: {
  name: string;
  form: { last5: string; goalsForAvg: number; goalsAgainstAvg: number; yellowCardsAvg: number | null; detailed: boolean };
  deep: { cornersAvg: number; foulsAvg: number; shotsOnTargetAvg: number } | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{name} — Recent Form</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {form.last5 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last 5</span>
            <span className="font-mono">{form.last5}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Goals for / against</span>
          <span className="font-mono">
            {form.goalsForAvg.toFixed(1)} / {form.goalsAgainstAvg.toFixed(1)}
          </span>
        </div>
        {form.yellowCardsAvg != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Yellow cards / game</span>
            <span className="font-mono">{form.yellowCardsAvg.toFixed(1)}</span>
          </div>
        )}
        {!form.detailed && (
          <p className="pt-1 text-xs text-muted-foreground">
            Approximated from recent-form data — full season stats need a paid API-Football plan.
          </p>
        )}
        {deep && (
          <>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Corners / game</span>
              <span className="font-mono">{deep.cornersAvg.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fouls / game</span>
              <span className="font-mono">{deep.foulsAvg.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shots on target / game</span>
              <span className="font-mono">{deep.shotsOnTargetAvg.toFixed(1)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
