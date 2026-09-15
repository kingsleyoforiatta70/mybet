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
