import generatedCatalogUrl from '../../../data/generated/openings.catalog.json?url';
import generatedBootstrapUrl from '../../../data/generated/openings.bootstrap.json?url';
import generatedManifestUrl from '../../../data/generated/openings.manifest.json?url';
import { applyUciLine, createEmptyGraph, deriveBucketKey, toNodeIdFromEpd } from '@/lib/chess/openingGraph';
import {
  generatedOpeningSliceSchema,
  type GeneratedBootstrap,
  type OpeningCatalogEntry,
  type OpeningEntry,
  type TheoryNote,
} from '@/domain/opening';
import {
  generatedCompactCatalogSchema,
  generatedRuntimeManifestSchema,
  type CompactCatalogRow,
  type GeneratedRuntimeManifest,
} from '@/domain/runtimeAssets';
import {
  generatedOpeningGraphSliceSchema,
  type OpeningGraph,
} from '@/domain/position';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCatalogEntries(json: unknown): OpeningCatalogEntry[] {
  if (import.meta.env.DEV) {
    const parsed = generatedCompactCatalogSchema.parse(json);
    return parsed.openings.map((row) => toCatalogEntryFromRow(row));
  }

  if (!isRecord(json) || !Array.isArray(json.openings)) {
    throw new Error('Catalogo generado invalido.');
  }

  return (json.openings as CompactCatalogRow[]).map((row) => toCatalogEntryFromRow(row));
}

function parseGraphSlice(json: unknown): OpeningGraph {
  if (import.meta.env.DEV) {
    return generatedOpeningGraphSliceSchema.parse(json).graph;
  }

  if (
    !isRecord(json) ||
    typeof json.bucketKey !== 'string' ||
    !isRecord(json.graph) ||
    typeof json.graph.rootNodeId !== 'string' ||
    !isRecord(json.graph.nodes) ||
    !isRecord(json.graph.openingsById) ||
    !isRecord(json.graph.indexes)
  ) {
    throw new Error('Slice de grafo invalido.');
  }

  return json.graph as OpeningGraph;
}

function parseOpeningSlice(json: unknown): OpeningEntry[] {
  if (import.meta.env.DEV) {
    return generatedOpeningSliceSchema.parse(json).openings;
  }

  if (!isRecord(json) || typeof json.bucketKey !== 'string' || !Array.isArray(json.openings)) {
    throw new Error('Slice de aperturas invalido.');
  }

  return json.openings as OpeningEntry[];
}

function parseBootstrapAsset(json: unknown): GeneratedBootstrap {
  if (
    !isRecord(json) ||
    !isRecord(json.opening) ||
    !isRecord(json.graph) ||
    typeof json.generatedAt !== 'string' ||
    typeof json.mode !== 'string' ||
    typeof json.opening.id !== 'string' ||
    typeof json.graph.rootNodeId !== 'string' ||
    !isRecord(json.graph.nodes) ||
    !isRecord(json.graph.openingsById) ||
    !isRecord(json.graph.indexes)
  ) {
    throw new Error('Bootstrap generado invalido.');
  }

  return json as unknown as GeneratedBootstrap;
}

const graphSliceUrls: Record<string, string> = {
  a: new URL('../../../data/generated/slices/graph-a.json', import.meta.url).href,
  b: new URL('../../../data/generated/slices/graph-b.json', import.meta.url).href,
  c: new URL('../../../data/generated/slices/graph-c.json', import.meta.url).href,
  d: new URL('../../../data/generated/slices/graph-d.json', import.meta.url).href,
  e: new URL('../../../data/generated/slices/graph-e.json', import.meta.url).href,
  misc: new URL('../../../data/generated/slices/graph-misc.json', import.meta.url).href,
};

const openingSliceUrls: Record<string, string> = {
  a: new URL('../../../data/generated/slices/openings-a.json', import.meta.url).href,
  b: new URL('../../../data/generated/slices/openings-b.json', import.meta.url).href,
  c: new URL('../../../data/generated/slices/openings-c.json', import.meta.url).href,
  d: new URL('../../../data/generated/slices/openings-d.json', import.meta.url).href,
  e: new URL('../../../data/generated/slices/openings-e.json', import.meta.url).href,
  misc: new URL('../../../data/generated/slices/openings-misc.json', import.meta.url).href,
};

function createSeedTheory(openings: OpeningCatalogEntry[]): TheoryNote[] {
  const ruyLopez = openings.find((opening) => opening.id === 'ruy-lopez');
  const qgd = openings.find((opening) => opening.id === 'qgd-main-order');
  const notes: TheoryNote[] = [];
  const ruyLopezMoves = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'];
  const qgdMoves = ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6'];

  if (ruyLopez) {
    notes.push({
      id: 'seed-ruy-lopez',
      nodeId: toNodeIdFromEpd(applyUciLine(ruyLopezMoves).epd),
      title: 'Desarrollo y presion en e5',
      summary: 'El alfil en b5 aumenta la presion sobre c6 y ayuda a forzar concesiones en el centro.',
      markdown: '## Desarrollo y presion en e5\n- El alfil en b5 aumenta la presion sobre c6.\n- Ayuda a forzar concesiones en el centro.',
      keyIdeasWhite: ['Presionar e5 con Nf3 y Bb5', 'Mantener flexibilidad con c3 y d4'],
      keyIdeasBlack: ['Romper con ...a6 y ...Nf6', 'Coordinar ...Be7 y ...O-O'],
      plans: ['Desarrollo armonioso antes de atacar el centro'],
      traps: [],
      motifs: ['Pins'],
      pawnStructures: ['Open center'],
      tags: ['plan', 'tactic'],
      linkedNodeIds: [],
      references: ['Seed example'],
      provenance: 'seed',
      license: 'CC0 sample seed',
    });
  }

  if (qgd) {
    notes.push({
      id: 'seed-qgd-transposition',
      nodeId: toNodeIdFromEpd(applyUciLine(qgdMoves).epd),
      title: 'Transposicion clave al QGD',
      summary: 'La misma posicion puede nacer desde un orden de jugadas de QGD o desde una configuracion india.',
      markdown: '## Transposicion clave al QGD\n- La misma posicion puede nacer desde ordenes de jugadas distintos.\n- El plan depende de la posicion final, no del move order.',
      keyIdeasWhite: ['Desarrollar Cf3 y Ag5', 'Presionar la tension central'],
      keyIdeasBlack: ['Coordinar ...Be7 y ...O-O', 'Elegir entre ...c5 y ...c6'],
      plans: ['Reconocer que el plan depende de la posicion final, no del orden'],
      traps: [],
      motifs: ['Transpositions'],
      pawnStructures: ['Closed center shell'],
      tags: ['plan', 'endgame-transition'],
      linkedNodeIds: [],
      references: ['Seed example'],
      provenance: 'seed',
      license: 'CC0 sample seed',
    });
  }

  return notes;
}

async function loadJsonAsset<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo cargar el asset ${url}`);
  }

  return (await response.json()) as T;
}

function toCatalogEntryFromRow(row: CompactCatalogRow): OpeningCatalogEntry {
  const [id, eco, canonicalName, aliases, family, subvariation, depth, movePreviewSan, movePreviewUci] = row;

  return {
    id,
    eco,
    canonicalName,
    aliases,
    family,
    subvariation,
    depth,
    bucketKey: deriveBucketKey(eco),
    movePreviewSan,
    movePreviewUci,
  };
}

export async function loadRuntimeManifest(): Promise<GeneratedRuntimeManifest> {
  const json = await loadJsonAsset<unknown>(generatedManifestUrl);
  return generatedRuntimeManifestSchema.parse(json);
}

export async function loadGeneratedCatalogEntriesAsset(): Promise<OpeningCatalogEntry[]> {
  const generatedCatalogJson = await loadJsonAsset<unknown>(generatedCatalogUrl);
  return parseCatalogEntries(generatedCatalogJson);
}

export async function loadGeneratedBootstrapAsset(): Promise<GeneratedBootstrap> {
  const json = await loadJsonAsset<unknown>(generatedBootstrapUrl);
  return parseBootstrapAsset(json);
}

export function hydrateGeneratedCatalogIndex(openings: OpeningCatalogEntry[]): {
  openings: OpeningCatalogEntry[];
  graph: OpeningGraph;
  theoryNotes: TheoryNote[];
} {
  return {
    openings,
    graph: createEmptyGraph(),
    theoryNotes: createSeedTheory(openings),
  };
}

export async function loadGeneratedCatalogIndex(): Promise<{
  openings: OpeningCatalogEntry[];
  graph: OpeningGraph;
  theoryNotes: TheoryNote[];
}> {
  const openings = await loadGeneratedCatalogEntriesAsset();
  return hydrateGeneratedCatalogIndex(openings);
}

export async function loadGeneratedGraphSlice(bucketKey: string): Promise<OpeningGraph> {
  const url = graphSliceUrls[bucketKey];
  if (!url) {
    return createEmptyGraph();
  }

  const json = await loadJsonAsset<unknown>(url);
  return parseGraphSlice(json);
}

export async function loadGeneratedOpeningSlice(bucketKey: string): Promise<OpeningEntry[]> {
  const url = openingSliceUrls[bucketKey];
  if (!url) {
    return [];
  }

  const json = await loadJsonAsset<unknown>(url);
  return parseOpeningSlice(json);
}
