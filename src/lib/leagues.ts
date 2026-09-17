// Today's global fixture list from API-Football includes hundreds of matches
// across obscure divisions worldwide. Computing predictions for all of them
// would blow through the free-tier daily quota, so the predictions table is
// scoped to a curated set of well-tracked leagues.
export const FEATURED_LEAGUE_IDS = new Set([
  39, // Premier League (England)
  140, // La Liga (Spain)
  135, // Serie A (Italy)
  78, // Bundesliga (Germany)
  61, // Ligue 1 (France)
  2, // UEFA Champions League
  3, // UEFA Europa League
  88, // Eredivisie (Netherlands)
  94, // Primeira Liga (Portugal)
]);

// Rough prestige ordering for the "Other Matches" list: continental
// competitions and the biggest domestic leagues first, lower rank = shown
// first. Leagues not listed here still sort correctly — they just fall back
// to the "European, alphabetical" or "rest of the world, alphabetical"
// buckets below instead of getting an individual position.
export const LEAGUE_RANK: Record<number, number> = {
  2: 1, // UEFA Champions League
  3: 2, // UEFA Europa League
  848: 3, // UEFA Europa Conference League
  39: 10, // Premier League (England)
  140: 11, // La Liga (Spain)
  78: 12, // Bundesliga (Germany)
  135: 13, // Serie A (Italy)
  61: 14, // Ligue 1 (France)
  88: 20, // Eredivisie (Netherlands)
  94: 21, // Primeira Liga (Portugal)
  144: 22, // Belgian Pro League
  203: 23, // Süper Lig (Turkey)
  179: 24, // Scottish Premiership
  40: 30, // Championship (England, 2nd tier)
  141: 31, // La Liga 2 (Spain)
  79: 32, // 2. Bundesliga (Germany)
  136: 33, // Serie B (Italy)
  62: 34, // Ligue 2 (France)
};

// API-Football's `country` field uses these hyphenated English names.
// Confederation-level competitions (Champions League, etc.) use "World" and
// are handled separately via LEAGUE_RANK, not this set.
export const EUROPEAN_COUNTRIES = new Set([
  "England", "Spain", "Germany", "Italy", "France", "Netherlands", "Portugal",
  "Belgium", "Scotland", "Wales", "Northern-Ireland", "Ireland", "Turkey",
  "Austria", "Switzerland", "Greece", "Russia", "Ukraine", "Poland",
  "Czech-Republic", "Denmark", "Sweden", "Norway", "Finland", "Iceland",
  "Croatia", "Serbia", "Romania", "Hungary", "Bulgaria", "Slovakia",
  "Slovenia", "Bosnia", "Cyprus", "Israel", "Georgia", "Armenia",
  "Azerbaijan", "Kazakhstan", "Luxembourg", "Malta", "Montenegro",
  "North-Macedonia", "Albania", "Estonia", "Latvia", "Lithuania", "Moldova",
  "Andorra", "San-Marino", "Gibraltar", "Faroe-Islands", "Kosovo",
  "Liechtenstein", "Belarus",
]);

function leagueSortKey(league: { id: number; country: string; name: string }): [number, string] {
  const rank = LEAGUE_RANK[league.id];
  if (rank !== undefined) return [rank, ""];
  const isEuropean = EUROPEAN_COUNTRIES.has(league.country);
  // Ranked leagues (1-999) sort first, then unranked European (bucket
  // 1000s, alphabetical by country/league), then everything else (2000s).
  const bucket = isEuropean ? 1000 : 2000;
  return [bucket, `${league.country} ${league.name}`.toLowerCase()];
}

/** Sorts leagues: ranked European competitions/leagues first (by prestige), then remaining European leagues alphabetically, then the rest of the world alphabetically. */
export function compareLeagues(
  a: { id: number; country: string; name: string },
  b: { id: number; country: string; name: string },
): number {
  const [rankA, keyA] = leagueSortKey(a);
  const [rankB, keyB] = leagueSortKey(b);
  if (rankA !== rankB) return rankA - rankB;
  return keyA.localeCompare(keyB);
}
