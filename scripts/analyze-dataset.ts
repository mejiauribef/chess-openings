import fs from 'node:fs/promises';
import path from 'node:path';
import { generatedOpeningsSchema } from '../src/domain/opening';
import { buildCourseSummaries } from '../src/lib/chess/courseOverview';
import { buildFamilyIndex } from '../src/lib/chess/familyIndex';
import { toCatalogEntry } from '../src/lib/chess/openingGraph';

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) {
    return 0;
  }

  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

async function main() {
  const basePath = path.resolve('data/generated/openings.base.json');
  const transitionsPath = path.resolve('data/generated/openings.transitions.json');
  const outputPath = path.resolve('data/generated/openings.audit.json');
  const base = generatedOpeningsSchema.parse(JSON.parse(await fs.readFile(basePath, 'utf8')));
  const transitions = JSON.parse(await fs.readFile(transitionsPath, 'utf8').catch(() => '[]')) as unknown[];
  const catalog = base.openings.map((opening) => toCatalogEntry(opening));
  const familyIndex = buildFamilyIndex(catalog);
  const courseSummariesAt5 = buildCourseSummaries(familyIndex, 5);
  const courseSummariesAt6 = buildCourseSummaries(familyIndex, 6);
  const depths = base.openings.map((opening) => opening.depth).sort((left, right) => left - right);
  const openingsBySource = base.openings.reduce<Record<string, number>>((accumulator, opening) => {
    accumulator[opening.source] = (accumulator[opening.source] ?? 0) + 1;
    return accumulator;
  }, {});

  const payload = {
    generatedAt: new Date().toISOString(),
    totals: {
      openings: base.openings.length,
      families: familyIndex.groups.length,
      transitionsImported: transitions.length,
    },
    depths: {
      min: depths[0] ?? 0,
      median: percentile(depths, 0.5),
      p90: percentile(depths, 0.9),
      max: depths[depths.length - 1] ?? 0,
      readyAt5: base.openings.filter((opening) => opening.depth >= 5).length,
      readyAt6: base.openings.filter((opening) => opening.depth >= 6).length,
    },
    bySource: openingsBySource,
    topCoursesAt5: courseSummariesAt5.slice(0, 25),
    topCoursesAt6: courseSummariesAt6.slice(0, 25),
  };

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote dataset audit to ${outputPath}`);
}

void main();
