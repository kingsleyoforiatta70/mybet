import {
  formSummaryFromPredictionForm,
  getApiPrediction,
  getFixtureById,
  getFixturesByDate,
  getHeadToHead,
  getTeamStatistics,
  getTopScorerCandidates,
  hasApiFootballKey,
} from "./api-football";
import { findHighlightlyMatch, getHighlightlyDeepStats, hasHighlightlyKey } from "./highlightly";
import { mockFixturesForToday, mockInsightsFor } from "./mock-data";
import { buildPredictions } from "./predictions/engine";
import type { DeepMatchStats, Fixture, FormSummary, MatchInsights, PredictionSet } from "./types";

/**
 * API-Football's free plan blocks corners/fouls/cards/shots entirely (see
 * api-football.ts's getRecentDeepStats). Highlightly's free plan doesn't
 * have that restriction, so it's used as a second source just for these
 * deep match stats. The two providers use unrelated team/match IDs, so
 * fixtures are bridged by kickoff date + team name.
 */
async function getDeepStatsViaHighlightly(fixture: Fixture): Promise<{
  home: DeepMatchStats | null;
  away: DeepMatchStats | null;
  homeCards: { yellowAvg: number; redAvg: number } | null;
  awayCards: { yellowAvg: number; redAvg: number } | null;
}> {
  const empty = { home: null, away: null, homeCards: null, awayCards: null };
  if (!hasHighlightlyKey()) return empty;
  try {
    const match = await findHighlightlyMatch(fixture.home.name, fixture.away.name, fixture.date);
    if (!match) return empty;
    const [home, away] = await Promise.all([
      getHighlightlyDeepStats(match.homeTeamId, fixture.date),
      getHighlightlyDeepStats(match.awayTeamId, fixture.date),
    ]);
    return {
      home,
      away,
      homeCards: home ? { yellowAvg: home.cardsYellowAvg, redAvg: home.cardsRedAvg } : null,
      awayCards: away ? { yellowAvg: away.cardsYellowAvg, redAvg: away.cardsRedAvg } : null,
    };
  } catch (err) {
    console.error("[data] highlightly deep stats failed:", err);
    return empty;
  }
}

function withCardsFallback(form: FormSummary, cards: { yellowAvg: number; redAvg: number } | null): FormSummary {
  if (form.yellowCardsAvg != null || !cards) return form;
  return { ...form, yellowCardsAvg: cards.yellowAvg, redCardsTotal: cards.redAvg };
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getFixturesForDate(date: string): Promise<{ fixtures: Fixture[]; source: "live" | "mock" }> {
  if (!hasApiFootballKey()) {
    return { fixtures: mockFixturesForToday(), source: "mock" };
  }
  try {
    const fixtures = await getFixturesByDate(date);
    return { fixtures, source: "live" };
  } catch (err) {
    console.error("[data] falling back to mock fixtures:", err);
    return { fixtures: mockFixturesForToday(), source: "mock" };
  }
}

export async function getMatchInsights(fixtureId: number): Promise<MatchInsights> {
  if (!hasApiFootballKey()) {
    return mockInsightsFor(fixtureId);
  }

  try {
    const fixture = await getFixtureById(fixtureId);
    if (!fixture) return mockInsightsFor(fixtureId);

    const [homeStats, awayStats, h2h, apiPrediction, topScorers, deepStats] = await Promise.all([
      getTeamStatistics(fixture.home.id, fixture.league.id, fixture.league.season),
      getTeamStatistics(fixture.away.id, fixture.league.id, fixture.league.season),
      getHeadToHead(fixture.home.id, fixture.away.id),
      getApiPrediction(fixture.id),
      getTopScorerCandidates(fixture.home.id, fixture.away.id, fixture.league.id, fixture.league.season),
      getDeepStatsViaHighlightly(fixture),
    ]);

    // /teams/statistics is season-gated (blocked on the free plan for the
    // current season) — fall back to the coarser last-5 form bundled inside
    // /predictions, which isn't season-restricted.
    const homeForm = withCardsFallback(
      homeStats ?? formSummaryFromPredictionForm(apiPrediction?.teamForm?.home ?? null),
      deepStats.homeCards,
    );
    const awayForm = withCardsFallback(
      awayStats ?? formSummaryFromPredictionForm(apiPrediction?.teamForm?.away ?? null),
      deepStats.awayCards,
    );

    return {
      fixture,
      homeForm,
      awayForm,
      h2h,
      homeDeepStats: deepStats.home,
      awayDeepStats: deepStats.away,
      topScorers,
      apiPrediction,
      dataSource: "live",
    };
  } catch (err) {
    console.error("[data] falling back to mock insights:", err);
    return mockInsightsFor(fixtureId);
  }
}

/**
 * Lighter-weight version of getMatchInsights for rendering predictions on
 * the fixtures list without one page load burning 5+ API calls per row.
 * Uses only /predictions (form + h2h + team-stats omitted), which already
 * bundles a usable form/comparison signal in a single request.
 */
async function getQuickInsights(fixture: Fixture): Promise<MatchInsights> {
  if (!hasApiFootballKey()) {
    return mockInsightsFor(fixture.id);
  }
  try {
    const apiPrediction = await getApiPrediction(fixture.id);
    return {
      fixture,
      homeForm: formSummaryFromPredictionForm(apiPrediction?.teamForm?.home ?? null),
      awayForm: formSummaryFromPredictionForm(apiPrediction?.teamForm?.away ?? null),
      h2h: [],
      homeDeepStats: null,
      awayDeepStats: null,
      topScorers: [],
      apiPrediction,
      dataSource: "live",
    };
  } catch (err) {
    console.error("[data] quick insights failed, falling back to mock:", err);
    return mockInsightsFor(fixture.id);
  }
}

export async function getPredictionsForFixtures(
  fixtures: Fixture[],
): Promise<{ fixture: Fixture; predictions: PredictionSet }[]> {
  return Promise.all(
    fixtures.map(async (fixture) => ({
      fixture,
      predictions: buildPredictions(await getQuickInsights(fixture)),
    })),
  );
}
