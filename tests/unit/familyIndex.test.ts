import { normalizeFamily, buildFamilyIndex } from '@/lib/chess/familyIndex';
import type { OpeningCatalogEntry } from '@/domain/opening';

describe('normalizeFamily', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(normalizeFamily('Ruy Lopez')).toBe('ruy-lopez');
  });

  it('strips trailing "Defense"', () => {
    expect(normalizeFamily('Sicilian Defense')).toBe('sicilian');
  });

  it('strips trailing "Opening"', () => {
    expect(normalizeFamily('English Opening')).toBe('english');
  });

  it('strips trailing "Game"', () => {
    expect(normalizeFamily('Italian Game')).toBe('italian');
  });

  it('collapses whitespace', () => {
    expect(normalizeFamily('  Queen\'s   Gambit  ')).toBe("queen's-gambit");
  });

  it('merges "Sicilian" and "Sicilian Defense" to same key', () => {
    expect(normalizeFamily('Sicilian')).toBe(normalizeFamily('Sicilian Defense'));
  });
});

describe('buildFamilyIndex', () => {
  const entries: OpeningCatalogEntry[] = [
    { id: 'sic-1', eco: 'B20', canonicalName: 'Sicilian', aliases: [], family: 'Sicilian Defense', subvariation: 'Main', depth: 2, bucketKey: 'B', movePreviewSan: '1.e4 c5', movePreviewUci: 'e2e4 c7c5' },
    { id: 'sic-2', eco: 'B33', canonicalName: 'Sicilian Sveshnikov', aliases: [], family: 'Sicilian', subvariation: 'Sveshnikov', depth: 10, bucketKey: 'B', movePreviewSan: '1.e4 c5 2.Nf3 Nc6', movePreviewUci: 'e2e4 c7c5 g1f3 b8c6' },
    { id: 'ruy-1', eco: 'C60', canonicalName: 'Ruy Lopez', aliases: [], family: 'Open Game', subvariation: 'Classical', depth: 5, bucketKey: 'C', movePreviewSan: '1.e4 e5 2.Nf3', movePreviewUci: 'e2e4 e7e5 g1f3' },
  ];

  it('groups openings by normalized family key', () => {
    const index = buildFamilyIndex(entries);
    expect(index.openingsByFamily.has('sicilian')).toBe(true);
    expect(index.openingsByFamily.get('sicilian')!.length).toBe(2);
    expect(index.openingsByFamily.has('open')).toBe(true);
    expect(index.openingsByFamily.get('open')!.length).toBe(1);
  });

  it('sorts groups by count descending', () => {
    const index = buildFamilyIndex(entries);
    expect(index.groups[0].key).toBe('sicilian');
    expect(index.groups[0].openingCount).toBe(2);
    expect(index.groups[1].key).toBe('open');
  });

  it('computes eco range', () => {
    const index = buildFamilyIndex(entries);
    const sicilian = index.groups.find((g) => g.key === 'sicilian')!;
    expect(sicilian.ecoRange).toBe('B20-B33');
  });

  it('uses first seen family as displayName', () => {
    const index = buildFamilyIndex(entries);
    const sicilian = index.groups.find((g) => g.key === 'sicilian')!;
    expect(sicilian.displayName).toBe('Sicilian Defense');
  });

  it('returns empty groups for empty input', () => {
    const index = buildFamilyIndex([]);
    expect(index.groups).toEqual([]);
    expect(index.openingsByFamily.size).toBe(0);
  });
});
