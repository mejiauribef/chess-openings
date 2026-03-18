import {
  buildGraphSliceForOpeningIds,
  buildOpeningGraph,
  createEmptyGraph,
  getNodeLabels,
  identifyOpeningsBySan,
  identifyOpeningsByUci,
  mergeOpeningGraphs,
  resolveNodeIdFromUciLine,
} from '@/lib/chess/openingGraph';
import { sampleOpenings } from '../fixtures/sampleOpenings';

describe('opening graph', () => {
  it('identifies an opening from SAN and UCI', () => {
    const graph = buildOpeningGraph(sampleOpenings);

    const bySan = identifyOpeningsBySan(graph, ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6']);
    const byUci = identifyOpeningsByUci(graph, ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6']);

    expect(bySan.map((opening) => opening.id)).toContain('qgd-main-order');
    expect(byUci.map((opening) => opening.id)).toContain('qgd-main-order');
  });

  it('collapses two move orders into the same position', () => {
    const graph = buildOpeningGraph(sampleOpenings);

    const firstNode = resolveNodeIdFromUciLine(graph, ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6']);
    const secondNode = resolveNodeIdFromUciLine(graph, ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'd7d5']);

    expect(firstNode).toBe(secondNode);
  });

  it('returns canonical names and aliases for multi-classified positions', () => {
    const graph = buildOpeningGraph(sampleOpenings);
    const nodeId = resolveNodeIdFromUciLine(graph, ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6']);
    const labels = getNodeLabels(graph, nodeId);

    expect(labels.canonicalNames).toContain("Queen's Gambit Declined");
    expect(labels.canonicalNames).toContain("Indian Defence: QGD Transposition");
    expect(labels.aliases).toContain("Queen's Pawn transposition");
  });

  it('merges bucket slices without losing indexes or transpositions', () => {
    const fullGraph = buildOpeningGraph(sampleOpenings);
    const cSlice = buildGraphSliceForOpeningIds(fullGraph, ['ruy-lopez', 'italian-game'], 'c').graph;
    const dSlice = buildGraphSliceForOpeningIds(fullGraph, ['qgd-main-order'], 'd').graph;
    const eSlice = buildGraphSliceForOpeningIds(fullGraph, ['qgd-transposition'], 'e').graph;

    const mergedGraph = mergeOpeningGraphs(
      mergeOpeningGraphs(mergeOpeningGraphs(createEmptyGraph(), cSlice), dSlice),
      eSlice,
    );

    expect(identifyOpeningsByUci(mergedGraph, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'])[0]?.id).toBe('ruy-lopez');
    expect(identifyOpeningsByUci(mergedGraph, ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6']).map((opening) => opening.id)).toEqual(
      expect.arrayContaining(['qgd-main-order', 'qgd-transposition']),
    );
    expect(mergedGraph.indexes.eco.c60).toContain('ruy-lopez');
  });
});
