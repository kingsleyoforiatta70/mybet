import type {
  ApiPredictionSummary,
  DeepMatchStats,
  Fixture,
  FormSummary,
  H2HMatch,
  PredictionTeamForm,
  TopScorerCandidate,
} from "./types";

const BASE_URL = "https://v3.football.api-sports.io";

export class ApiFootballConfigError extends Error {
  constructor() {
    super("API_FOOTBALL_KEY is not set");
    this.name = "ApiFootballConfigError";
  }
}

/** Thrown when the API rejects a request due to plan limits (season access, `last` param, etc). Callers can catch this specifically to degrade gracefully instead of failing the whole page. */
export class ApiFootballPlanError extends Error {
  constructor(detail: string) {
    super(`API-Football plan restriction: ${detail}`);
    this.name = "ApiFootballPlanError";
  }
}

/** Thrown once the 100/day quota is known to be exhausted. Short-circuits further calls instantly instead of queuing them behind the per-minute rate gate only to fail anyway. */
export class ApiFootballQuotaExceededError extends Error {
  constructor() {
    super("API-Football daily request quota exceeded");
    this.name = "ApiFootballQuotaExceededError";
  }
}

// Once we see a daily-limit error, every other in-flight/queued request this
// process makes is doomed too — remember it until the next UTC day so they
// fail instantly instead of each waiting out the per-minute rate gate first.
let dailyQuotaExceededUntil: number | null = null;

function nextUtcMidnight(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

function getKey(): string {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new ApiFootballConfigError();
  return key;
}

export function hasApiFootballKey(): boolean {
  return Boolean(process.env.API_FOOTBALL_KEY);
}

// The free plan caps requests at 10/minute (separate from the 100/day
// quota) — a burst of parallel calls (e.g. scanning many fixtures for the
// Best Picks section) gets some of them 429'd, which would otherwise fall
// back to fake mock data mixed in with real rows. This gate serializes
// requests to stay under that cap instead.
const REQUEST_TIMESTAMPS: number[] = [];
const MAX_REQUESTS_PER_MINUTE = 9; // small safety margin under the API's 10/min cap

async function rateLimitGate(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (REQUEST_TIMESTAMPS.length && now - REQUEST_TIMESTAMPS[0] > 60_000) {
      REQUEST_TIMESTAMPS.shift();
    }
    if (REQUEST_TIMESTAMPS.length < MAX_REQUESTS_PER_MINUTE) {
      REQUEST_TIMESTAMPS.push(now);
      return;
    }
    const waitMs = 60_000 - (now - REQUEST_TIMESTAMPS[0]) + 50;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

async function apiFetch<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  revalidateSeconds: number,
): Promise<T> {
  const key = getKey();
  if (dailyQuotaExceededUntil && Date.now() < dailyQuotaExceededUntil) {
    throw new ApiFootballQuotaExceededError();
  }
  await rateLimitGate();
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const host = process.env.API_FOOTBALL_HOST;
  const headers: Record<string, string> = host
    ? { "x-rapidapi-key": key, "x-rapidapi-host": host }
    : { "x-apisports-key": key };

  const res = await fetch(url.toString(), {
    headers,
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    throw new Error(`API-Football request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const errorCount = Array.isArray(json.errors) ? json.errors.length : Object.keys(json.errors ?? {}).length;
  if (errorCount) {
    if (!Array.isArray(json.errors) && "plan" in json.errors) {
      throw new ApiFootballPlanError(json.errors.plan);
    }
    if (!Array.isArray(json.errors) && "requests" in json.errors && /limit for the day/i.test(json.errors.requests)) {
      dailyQuotaExceededUntil = nextUtcMidnight();
      throw new ApiFootballQuotaExceededError();
    }
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
  }
  return json.response as T;
}

// ---- Mapping helpers ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFixture(raw: any): Fixture {
  return {
    id: raw.fixture.id,
    date: raw.fixture.date,
    timestamp: raw.fixture.timestamp,
    status: {
      short: raw.fixture.status.short,
      long: raw.fixture.status.long,
      elapsed: raw.fixture.status.elapsed,
    },
    venue: {
      name: raw.fixture.venue?.name ?? null,
      city: raw.fixture.venue?.city ?? null,
    },
    league: {
      id: raw.league.id,
      name: raw.league.name,
      country: raw.league.country,
      logo: raw.league.logo,
      season: raw.league.season,
    },
    home: { id: raw.teams.home.id, name: raw.teams.home.name, logo: raw.teams.home.logo },
    away: { id: raw.teams.away.id, name: raw.teams.away.name, logo: raw.teams.away.logo },
  };
}

// ---- Public API ----

export async function getFixturesByDate(date: string): Promise<Fixture[]> {
  const response = await apiFetch<unknown[]>("/fixtures", { date }, 60 * 15);
  return response.map(mapFixture);
}

export async function getFixtureById(id: number): Promise<Fixture | null> {
  const response = await apiFetch<unknown[]>("/fixtures", { id }, 60 * 15);
  if (!response.length) return null;
  return mapFixture(response[0]);
}

export async function getHeadToHead(
  homeTeamId: number,
  awayTeamId: number,
  last = 10,
): Promise<H2HMatch[]> {
  // Free plan rejects the `last` query param outright, so fetch full history
  // (API returns it newest-first) and slice client-side instead.
  const response = await apiFetch<unknown[]>(
    "/fixtures/headtohead",
    { h2h: `${homeTeamId}-${awayTeamId}` },
    60 * 60 * 12,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.slice(0, last).map((raw: any) => {
    const homeGoals: number = raw.goals.home ?? 0;
    const awayGoals: number = raw.goals.away ?? 0;
    const winner: H2HMatch["winner"] =
      homeGoals === awayGoals ? "draw" : homeGoals > awayGoals ? "home" : "away";
    return {
      date: raw.fixture.date,
      homeTeam: raw.teams.home.name,
      awayTeam: raw.teams.away.name,
      homeGoals,
      awayGoals,
      winner,
    };
  });
}

/**
 * Full season stats (form string, cards, clean sheets). Requires a plan with
 * access to the fixture's season — on the free plan this throws
 * ApiFootballPlanError for any season outside 2022-2024, so callers should
 * fall back to the coarser form data bundled in /predictions.
 */
export async function getTeamStatistics(
  teamId: number,
  leagueId: number,
  season: number,
): Promise<FormSummary | null> {
  let response: Record<string, unknown> | null;
  try {
    response = await apiFetch<Record<string, unknown> | null>(
      "/teams/statistics",
      { team: teamId, league: leagueId, season },
      60 * 60 * 6,
    );
  } catch (err) {
    if (err instanceof ApiFootballPlanError) return null;
    throw err;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = response as any;
  if (!raw || !raw.fixtures) return null;

  const played = raw.fixtures.played.total || 1;
  const wins = raw.fixtures.wins.total || 0;
  const draws = raw.fixtures.draws.total || 0;
  const loses = raw.fixtures.loses.total || 0;
  const yellow = Object.values(raw.cards?.yellow ?? {}).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, bucket: any) => sum + (bucket?.total ?? 0),
    0,
  ) as number;
  const red = Object.values(raw.cards?.red ?? {}).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, bucket: any) => sum + (bucket?.total ?? 0),
    0,
  ) as number;

  return {
    last5: (raw.form ?? "").slice(-5),
    goalsForAvg: parseFloat(raw.goals?.for?.average?.total ?? "0"),
    goalsAgainstAvg: parseFloat(raw.goals?.against?.average?.total ?? "0"),
    cleanSheetPct: ((raw.clean_sheet?.total ?? 0) / played) * 100,
    failedToScorePct: ((raw.failed_to_score?.total ?? 0) / played) * 100,
    yellowCardsAvg: yellow / played,
    redCardsTotal: red,
    winPct: (wins / played) * 100,
    drawPct: (draws / played) * 100,
    losePct: (loses / played) * 100,
    detailed: true,
  };
}

/** Approximates a FormSummary from the per-team last_5 block inside /predictions, for when /teams/statistics is unavailable (e.g. free-plan season restrictions). */
export function formSummaryFromPredictionForm(form: PredictionTeamForm | null): FormSummary {
  if (!form) {
    return {
      last5: "",
      goalsForAvg: 0,
      goalsAgainstAvg: 0,
      cleanSheetPct: null,
      failedToScorePct: null,
      yellowCardsAvg: null,
      redCardsTotal: null,
      winPct: 0,
      drawPct: 0,
      losePct: 0,
      detailed: false,
    };
  }
  // last_5.form/att/def are API-Football's own 0-100 ratings, not a literal
  // win rate — treat formPct as a rough win-tendency with a flat draw share.
  const winPct = Math.max(0, Math.min(90, form.formPct));
  const drawPct = 20;
  const losePct = Math.max(0, 100 - winPct - drawPct);
  return {
    last5: "",
    goalsForAvg: form.goalsForAvg,
    goalsAgainstAvg: form.goalsAgainstAvg,
    cleanSheetPct: null,
    failedToScorePct: null,
    yellowCardsAvg: null,
    redCardsTotal: null,
    winPct,
    drawPct,
    losePct,
    detailed: false,
  };
}

export async function getApiPrediction(fixtureId: number): Promise<ApiPredictionSummary | null> {
  const response = await apiFetch<unknown[]>("/predictions", { fixture: fixtureId }, 60 * 60 * 6);
  if (!response.length) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = response[0] as any;
  const p = raw.predictions;
  if (!p) return null;

  const parsePct = (v: string | undefined) => (v ? parseFloat(v.replace("%", "")) : 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseTeamForm = (team: any): PredictionTeamForm | null => {
    const last5 = team?.last_5;
    if (!last5) return null;
    return {
      played: last5.played ?? 0,
      formPct: parsePct(last5.form),
      attackPct: parsePct(last5.att),
      defensePct: parsePct(last5.def),
      goalsForAvg: parseFloat(last5.goals?.for?.average ?? "0"),
      goalsAgainstAvg: parseFloat(last5.goals?.against?.average ?? "0"),
    };
  };

  return {
    winnerTeamId: p.winner?.id ?? null,
    winnerComment: p.winner?.comment ?? null,
    advice: p.advice ?? null,
    winPct: {
      home: parsePct(p.percent?.home),
      draw: parsePct(p.percent?.draw),
      away: parsePct(p.percent?.away),
    },
    bttsPct: null,
    overUnderGoals: p.under_over
      ? { line: parseFloat(p.under_over), overPct: 50 }
      : null,
    comparison: raw.comparison
      ? {
          form: { home: parsePct(raw.comparison.form?.home), away: parsePct(raw.comparison.form?.away) },
          attack: { home: parsePct(raw.comparison.att?.home), away: parsePct(raw.comparison.att?.away) },
          defense: { home: parsePct(raw.comparison.def?.home), away: parsePct(raw.comparison.def?.away) },
          poisson: {
            home: parsePct(raw.comparison.poisson_distribution?.home),
            away: parsePct(raw.comparison.poisson_distribution?.away),
          },
          h2h: { home: parsePct(raw.comparison.h2h?.home), away: parsePct(raw.comparison.h2h?.away) },
          goals: { home: parsePct(raw.comparison.goals?.home), away: parsePct(raw.comparison.goals?.away) },
        }
      : null,
    teamForm: {
      home: parseTeamForm(raw.teams?.home),
      away: parseTeamForm(raw.teams?.away),
    },
  };
}

/**
 * Requires /players with a season the plan can access — on the free plan
 * this is restricted to 2022-2024, so a current-season request degrades to
 * an empty list rather than failing the whole insights fetch.
 */
export async function getTopScorerCandidates(
  homeTeamId: number,
  awayTeamId: number,
  leagueId: number,
  season: number,
): Promise<TopScorerCandidate[]> {
  const results = await Promise.all(
    [
      { teamId: homeTeamId, side: "home" as const },
      { teamId: awayTeamId, side: "away" as const },
    ].map(async ({ teamId, side }) => {
      let response: unknown[];
      try {
        response = await apiFetch<unknown[]>(
          "/players",
          { team: teamId, league: leagueId, season },
          60 * 60 * 12,
        );
      } catch (err) {
        if (err instanceof ApiFootballPlanError) return [];
        throw err;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (response as any[])
        .map((raw): TopScorerCandidate | null => {
          const stats = raw.statistics?.[0];
          if (!stats) return null;
          const goals = stats.goals?.total ?? 0;
          const minutes = stats.games?.minutes ?? 0;
          if (goals === 0 || minutes === 0) return null;
          return {
            playerId: raw.player.id,
            name: raw.player.name,
            photo: raw.player.photo ?? null,
            team: side,
            goalsSeason: goals,
            appearances: stats.games?.appearences ?? 0,
            minutesPlayed: minutes,
            goalsPer90: (goals / minutes) * 90,
          };
        })
        .filter((p): p is TopScorerCandidate => p !== null)
        .sort((a, b) => b.goalsSeason - a.goalsSeason)
        .slice(0, 5);
    }),
  );
  return [...results[0], ...results[1]];
}

async function getTeamRecentFixtureIds(teamId: number, last: number): Promise<number[]> {
  // Free plan rejects the `last` param on /fixtures outright (and rejects
  // `season` for anything outside 2022-2024), so there is no free-tier way
  // to list "this team's most recent matches vs anyone". Callers should
  // treat a thrown ApiFootballPlanError as "deep stats unavailable".
  const response = await apiFetch<unknown[]>("/fixtures", { team: teamId, last }, 60 * 60 * 12);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (response as any[])
    .filter((raw) => raw.fixture.status.short === "FT")
    .map((raw) => raw.fixture.id);
}

/** Corner/foul/shot averages from a team's recent matches. Requires plan access to `/fixtures?team=&last=`; returns null (not an error) when that's unavailable. */
export async function getRecentDeepStats(teamId: number, last = 5): Promise<DeepMatchStats | null> {
  let fixtureIds: number[];
  try {
    fixtureIds = await getTeamRecentFixtureIds(teamId, last);
  } catch (err) {
    if (err instanceof ApiFootballPlanError) return null;
    throw err;
  }
  if (!fixtureIds.length) return null;

  const perMatch = await Promise.all(
    fixtureIds.map(async (fixtureId) => {
      const response = await apiFetch<unknown[]>(
        "/fixtures/statistics",
        { fixture: fixtureId },
        60 * 60 * 24,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const teamBlock = (response as any[]).find((b) => b.team.id === teamId);
      if (!teamBlock) return null;
      const statistics = teamBlock.statistics as { type: string; value: unknown }[];
      const find = (type: string) => statistics.find((s) => s.type === type)?.value ?? null;
      const corners = find("Corner Kicks");
      const fouls = find("Fouls");
      const shotsOnTarget = find("Shots on Goal");
      const shotsTotal = find("Total Shots");
      return {
        corners: typeof corners === "number" ? corners : null,
        fouls: typeof fouls === "number" ? fouls : null,
        shotsOnTarget: typeof shotsOnTarget === "number" ? shotsOnTarget : null,
        shotsTotal: typeof shotsTotal === "number" ? shotsTotal : null,
      };
    }),
  );

  const valid = perMatch.filter((m): m is NonNullable<typeof m> => m !== null);
  if (!valid.length) return null;

  const avg = (key: keyof NonNullable<(typeof valid)[number]>) => {
    const values = valid.map((m) => m[key]).filter((v): v is number => v !== null);
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  return {
    cornersAvg: avg("corners"),
    foulsAvg: avg("fouls"),
    shotsOnTargetAvg: avg("shotsOnTarget"),
    shotsTotalAvg: avg("shotsTotal"),
    sampleSize: valid.length,
  };
}
