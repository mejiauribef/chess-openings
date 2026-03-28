import type { OpeningCatalogEntry } from '@/domain/opening';

export interface OpeningDisplayFields {
  displayTitle: string;
  displayFamily: string;
  displaySubtitle: string;
  ecoLabel: string;
  movePreviewSan: string;
}

export interface CourseVariationDisplay extends OpeningDisplayFields {
  key: string;
  representativeId: string;
  openingIds: string[];
  aliases: string[];
  namedLineCount: number;
  minDepth: number;
  maxDepth: number;
}

export interface OpeningSourceMeta extends OpeningDisplayFields {
  displayKey: string;
  namedLineCount: number;
  minDepth: number;
  maxDepth: number;
}

function normalizeSpacing(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*/g, ', ')
    .replace(/:\s*/g, ': ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCaseSensitiveTerms(value: string): string {
  return value
    .replace(/\bDefence\b/g, 'Defense')
    .replace(/\bdefence\b/g, 'defense')
    .replace(/\bDEFENCE\b/g, 'DEFENSE');
}

function toDisplayKey(value: string): string {
  return normalizeOpeningText(value).toLowerCase();
}

function formatEcoLabel(ecos: string[]): string {
  if (ecos.length === 0) {
    return '';
  }

  const uniqueEcos = [...new Set(ecos)].sort((left, right) => left.localeCompare(right));
  if (uniqueEcos.length === 1) {
    return uniqueEcos[0];
  }

  return `${uniqueEcos[0]}-${uniqueEcos[uniqueEcos.length - 1]}`;
}

function pickRepresentative(entries: OpeningCatalogEntry[]): OpeningCatalogEntry {
  return [...entries].sort(
    (left, right) =>
      right.depth - left.depth ||
      left.eco.localeCompare(right.eco) ||
      left.canonicalName.localeCompare(right.canonicalName) ||
      left.id.localeCompare(right.id),
  )[0];
}

export function normalizeOpeningText(value: string): string {
  return normalizeCaseSensitiveTerms(normalizeSpacing(value));
}

export function getOpeningDisplayFields(
  opening: Pick<OpeningCatalogEntry, 'canonicalName' | 'family' | 'subvariation' | 'eco' | 'movePreviewSan'>,
): OpeningDisplayFields {
  return {
    displayTitle: normalizeOpeningText(opening.canonicalName),
    displayFamily: normalizeOpeningText(opening.family),
    displaySubtitle: normalizeOpeningText(opening.subvariation),
    ecoLabel: normalizeOpeningText(opening.eco),
    movePreviewSan: normalizeOpeningText(opening.movePreviewSan),
  };
}

export function buildCourseVariationDisplays(
  openings: OpeningCatalogEntry[],
): CourseVariationDisplay[] {
  const groups = new Map<string, OpeningCatalogEntry[]>();

  for (const opening of openings) {
    const key = [
      toDisplayKey(opening.canonicalName),
      toDisplayKey(opening.subvariation),
      toDisplayKey(opening.movePreviewUci),
    ].join('|');
    const list = groups.get(key) ?? [];
    list.push(opening);
    groups.set(key, list);
  }

  return [...groups.values()]
    .map((entries) => {
      const representative = pickRepresentative(entries);
      const display = getOpeningDisplayFields(representative);
      const aliases = [
        ...new Set(entries.flatMap((entry) => entry.aliases.map((alias) => normalizeOpeningText(alias)))),
      ].sort((left, right) => left.localeCompare(right));

      return {
        key: [
          toDisplayKey(display.displayTitle),
          toDisplayKey(display.displaySubtitle),
          toDisplayKey(representative.movePreviewUci),
        ].join('|'),
        representativeId: representative.id,
        openingIds: entries.map((entry) => entry.id),
        aliases,
        namedLineCount: entries.length,
        minDepth: Math.min(...entries.map((entry) => entry.depth)),
        maxDepth: Math.max(...entries.map((entry) => entry.depth)),
        ecoLabel: formatEcoLabel(entries.map((entry) => entry.eco)),
        displayTitle: display.displayTitle,
        displayFamily: display.displayFamily,
        displaySubtitle: display.displaySubtitle,
        movePreviewSan: display.movePreviewSan,
      } satisfies CourseVariationDisplay;
    })
    .sort(
      (left, right) =>
        left.displayTitle.localeCompare(right.displayTitle) ||
        left.displaySubtitle.localeCompare(right.displaySubtitle) ||
        left.ecoLabel.localeCompare(right.ecoLabel),
    );
}

export function buildOpeningSourceMetaMap(
  variations: CourseVariationDisplay[],
): Record<string, OpeningSourceMeta> {
  return Object.fromEntries(
    variations.flatMap((variation) =>
      variation.openingIds.map((openingId) => [
        openingId,
        {
          displayKey: variation.key,
          displayTitle: variation.displayTitle,
          displayFamily: variation.displayFamily,
          displaySubtitle: variation.displaySubtitle,
          ecoLabel: variation.ecoLabel,
          movePreviewSan: variation.movePreviewSan,
          namedLineCount: variation.namedLineCount,
          minDepth: variation.minDepth,
          maxDepth: variation.maxDepth,
        } satisfies OpeningSourceMeta,
      ]),
    ),
  );
}

export function matchesCourseVariationQuery(
  variation: CourseVariationDisplay,
  query: string,
): boolean {
  const normalizedQuery = toDisplayKey(query);

  return [
    variation.displayTitle,
    variation.displayFamily,
    variation.displaySubtitle,
    variation.ecoLabel,
    variation.movePreviewSan,
    ...variation.aliases,
  ].some((value) => toDisplayKey(value).includes(normalizedQuery));
}
