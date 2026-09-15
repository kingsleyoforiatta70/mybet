export interface League {
  id: number;
  name: string;
  country: string;
  logo: string;
  season: number;
}

export interface Team {
  id: number;
  name: string;
  logo: string;
}

export interface Fixture {
  id: number;
  date: string;
  timestamp: number;
  status: { short: string; long: string; elapsed: number | null };
  venue: { name: string | null; city: string | null };
  league: League;
  home: Team;
  away: Team;
}

export interface FormSummary {
  last5: string;
  goalsForAvg: number;
  goalsAgainstAvg: number;
  cleanSheetPct: number | null;
  failedToScorePct: number | null;
  yellowCardsAvg: number | null;
  redCardsTotal: number | null;
  winPct: number;
  drawPct: number;
  losePct: number;
  /** false when this summary is approximated from /predictions instead of /teams/statistics (e.g. free-plan season restrictions) */
  detailed: boolean;
}

export interface H2HMatch {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  winner: "home" | "away" | "draw";
}

export interface DeepMatchStats {
  cornersAvg: number;
  foulsAvg: number;
  shotsOnTargetAvg: number;
  shotsTotalAvg: number;
  sampleSize: number;
}

export interface TopScorerCandidate {
  playerId: number;
  name: string;
  photo: string | null;
  team: "home" | "away";
  goalsSeason: number;
  appearances: number;
  minutesPlayed: number;
  goalsPer90: number;
}

export interface PredictionTeamForm {
  played: number;
  formPct: number;
  attackPct: number;
  defensePct: number;
  goalsForAvg: number;
  goalsAgainstAvg: number;
}

export interface ApiPredictionSummary {
  winnerTeamId: number | null;
  winnerComment: string | null;
  advice: string | null;
  winPct: { home: number; draw: number; away: number };
  bttsPct: number | null;
  overUnderGoals: { line: number; overPct: number } | null;
  comparison: {
    form: { home: number; away: number };
    attack: { home: number; away: number };
    defense: { home: number; away: number };
    poisson: { home: number; away: number };
    h2h: { home: number; away: number };
    goals: { home: number; away: number };
  } | null;
  teamForm: { home: PredictionTeamForm | null; away: PredictionTeamForm | null } | null;
}

export interface MatchInsights {
  fixture: Fixture;
  homeForm: FormSummary;
  awayForm: FormSummary;
  h2h: H2HMatch[];
  homeDeepStats: DeepMatchStats | null;
  awayDeepStats: DeepMatchStats | null;
  topScorers: TopScorerCandidate[];
  apiPrediction: ApiPredictionSummary | null;
  dataSource: "live" | "mock";
}

export interface PredictionPick {
  market: string;
  selection: string;
  confidence: number;
  rationale: string[];
}

export interface OverUnderMarket {
  line: number;
  overPct: number;
  underPct: number;
  pick: PredictionPick;
}

export interface PredictionSet {
  headline: PredictionPick;
  matchResult: { home: number; draw: number; away: number; pick: PredictionPick };
  btts: { yesPct: number; noPct: number; pick: PredictionPick };
  totalGoals: OverUnderMarket;
  corners: OverUnderMarket | null;
  cards: OverUnderMarket | null;
  fouls: OverUnderMarket | null;
  shots: OverUnderMarket | null;
  correctScoreTop: { score: string; probability: number }[];
  playerToScore: { player: TopScorerCandidate; probability: number }[];
}
