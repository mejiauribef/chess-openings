import type { OpeningCatalogEntry } from '@/domain/opening';

export interface FamilyGroup {
  key: string;
  displayName: string;
  openingCount: number;
  ecoRange: string;
}

export interface FamilyIndex {
  groups: FamilyGroup[];
  openingsByFamily: Map<string, OpeningCatalogEntry[]>;
}

const STRIP_SUFFIXES = /\s+(defense|defence|opening|game|attack|variation|system)$/i;

export function normalizeFamily(family: string): string {
  return family
    .trim()
    .replace(/\s+/g, ' ')
    .replace(STRIP_SUFFIXES, '')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

export function buildFamilyIndex(openings: OpeningCatalogEntry[]): FamilyIndex {
  const byKey = new Map<string, OpeningCatalogEntry[]>();
  const displayNames = new Map<string, string>();

  for (const opening of openings) {
    const key = normalizeFamily(opening.family);
    let list = byKey.get(key);
    if (!list) {
      list = [];
      byKey.set(key, list);
      displayNames.set(key, opening.family);
    }
    list.push(opening);
  }

  const groups: FamilyGroup[] = [];
  for (const [key, entries] of byKey) {
    const ecos = entries.map((e) => e.eco).sort();
    const ecoRange = ecos.length === 1 ? ecos[0] : `${ecos[0]}-${ecos[ecos.length - 1]}`;
    groups.push({
      key,
      displayName: displayNames.get(key)!,
      openingCount: entries.length,
      ecoRange,
    });
  }

  groups.sort((a, b) => b.openingCount - a.openingCount || a.displayName.localeCompare(b.displayName));

  return { groups, openingsByFamily: byKey };
}
