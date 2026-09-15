import type { MatchInsights, OverUnderMarket, PredictionPick, PredictionSet } from "../types";
import { poissonAtLeastOne, topCorrectScores } from "./poisson";

const HOME_ADVANTAGE = 8;

function clampPct(n: number): number {
  return Math.min(96, Math.max(4, n));
}

function makePick(market: string, selection: string, confidence: number, rationale: string[]): PredictionPick {
  return { market, selection, confidence: Math.round(clampPct(confidence)), rationale };
}

function overUnderMarket(
  market: string,
  line: number,
  expected: number,
  spread: number,
  rationale: string[],
): OverUnderMarket {
  // Logistic-style mapping from "expected vs line" gap to an over probability.
  const gap = expected - line;
  const overPct = clampPct(50 + gap * spread);
  const underPct = 100 - overPct;
  const selection = overPct >= underPct ? `Over ${line}` : `Under ${line}`;
  return {
    line,
    overPct: Math.round(overPct),
    underPct: Math.round(underPct),
    pick: makePick(market, selection, Math.max(overPct, underPct), rationale),
  };
}

export function buildPredictions(insights: MatchInsights): PredictionSet {
  const { fixture, homeForm, awayForm, h2h, homeDeepStats, awayDeepStats, topScorers, apiPrediction } = insights;

  // ---------- Match result ----------
  const formTotal = homeForm.winPct + homeForm.drawPct + homeForm.losePct || 1;
  const formHomeWin = (homeForm.winPct / formTotal) * 100;
  const formAwayWin = (awayForm.winPct / formTotal) * 100;
  const formDraw = 100 - formHomeWin - formAwayWin;

  const h2hTotal = h2h.length || 1;
  const h2hHomeWin = (h2h.filter((m) => m.winner === "home").length / h2hTotal) * 100;
  const h2hAwayWin = (h2h.filter((m) => m.winner === "away").length / h2hTotal) * 100;
  const h2hDraw = 100 - h2hHomeWin - h2hAwayWin;

  let homeWin: number;
  let draw: number;
  let awayWin: number;

  if (apiPrediction) {
    homeWin = apiPrediction.winPct.home * 0.5 + formHomeWin * 0.3 + h2hHomeWin * 0.2 + HOME_ADVANTAGE * 0.3;
    draw = apiPrediction.winPct.draw * 0.5 + formDraw * 0.3 + h2hDraw * 0.2;
    awayWin = apiPrediction.winPct.away * 0.5 + formAwayWin * 0.3 + h2hAwayWin * 0.2;
  } else {
    homeWin = formHomeWin * 0.6 + h2hHomeWin * 0.4 + HOME_ADVANTAGE;
    draw = formDraw * 0.6 + h2hDraw * 0.4;
    awayWin = formAwayWin * 0.6 + h2hAwayWin * 0.4;
  }

  const resultTotal = homeWin + draw + awayWin || 1;
  homeWin = (homeWin / resultTotal) * 100;
  draw = (draw / resultTotal) * 100;
  awayWin = (awayWin / resultTotal) * 100;

  const resultRationale: string[] = [
    `${fixture.home.name} recent form: ${homeForm.last5 || "n/a"} (${homeForm.goalsForAvg.toFixed(1)} goals/game for, ${homeForm.goalsAgainstAvg.toFixed(1)} against)`,
    `${fixture.away.name} recent form: ${awayForm.last5 || "n/a"} (${awayForm.goalsForAvg.toFixed(1)} goals/game for, ${awayForm.goalsAgainstAvg.toFixed(1)} against)`,
  ];
  if (h2h.length) {
    resultRationale.push(
      `Head-to-head (last ${h2h.length}): ${fixture.home.name} won ${h2h.filter((m) => m.winner === "home").length}, draws ${h2h.filter((m) => m.winner === "draw").length}, ${fixture.away.name} won ${h2h.filter((m) => m.winner === "away").length}`,
    );
  }
  if (apiPrediction?.advice) resultRationale.push(apiPrediction.advice);

  const resultBest =
    homeWin >= draw && homeWin >= awayWin
      ? makePick("Match Result", `${fixture.home.name} Win`, homeWin, resultRationale)
      : awayWin >= draw
        ? makePick("Match Result", `${fixture.away.name} Win`, awayWin, resultRationale)
        : makePick("Match Result", "Draw", draw, resultRationale);

  // ---------- Expected goals (shared by BTTS / totals / correct score) ----------
  const lambdaHome = Math.max(0.3, (homeForm.goalsForAvg + awayForm.goalsAgainstAvg) / 2 + 0.15);
  const lambdaAway = Math.max(0.2, (awayForm.goalsForAvg + homeForm.goalsAgainstAvg) / 2);
  const expectedTotalGoals = lambdaHome + lambdaAway;

  // ---------- BTTS ----------
  // Poisson estimate from expected goals is always available; blend in form
  // and h2h signals only when that data actually exists (free-plan form
  // summaries won't have failedToScorePct).
  const bttsFromGoals = poissonAtLeastOne(lambdaHome) * poissonAtLeastOne(lambdaAway) * 100;
  const bttsFromForm =
    homeForm.failedToScorePct != null && awayForm.failedToScorePct != null
      ? ((100 - homeForm.failedToScorePct) / 100) * ((100 - awayForm.failedToScorePct) / 100) * 100
      : null;
  const h2hBtts = h2h.length
    ? (h2h.filter((m) => m.homeGoals > 0 && m.awayGoals > 0).length / h2h.length) * 100
    : null;

  let bttsWeightedSum = bttsFromGoals * 0.5;
  let bttsWeightTotal = 0.5;
  if (h2hBtts != null) {
    bttsWeightedSum += h2hBtts * 0.3;
    bttsWeightTotal += 0.3;
  }
  if (bttsFromForm != null) {
    bttsWeightedSum += bttsFromForm * 0.2;
    bttsWeightTotal += 0.2;
  }
  const bttsYesPct = clampPct(bttsWeightedSum / bttsWeightTotal);
  const bttsRationale = [
    `Model expects ${fixture.home.name} ~${lambdaHome.toFixed(2)} goals and ${fixture.away.name} ~${lambdaAway.toFixed(2)} goals`,
    ...(bttsFromForm != null
      ? [
          `${fixture.home.name} failed to score in ${homeForm.failedToScorePct!.toFixed(0)}% of recent games`,
          `${fixture.away.name} failed to score in ${awayForm.failedToScorePct!.toFixed(0)}% of recent games`,
        ]
      : []),
    h2hBtts != null ? `${h2hBtts.toFixed(0)}% of head-to-head meetings saw both teams score` : "No head-to-head data available",
  ];
  const btts = {
    yesPct: Math.round(bttsYesPct),
    noPct: Math.round(100 - bttsYesPct),
    pick: makePick("Both Teams to Score", bttsYesPct >= 50 ? "Yes" : "No", Math.max(bttsYesPct, 100 - bttsYesPct), bttsRationale),
  };

  // ---------- Total goals over/under ----------
  const totalGoals = overUnderMarket("Total Goals", 2.5, expectedTotalGoals, 18, [
    `Model expects ~${expectedTotalGoals.toFixed(2)} goals combined, based on attack/defense averages`,
    `${fixture.home.name} concedes ${homeForm.goalsAgainstAvg.toFixed(1)}/game, ${fixture.away.name} concedes ${awayForm.goalsAgainstAvg.toFixed(1)}/game`,
  ]);

  // ---------- Corners ----------
  const corners =
    homeDeepStats && awayDeepStats
      ? overUnderMarket(
          "Total Corners",
          9.5,
          homeDeepStats.cornersAvg + awayDeepStats.cornersAvg,
          6,
          [
            `${fixture.home.name} averages ${homeDeepStats.cornersAvg.toFixed(1)} corners/game over last ${homeDeepStats.sampleSize}`,
            `${fixture.away.name} averages ${awayDeepStats.cornersAvg.toFixed(1)} corners/game over last ${awayDeepStats.sampleSize}`,
          ],
        )
      : null;

  // ---------- Total shots ----------
  const shots =
    homeDeepStats && awayDeepStats
      ? overUnderMarket(
          "Total Shots",
          24.5,
          homeDeepStats.shotsTotalAvg + awayDeepStats.shotsTotalAvg,
          2.5,
          [
            `${fixture.home.name} averages ${homeDeepStats.shotsTotalAvg.toFixed(1)} shots/game (${homeDeepStats.shotsOnTargetAvg.toFixed(1)} on target) over last ${homeDeepStats.sampleSize}`,
            `${fixture.away.name} averages ${awayDeepStats.shotsTotalAvg.toFixed(1)} shots/game (${awayDeepStats.shotsOnTargetAvg.toFixed(1)} on target) over last ${awayDeepStats.sampleSize}`,
          ],
        )
      : null;

  // ---------- Cards ----------
  const cards =
    homeForm.yellowCardsAvg != null && awayForm.yellowCardsAvg != null
      ? overUnderMarket(
          "Total Cards",
          3.5,
          homeForm.yellowCardsAvg + awayForm.yellowCardsAvg + ((homeForm.redCardsTotal ?? 0) + (awayForm.redCardsTotal ?? 0)) * 0.1,
          14,
          [
            `${fixture.home.name} averages ${homeForm.yellowCardsAvg.toFixed(1)} yellow cards/game`,
            `${fixture.away.name} averages ${awayForm.yellowCardsAvg.toFixed(1)} yellow cards/game`,
          ],
        )
      : null;

  // ---------- Fouls ----------
  const fouls =
    homeDeepStats && awayDeepStats
      ? overUnderMarket(
          "Total Fouls",
          22.5,
          homeDeepStats.foulsAvg + awayDeepStats.foulsAvg,
          3,
          [
            `${fixture.home.name} averages ${homeDeepStats.foulsAvg.toFixed(1)} fouls/game over last ${homeDeepStats.sampleSize}`,
            `${fixture.away.name} averages ${awayDeepStats.foulsAvg.toFixed(1)} fouls/game over last ${awayDeepStats.sampleSize}`,
          ],
        )
      : null;

  // ---------- Correct score ----------
  const correctScoreTop = topCorrectScores(lambdaHome, lambdaAway).map((s) => ({
    score: s.score,
    probability: Math.round(s.probability * 1000) / 10,
  }));

  // ---------- Player to score ----------
  const playerToScore = [...topScorers]
    .map((player) => {
      const sideBoost = player.team === "home" ? 1.05 : 0.97;
      const lambda = player.goalsPer90 * sideBoost;
      return { player, probability: Math.round(poissonAtLeastOne(lambda) * 1000) / 10 };
    })
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 6);

  // ---------- Headline (best single bet across markets) ----------
  const candidates: PredictionPick[] = [resultBest, btts.pick, totalGoals.pick];
  if (cards) candidates.push(cards.pick);
  if (corners) candidates.push(corners.pick);
  if (fouls) candidates.push(fouls.pick);
  if (shots) candidates.push(shots.pick);
  const headline = candidates.reduce((best, cur) => (cur.confidence > best.confidence ? cur : best));

  return {
    headline,
    matchResult: { home: Math.round(homeWin), draw: Math.round(draw), away: Math.round(awayWin), pick: resultBest },
    btts,
    totalGoals,
    corners,
    shots,
    cards,
    fouls,
    correctScoreTop,
    playerToScore,
  };
}
