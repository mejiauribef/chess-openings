import fs from 'node:fs/promises';
import path from 'node:path';
import { generatedCatalogSchema, generatedOpeningsSchema } from '../src/domain/opening';
import { generatedCompactCatalogSchema } from '../src/domain/runtimeAssets';
import { buildGraphSliceForOpeningIds, buildOpeningGraph, deriveBucketKey, toCatalogEntry } from '../src/lib/chess/openingGraph';

const BUCKET_KEYS = ['a', 'b', 'c', 'd', 'e', 'misc'] as const;
const BOOTSTRAP_OPENING_CANDIDATES = ['ruy-lopez', 'qgd-main-order', 'sicilian-najdorf'] as const;

function getArg(name: string): string | undefined {
  const entry = process.argv.find((value) => value.startsWith(`--${name}=`));
  return entry?.split('=').at(1);
}

async function main() {
  const mode = getArg('mode') ?? 'sample';
  const basePath = path.resolve('data/generated/openings.base.json');
  const outputPath = path.resolve('data/generated/openings.graph.json');
  const catalogPath = path.resolve('data/generated/openings.catalog.json');
  const bootstrapPath = path.resolve('data/generated/openings.bootstrap.json');
  const manifestPath = path.resolve('data/generated/openings.manifest.json');
  const slicesDir = path.resolve('data/generated/slices');
  const base = generatedOpeningsSchema.parse(JSON.parse(await fs.readFile(basePath, 'utf8')));
  const graph = buildOpeningGraph(base.openings);
  const generatedAt = new Date().toISOString();
  const catalogEntries = base.openings
    .map((opening) => toCatalogEntry(opening))
    .sort((left, right) => left.canonicalName.localeCompare(right.canonicalName) || left.eco.localeCompare(right.eco));
  const catalog = generatedCatalogSchema.parse({
    mode,
    generatedAt,
    openings: catalogEntries,
  });
  const compactCatalog = generatedCompactCatalogSchema.parse({
    mode,
    generatedAt,
    openings: catalog.openings.map((opening) => [
      opening.id,
      opening.eco,
      opening.canonicalName,
      opening.aliases,
      opening.family,
      opening.subvariation,
      opening.depth,
      opening.movePreviewSan,
      opening.movePreviewUci,
    ]),
  });

  await fs.mkdir(slicesDir, { recursive: true });

  const payload = {
    mode,
    generatedAt,
    rootNodeId: graph.rootNodeId,
    nodeCount: Object.keys(graph.nodes).length,
    edgeCount: Object.values(graph.nodes).reduce((count, node) => count + node.childEdges.length, 0),
    graph,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(payload)}\n`, 'utf8');
  await fs.writeFile(catalogPath, `${JSON.stringify(compactCatalog)}\n`, 'utf8');

  const bootstrapOpening =
    BOOTSTRAP_OPENING_CANDIDATES.map((id) => base.openings.find((opening) => opening.id === id)).find(Boolean) ??
    base.openings.find((opening) => opening.id === catalog.openings[0]?.id) ??
    base.openings[0];

  if (bootstrapOpening) {
    const bootstrapGraph = buildGraphSliceForOpeningIds(graph, [bootstrapOpening.id], deriveBucketKey(bootstrapOpening.eco)).graph;
    await fs.writeFile(
      bootstrapPath,
      `${JSON.stringify({
        mode,
        generatedAt,
        opening: bootstrapOpening,
        graph: bootstrapGraph,
      })}\n`,
      'utf8',
    );
  }

  const openingIdsByBucket = base.openings.reduce<Record<string, string[]>>((accumulator, opening) => {
    const bucketKey = deriveBucketKey(opening.eco);
    if (!accumulator[bucketKey]) {
      accumulator[bucketKey] = [];
    }
    accumulator[bucketKey].push(opening.id);
    return accumulator;
  }, {});

  const bucketSummaries = await Promise.all(
    BUCKET_KEYS.map(async (bucketKey) => {
      const openingIds = openingIdsByBucket[bucketKey] ?? [];
      const slice = buildGraphSliceForOpeningIds(graph, openingIds, bucketKey);
      const slicePayload = {
        mode,
        generatedAt,
        bucketKey,
        openingIds,
        nodeCount: Object.keys(slice.graph.nodes).length,
        edgeCount: Object.values(slice.graph.nodes).reduce((count, node) => count + node.childEdges.length, 0),
        graph: slice.graph,
      };

      await fs.writeFile(
        path.join(slicesDir, `graph-${bucketKey}.json`),
        `${JSON.stringify(slicePayload)}\n`,
        'utf8',
      );

      await fs.writeFile(
        path.join(slicesDir, `openings-${bucketKey}.json`),
        `${JSON.stringify(
          {
            mode,
            generatedAt,
            bucketKey,
            openings: base.openings.filter((opening) => openingIds.includes(opening.id)),
          },
        )}\n`,
        'utf8',
      );

      return {
        bucketKey,
        openingCount: openingIds.length,
        nodeCount: slicePayload.nodeCount,
        edgeCount: slicePayload.edgeCount,
      };
    }),
  );

  await fs.writeFile(
    manifestPath,
    `${JSON.stringify({
      mode,
      generatedAt,
      catalogCount: catalog.openings.length,
      graphNodeCount: payload.nodeCount,
      graphEdgeCount: payload.edgeCount,
      buckets: bucketSummaries,
    })}\n`,
    'utf8',
  );

  console.log(`Wrote opening graph to ${outputPath}`);
}

void main();
