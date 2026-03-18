import type { OpeningCatalogEntry } from '@/domain/opening';

interface RankedOpening {
  opening: OpeningCatalogEntry;
  score: number;
}

function scoreOpening(opening: OpeningCatalogEntry, query: string): number {
  if (!query) {
    return 1;
  }

  let score = 0;

  if (opening.eco.toLowerCase() === query) {
    score += 100;
  }
  if (opening.canonicalName.toLowerCase().includes(query)) {
    score += 80;
  }
  if (opening.aliases.some((alias) => alias.toLowerCase().includes(query))) {
    score += 60;
  }
  if (opening.movePreviewSan.toLowerCase().includes(query)) {
    score += 40;
  }
  if (opening.movePreviewUci.includes(query)) {
    score += 30;
  }
  if (opening.family.toLowerCase().includes(query)) {
    score += 20;
  }

  return score;
}

export function searchOpenings(openings: OpeningCatalogEntry[], query: string): OpeningCatalogEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return openings;
  }

  return openings
    .map((opening): RankedOpening => ({
      opening,
      score: scoreOpening(opening, normalizedQuery),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.opening.canonicalName.localeCompare(right.opening.canonicalName),
    )
    .map(({ opening }) => opening);
}
