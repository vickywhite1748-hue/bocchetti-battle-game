export type RandomSource = () => number;

export const defaultRandom: RandomSource = Math.random;

export function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const next = [...items];

  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = next[i];
    const replacement = next[j];

    if (current === undefined || replacement === undefined) {
      throw new Error("Shuffle index out of bounds.");
    }

    next[i] = replacement;
    next[j] = current;
  }

  return next;
}
