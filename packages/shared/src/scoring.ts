/** Results below this mark are flagged so the teacher can offer help. */
export const PASS_MARK = 50;
export const MAX_SCORE = 100;

export function isLow(score: number): boolean {
  return score < PASS_MARK;
}

export function average(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

/** Both attestations are required; missing values are not treated as zero. */
export function attestationAverage(first: number | null, second: number | null): number | null {
  if (first === null || second === null) return null;
  return Math.round(((first + second) / 2) * 100) / 100;
}
