import type { OpeningCatalogEntry } from '@/domain/opening';
import type { FamilyIndex } from '@/lib/chess/familyIndex';

export interface CourseSummary {
  key: string;
  displayName: string;
  ecoRange: string;
  openingCount: number;
  studyReadyCount: number;
  minDepth: number;
  medianDepth: number;
  maxDepth: number;
  effectiveMinDepth: number;
  effectiveMedianDepth: number;
  effectiveMaxDepth: number;
  bucketCount: number;
  representativeOpeningId?: string;
  representativeOpeningName?: string;
}

function sortDepths(entries: OpeningCatalogEntry[]): number[] {
  return entries.map((entry) => entry.depth).sort((left, right) => left - right);
}

function getMedianDepth(depths: number[]): number {
  if (depths.length === 0) {
    return 0;
  }

  return depths[Math.floor(depths.length / 2)];
}

export function pickRepresentativeOpening(
  entries: OpeningCatalogEntry[],
  minimumDepth: number,
): OpeningCatalogEntry | undefined {
  if (entries.length === 0) {
    return undefined;
  }

  const scored = [...entries].sort((left, right) => {
    const leftFamily = left.family.trim().toLowerCase();
    const rightFamily = right.family.trim().toLowerCase();
    const leftName = left.canonicalName.trim().toLowerCase();
    const rightName = right.canonicalName.trim().toLowerCase();
    const leftIsStudyReady = left.depth >= minimumDepth;
    const rightIsStudyReady = right.depth >= minimumDepth;
    const leftSub = left.subvariation.trim().toLowerCase();
    const rightSub = right.subvariation.trim().toLowerCase();

    const score = (entry: OpeningCatalogEntry, family: string, name: string, studyReady: boolean, subvariation: string) =>
      Number(studyReady) * 100 +
      Number(name === family) * 20 +
      Number(name.startsWith(`${family}:`)) * 15 +
      Number(subvariation === 'main line') * 12 +
      Number(subvariation === 'mainline') * 10 +
      Number(subvariation.includes('classical')) * 4 +
      Number(subvariation.includes('main')) * 3;

    const leftScore = score(left, leftFamily, leftName, leftIsStudyReady, leftSub);
    const rightScore = score(right, rightFamily, rightName, rightIsStudyReady, rightSub);

    return (
      rightScore - leftScore ||
      Math.abs(left.depth - minimumDepth) - Math.abs(right.depth - minimumDepth) ||
      left.depth - right.depth ||
      left.canonicalName.localeCompare(right.canonicalName)
    );
  });

  return scored[0];
}

export function buildCourseSummaries(
  familyIndex: FamilyIndex,
  minimumDepth: number,
): CourseSummary[] {
  return familyIndex.groups.map((group) => {
    const entries = familyIndex.openingsByFamily.get(group.key) ?? [];
    const depths = sortDepths(entries);
    const studyReadyEntries = entries.filter((entry) => entry.depth >= minimumDepth);
    const studyReadyDepths = sortDepths(studyReadyEntries);
    const studyReadyCount = studyReadyEntries.length;
    const representative = pickRepresentativeOpening(entries, minimumDepth);
    const bucketCount = new Set(entries.map((entry) => entry.bucketKey)).size;

    return {
      key: group.key,
      displayName: group.displayName,
      ecoRange: group.ecoRange,
      openingCount: entries.length,
      studyReadyCount,
      minDepth: depths[0] ?? 0,
      medianDepth: getMedianDepth(depths),
      maxDepth: depths[depths.length - 1] ?? 0,
      effectiveMinDepth: studyReadyDepths[0] ?? 0,
      effectiveMedianDepth: getMedianDepth(studyReadyDepths),
      effectiveMaxDepth: studyReadyDepths[studyReadyDepths.length - 1] ?? 0,
      bucketCount,
      representativeOpeningId: representative?.id,
      representativeOpeningName: representative?.canonicalName,
    } satisfies CourseSummary;
  });
}
