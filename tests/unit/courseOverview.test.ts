import { describe, expect, it } from 'vitest';
import { buildCourseSummaries, pickRepresentativeOpening } from '@/lib/chess/courseOverview';
import { buildFamilyIndex } from '@/lib/chess/familyIndex';
import { toCatalogEntry } from '@/lib/chess/openingGraph';
import { sampleOpenings } from '../fixtures/sampleOpenings';

describe('courseOverview', () => {
  it('prefers a study-ready representative instead of the shallowest line', () => {
    const catalog = [
      toCatalogEntry({
        ...sampleOpenings[4],
        family: 'Sicilian Defense',
        canonicalName: 'Sicilian Defense',
        subvariation: 'Main line',
      }),
      toCatalogEntry({
        ...sampleOpenings[4],
        id: 'sicilian-main-6',
        family: 'Sicilian Defense',
        canonicalName: 'Sicilian Defense: Classical',
        subvariation: 'Classical',
        eco: 'B56',
        depth: 6,
        pgn: '1. e4 c5 2. Nf3 Nc6 3. d4',
        uciMoves: ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4'],
      }),
    ];

    const representative = pickRepresentativeOpening(catalog, 5);
    expect(representative?.id).toBe('sicilian-main-6');
  });

  it('summarizes study-ready course counts at the requested depth', () => {
    const catalog = sampleOpenings.map((opening) => toCatalogEntry(opening));
    const familyIndex = buildFamilyIndex(catalog);
    const summaries = buildCourseSummaries(familyIndex, 5);
    const openGame = summaries.find((summary) => summary.displayName === 'Open Game');

    expect(openGame).toMatchObject({
      openingCount: 2,
      studyReadyCount: 2,
      minDepth: 5,
      maxDepth: 6,
      effectiveMinDepth: 5,
      effectiveMaxDepth: 6,
    });
  });
});
