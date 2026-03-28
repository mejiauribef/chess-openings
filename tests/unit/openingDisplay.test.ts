import { describe, expect, it } from 'vitest';
import type { OpeningCatalogEntry } from '@/domain/opening';
import {
  buildCourseVariationDisplays,
  buildOpeningSourceMetaMap,
  normalizeOpeningText,
} from '@/lib/chess/openingDisplay';

describe('openingDisplay', () => {
  it('normalizes spacing, colon spacing and Defence spelling for UI labels', () => {
    expect(normalizeOpeningText('Alekhine Defence:Krejcik  Variation')).toBe(
      'Alekhine Defense: Krejcik Variation',
    );
  });

  it('groups visually equivalent variations into one display card', () => {
    const openings: OpeningCatalogEntry[] = [
      {
        id: 'sic-1',
        eco: 'B20',
        canonicalName: 'Sicilian Defence',
        aliases: ['Sicilian'],
        family: 'Sicilian Defence',
        subvariation: 'Main line',
        depth: 5,
        bucketKey: 'b',
        movePreviewSan: '1. e4 c5',
        movePreviewUci: 'e2e4 c7c5',
      },
      {
        id: 'sic-2',
        eco: 'B20',
        canonicalName: 'Sicilian Defense',
        aliases: ['Sicilian'],
        family: 'Sicilian Defense',
        subvariation: 'Main line',
        depth: 6,
        bucketKey: 'b',
        movePreviewSan: '1. e4 c5',
        movePreviewUci: 'e2e4 c7c5',
      },
    ];

    const grouped = buildCourseVariationDisplays(openings);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      displayTitle: 'Sicilian Defense',
      displayFamily: 'Sicilian Defense',
      displaySubtitle: 'Main line',
      ecoLabel: 'B20',
      namedLineCount: 2,
      minDepth: 5,
      maxDepth: 6,
    });
  });

  it('builds per-opening source meta from grouped display entries', () => {
    const openings: OpeningCatalogEntry[] = [
      {
        id: 'sic-1',
        eco: 'B20',
        canonicalName: 'Sicilian Defence',
        aliases: [],
        family: 'Sicilian Defence',
        subvariation: 'Main line',
        depth: 5,
        bucketKey: 'b',
        movePreviewSan: '1. e4 c5',
        movePreviewUci: 'e2e4 c7c5',
      },
      {
        id: 'sic-2',
        eco: 'B20',
        canonicalName: 'Sicilian Defense',
        aliases: [],
        family: 'Sicilian Defense',
        subvariation: 'Main line',
        depth: 6,
        bucketKey: 'b',
        movePreviewSan: '1. e4 c5',
        movePreviewUci: 'e2e4 c7c5',
      },
    ];

    const grouped = buildCourseVariationDisplays(openings);
    const metaById = buildOpeningSourceMetaMap(grouped);

    expect(metaById['sic-1']).toMatchObject({
      displayTitle: 'Sicilian Defense',
      displaySubtitle: 'Main line',
      ecoLabel: 'B20',
      namedLineCount: 2,
      minDepth: 5,
      maxDepth: 6,
    });
    expect(metaById['sic-2']?.displayKey).toBe(metaById['sic-1']?.displayKey);
  });
});
