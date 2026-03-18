import type { OpeningCatalogEntry } from '@/domain/opening';

export interface OpeningSummary {
  id: string;
  title: string;
  subtitle: string;
  eco: string;
}

export function toOpeningSummary(opening: OpeningCatalogEntry): OpeningSummary {
  return {
    id: opening.id,
    title: opening.canonicalName,
    subtitle: `${opening.family} / ${opening.subvariation}`,
    eco: opening.eco,
  };
}
