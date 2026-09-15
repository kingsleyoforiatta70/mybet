function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/** P(X >= 1) for a Poisson variable with the given rate. */
export function poissonAtLeastOne(lambda: number): number {
  return 1 - Math.exp(-lambda);
}

export function topCorrectScores(
  lambdaHome: number,
  lambdaAway: number,
  max = 6,
  top = 3,
): { score: string; probability: number }[] {
  const scores: { score: string; probability: number }[] = [];
  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      scores.push({ score: `${h}-${a}`, probability: poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway) });
    }
  }
  return scores.sort((a, b) => b.probability - a.probability).slice(0, top);
}
