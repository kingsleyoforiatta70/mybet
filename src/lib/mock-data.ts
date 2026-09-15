import type {
  ApiPredictionSummary,
  DeepMatchStats,
  Fixture,
  FormSummary,
  H2HMatch,
  TopScorerCandidate,
} from "./types";

// Well-known API-Football team/league ids so logos resolve against the real
// public CDN (media.api-sports.io) even while running in mock mode.
const LEAGUES = {
  premierLeague: { id: 39, name: "Premier League", country: "England", logo: "https://media.api-sports.io/football/leagues/39.png", season: 2025 },
  laLiga: { id: 140, name: "La Liga", country: "Spain", logo: "https://media.api-sports.io/football/leagues/140.png", season: 2025 },
  serieA: { id: 135, name: "Serie A", country: "Italy", logo: "https://media.api-sports.io/football/leagues/135.png", season: 2025 },
  bundesliga: { id: 78, name: "Bundesliga", country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png", season: 2025 },
};

function team(id: number, name: string) {
  return { id, name, logo: `https://media.api-sports.io/football/teams/${id}.png` };
}

const TEAMS = {
  manUtd: team(33, "Manchester United"),
  manCity: team(50, "Manchester City"),
  liverpool: team(40, "Liverpool"),
  arsenal: team(42, "Arsenal"),
  realMadrid: team(541, "Real Madrid"),
  barcelona: team(529, "Barcelona"),
  juventus: team(496, "Juventus"),
  inter: team(505, "Inter"),
  bayern: team(157, "Bayern Munich"),
  dortmund: team(165, "Borussia Dortmund"),
};

interface MockFixtureSeed {
  id: number;
  league: (typeof LEAGUES)[keyof typeof LEAGUES];
  home: (typeof TEAMS)[keyof typeof TEAMS];
  away: (typeof TEAMS)[keyof typeof TEAMS];
  hoursFromNow: number;
}

function buildSeeds(): MockFixtureSeed[] {
  return [
    { id: 1000001, league: LEAGUES.premierLeague, home: TEAMS.manCity, away: TEAMS.arsenal, hoursFromNow: 2 },
    { id: 1000002, league: LEAGUES.premierLeague, home: TEAMS.liverpool, away: TEAMS.manUtd, hoursFromNow: 4.5 },
    { id: 1000003, league: LEAGUES.laLiga, home: TEAMS.realMadrid, away: TEAMS.barcelona, hoursFromNow: 6 },
    { id: 1000004, league: LEAGUES.serieA, home: TEAMS.juventus, away: TEAMS.inter, hoursFromNow: 1 },
    { id: 1000005, league: LEAGUES.bundesliga, home: TEAMS.bayern, away: TEAMS.dortmund, hoursFromNow: 3 },
    { id: 1000006, league: LEAGUES.laLiga, home: TEAMS.barcelona, away: TEAMS.realMadrid, hoursFromNow: -20 },
  ];
}

function toFixture(seed: MockFixtureSeed): Fixture {
  const kickoff = new Date(Date.now() + seed.hoursFromNow * 60 * 60 * 1000);
  const isPast = seed.hoursFromNow < 0;
  return {
    id: seed.id,
    date: kickoff.toISOString(),
    timestamp: Math.floor(kickoff.getTime() / 1000),
    status: isPast
      ? { short: "FT", long: "Match Finished", elapsed: 90 }
      : { short: "NS", long: "Not Started", elapsed: null },
    venue: { name: `${seed.home.name} Stadium`, city: null },
    league: seed.league,
    home: seed.home,
    away: seed.away,
  };
}

export function mockFixturesForToday(): Fixture[] {
  return buildSeeds().map(toFixture);
}

// Deterministic seeded RNG so numbers stay stable per fixture across renders.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mockForm(rand: () => number): FormSummary {
  const results = ["W", "D", "L"];
  const last5 = Array.from({ length: 5 }, () => results[Math.floor(rand() * 3)]).join("");
  const wins = (last5.match(/W/g) ?? []).length;
  const draws = (last5.match(/D/g) ?? []).length;
  const losses = 5 - wins - draws;
  return {
    last5,
    goalsForAvg: parseFloat((1 + rand() * 1.8).toFixed(2)),
    goalsAgainstAvg: parseFloat((0.5 + rand() * 1.5).toFixed(2)),
    cleanSheetPct: parseFloat((rand() * 50).toFixed(1)),
    failedToScorePct: parseFloat((rand() * 30).toFixed(1)),
    yellowCardsAvg: parseFloat((1.2 + rand() * 1.8).toFixed(2)),
    redCardsTotal: Math.floor(rand() * 3),
    winPct: (wins / 5) * 100,
    drawPct: (draws / 5) * 100,
    losePct: (losses / 5) * 100,
    detailed: true,
  };
}

function mockH2H(rand: () => number, homeName: string, awayName: string): H2HMatch[] {
  return Array.from({ length: 5 }, (_, i) => {
    const homeGoals = Math.floor(rand() * 4);
    const awayGoals = Math.floor(rand() * 4);
    const winner = homeGoals === awayGoals ? "draw" : homeGoals > awayGoals ? "home" : "away";
    const date = new Date(Date.now() - (i + 1) * 200 * 24 * 60 * 60 * 1000).toISOString();
    return { date, homeTeam: homeName, awayTeam: awayName, homeGoals, awayGoals, winner: winner as H2HMatch["winner"] };
  });
}

function mockDeepStats(rand: () => number): DeepMatchStats {
  return {
    cornersAvg: parseFloat((4 + rand() * 4).toFixed(1)),
    foulsAvg: parseFloat((9 + rand() * 6).toFixed(1)),
    shotsOnTargetAvg: parseFloat((3 + rand() * 4).toFixed(1)),
    shotsTotalAvg: parseFloat((9 + rand() * 6).toFixed(1)),
    sampleSize: 5,
  };
}

function mockTopScorers(
  rand: () => number,
  homeTeamId: number,
  homeNames: string[],
  awayTeamId: number,
  awayNames: string[],
): TopScorerCandidate[] {
  const build = (teamId: number, side: "home" | "away", names: string[]): TopScorerCandidate[] =>
    names.map((name, i) => {
      const minutes = 900 + Math.floor(rand() * 1500);
      const goals = Math.max(1, Math.floor((6 - i * 1.5) + rand() * 4));
      return {
        playerId: teamId * 100 + i,
        name,
        photo: null,
        team: side,
        goalsSeason: goals,
        appearances: Math.floor(minutes / 75),
        minutesPlayed: minutes,
        goalsPer90: parseFloat(((goals / minutes) * 90).toFixed(2)),
      };
    });
  return [...build(homeTeamId, "home", homeNames), ...build(awayTeamId, "away", awayNames)];
}

const PLAYER_POOL = [
  "A. Silva", "L. Fernandes", "K. Owusu", "R. Martins", "T. Haaland",
  "M. Torres", "D. Costa", "J. Alvarez", "S. Ramos", "P. Diallo",
];

function mockApiPrediction(rand: () => number): ApiPredictionSummary {
  const home = 30 + rand() * 40;
  const away = 30 + rand() * 40;
  const draw = Math.max(5, 100 - home - away);
  const total = home + draw + away;
  return {
    winnerTeamId: null,
    winnerComment: null,
    advice: null,
    winPct: {
      home: parseFloat(((home / total) * 100).toFixed(1)),
      draw: parseFloat(((draw / total) * 100).toFixed(1)),
      away: parseFloat(((away / total) * 100).toFixed(1)),
    },
    bttsPct: parseFloat((40 + rand() * 40).toFixed(1)),
    overUnderGoals: { line: 2.5, overPct: parseFloat((40 + rand() * 40).toFixed(1)) },
    comparison: {
      form: { home: parseFloat((rand() * 100).toFixed(0)), away: parseFloat((rand() * 100).toFixed(0)) },
      attack: { home: parseFloat((rand() * 100).toFixed(0)), away: parseFloat((rand() * 100).toFixed(0)) },
      defense: { home: parseFloat((rand() * 100).toFixed(0)), away: parseFloat((rand() * 100).toFixed(0)) },
      poisson: { home: parseFloat((rand() * 100).toFixed(0)), away: parseFloat((rand() * 100).toFixed(0)) },
      h2h: { home: parseFloat((rand() * 100).toFixed(0)), away: parseFloat((rand() * 100).toFixed(0)) },
      goals: { home: parseFloat((rand() * 100).toFixed(0)), away: parseFloat((rand() * 100).toFixed(0)) },
    },
    teamForm: null,
  };
}

export function mockInsightsFor(fixtureId: number) {
  const seed = buildSeeds().find((s) => s.id === fixtureId) ?? buildSeeds()[0];
  const fixture = toFixture(seed);
  const rand = mulberry32(fixtureId);

  const homeNames = PLAYER_POOL.slice(0, 5);
  const awayNames = PLAYER_POOL.slice(5, 10);

  return {
    fixture,
    homeForm: mockForm(rand),
    awayForm: mockForm(rand),
    h2h: mockH2H(rand, seed.home.name, seed.away.name),
    homeDeepStats: mockDeepStats(rand),
    awayDeepStats: mockDeepStats(rand),
    topScorers: mockTopScorers(rand, seed.home.id, homeNames, seed.away.id, awayNames),
    apiPrediction: mockApiPrediction(rand),
    dataSource: "mock" as const,
  };
}
