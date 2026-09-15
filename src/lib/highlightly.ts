import type { DeepMatchStats } from "./types";

const BASE_URL = "https://soccer.highlightly.net";

function getKey(): string | null {
  return process.env.HIGHLIGHTLY_API_KEY || null;
}

export function hasHighlightlyKey(): boolean {
  return Boolean(getKey());
}

async function hlFetch<T>(path: string, revalidateSeconds: number): Promise<T> {
  const key = getKey();
  if (!key) throw new Error("HIGHLIGHTLY_API_KEY is not set");
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-rapidapi-key": key },
    next: { revalidate: revalidateSeconds },
  });
  if (!res.ok) throw new Error(`Highlightly request failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\b(fc|cf|afc|sc|ac)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface HlMatch { [key: string]: any }

/**
 * Highlightly uses its own team/match IDs, unrelated to API-Football's.
 * We bridge the two by matching on kickoff date + team names, since that's
 * the only shared reference point between providers.
 */
export async function findHighlightlyMatch(
  homeTeamName: string,
  awayTeamName: string,
  isoDate: string,
): Promise<{ matchId: number; homeTeamId: number; awayTeamId: number } | null> {
  const date = isoDate.slice(0, 10);
  let matches: HlMatch[];
  try {
    const response = await hlFetch<{ data: HlMatch[] }>(`/matches?date=${date}`, 60 * 60 * 6);
    matches = response.data ?? [];
  } catch {
    return null;
  }
  const match = matches.find(
    (m) => namesMatch(m.homeTeam?.name ?? "", homeTeamName) && namesMatch(m.awayTeam?.name ?? "", awayTeamName),
  );
  if (!match) return null;
  return { matchId: match.id, homeTeamId: match.homeTeam.id, awayTeamId: match.awayTeam.id };
}

interface HlTeamMatchStats {
  cornersFor: number;
  foulsFor: number;
  shotsOnTargetFor: number;
  shotsTotalFor: number;
  yellowCardsFor: number;
  redCardsFor: number;
}

async function getMatchStatistics(matchId: number, teamId: number): Promise<HlTeamMatchStats | null> {
  let blocks: HlMatch[];
  try {
    blocks = await hlFetch<HlMatch[]>(`/statistics/${matchId}`, 60 * 60 * 24);
  } catch {
    return null;
  }
  const block = blocks.find((b) => b.team?.id === teamId);
  if (!block) return null;
  const find = (label: string) =>
    (block.statistics as { displayName: string; value: number }[]).find((s) => s.displayName === label)?.value ?? 0;
  return {
    cornersFor: find("Corners"),
    foulsFor: find("Fouls"),
    shotsOnTargetFor: find("Shots on target"),
    shotsTotalFor: find("Shots on target") + find("Shots off target"),
    yellowCardsFor: find("Yellow cards"),
    redCardsFor: find("Red cards"),
  };
}

async function getTeamRecentFinishedMatchIds(teamId: number, beforeIso: string, count: number): Promise<number[]> {
  const [homeRes, awayRes] = await Promise.all([
    hlFetch<{ data: HlMatch[] }>(`/matches?homeTeamId=${teamId}`, 60 * 60 * 6),
    hlFetch<{ data: HlMatch[] }>(`/matches?awayTeamId=${teamId}`, 60 * 60 * 6),
  ]);
  const before = new Date(beforeIso).getTime();
  return [...homeRes.data, ...awayRes.data]
    .filter((m) => m.state?.description === "Finished" && new Date(m.date).getTime() < before)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, count)
    .map((m) => m.id);
}

/** Corner/foul/card/shot averages for a team's last N finished matches (any competition), sourced from Highlightly. */
export async function getHighlightlyDeepStats(
  teamId: number,
  beforeIso: string,
  count = 5,
): Promise<(DeepMatchStats & { cardsYellowAvg: number; cardsRedAvg: number }) | null> {
  const matchIds = await getTeamRecentFinishedMatchIds(teamId, beforeIso, count);
  if (!matchIds.length) return null;

  const perMatch = await Promise.all(matchIds.map((id) => getMatchStatistics(id, teamId)));
  const valid = perMatch.filter((m): m is HlTeamMatchStats => m !== null);
  if (!valid.length) return null;

  const avg = (key: keyof HlTeamMatchStats) => valid.reduce((sum, m) => sum + m[key], 0) / valid.length;

  return {
    cornersAvg: avg("cornersFor"),
    foulsAvg: avg("foulsFor"),
    shotsOnTargetAvg: avg("shotsOnTargetFor"),
    shotsTotalAvg: avg("shotsTotalFor"),
    cardsYellowAvg: avg("yellowCardsFor"),
    cardsRedAvg: avg("redCardsFor"),
    sampleSize: valid.length,
  };
}
