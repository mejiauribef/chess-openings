import { Chess, type Move } from 'chess.js';
import type { OpeningCatalogEntry, OpeningEntry } from '@/domain/opening';
import { normalizeFenToEpd } from '@/domain/notation';
import type { RepertoireLine } from '@/domain/repertoire';
import type { MoveEdge, OpeningGraph, PositionNode } from '@/domain/position';

function hashText(input: string): string {
  let h1 = 0;
  let h2 = 0;
  for (let index = 0; index < input.length; index += 1) {
    const ch = input.charCodeAt(index);
    h1 = (h1 * 31 + ch) >>> 0;
    h2 = (h2 * 37 + ch) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

export function toNodeIdFromEpd(epd: string): string {
  return `pos-${hashText(epd)}`;
}

export function uciToMove(uci: string): { from: string; to: string; promotion?: 'n' | 'b' | 'r' | 'q' } {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: (uci[4] as 'n' | 'b' | 'r' | 'q' | undefined) ?? undefined,
  };
}

function addUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function addIndex(record: Record<string, string[]>, key: string, value: string): void {
  if (!record[key]) {
    record[key] = [];
  }
  addUnique(record[key], value);
}

function cloneIndexes(indexes: OpeningGraph['indexes']): OpeningGraph['indexes'] {
  return {
    eco: Object.fromEntries(
      Object.entries(indexes.eco).map(([key, values]) => [key, [...values]]),
    ),
    canonicalName: Object.fromEntries(
      Object.entries(indexes.canonicalName).map(([key, values]) => [key, [...values]]),
    ),
    alias: Object.fromEntries(
      Object.entries(indexes.alias).map(([key, values]) => [key, [...values]]),
    ),
    firstMoves: Object.fromEntries(
      Object.entries(indexes.firstMoves).map(([key, values]) => [key, [...values]]),
    ),
    transpositionGroupId: Object.fromEntries(
      Object.entries(indexes.transpositionGroupId).map(([key, values]) => [key, [...values]]),
    ),
  };
}

function mergeIndexRecord(
  target: Record<string, string[]>,
  incoming: Record<string, string[]>,
): Record<string, string[]> {
  Object.entries(incoming).forEach(([key, values]) => {
    if (!target[key]) {
      target[key] = [...values];
      return;
    }

    values.forEach((value) => addUnique(target[key], value));
  });

  return target;
}

function createNode(chess: Chess, moveNumber: number): PositionNode {
  const fen = chess.fen();
  const epd = normalizeFenToEpd(fen);

  return {
    id: toNodeIdFromEpd(epd),
    fen,
    epd,
    moveNumber,
    sideToMove: chess.turn(),
    openingIds: [],
    parentIds: [],
    childEdges: [],
    transpositionGroupId: toNodeIdFromEpd(epd),
  };
}

function createNodeFromFen(fen: string, moveNumber: number, openingId?: string): PositionNode {
  const epd = normalizeFenToEpd(fen);

  return {
    id: toNodeIdFromEpd(epd),
    fen,
    epd,
    moveNumber,
    sideToMove: fen.split(/\s+/)[1] as 'w' | 'b',
    openingIds: openingId ? [openingId] : [],
    parentIds: [],
    childEdges: [],
    transpositionGroupId: toNodeIdFromEpd(epd),
  };
}

export function applyUciLine(uciMoves: string[]): {
  chess: Chess;
  fen: string;
  epd: string;
  sanMoves: string[];
  verboseMoves: Move[];
} {
  const chess = new Chess();
  const verboseMoves: Move[] = [];

  for (const uci of uciMoves) {
    const move = chess.move(uciToMove(uci));
    if (!move) {
      throw new Error(`Illegal UCI move in line: ${uci}`);
    }
    verboseMoves.push(move);
  }

  return {
    chess,
    fen: chess.fen(),
    epd: normalizeFenToEpd(chess.fen()),
    sanMoves: verboseMoves.map((move) => move.san),
    verboseMoves,
  };
}

function ensureEdge(node: PositionNode, edge: MoveEdge): void {
  const existing = node.childEdges.find(
    (candidate) => candidate.uci === edge.uci && candidate.toNodeId === edge.toNodeId,
  );

  if (!existing) {
    node.childEdges.push(edge);
    return;
  }

  existing.weight += edge.weight;
  existing.tags = [...new Set([...existing.tags, ...edge.tags])];
}

function reindexGraph(graph: OpeningGraph): OpeningGraph['indexes'] {
  const indexes: OpeningGraph['indexes'] = {
    eco: {},
    canonicalName: {},
    alias: {},
    firstMoves: {},
    transpositionGroupId: {},
  };

  Object.values(graph.openingsById).forEach((opening) => {
    addIndex(indexes.eco, opening.eco.toLowerCase(), opening.id);
    addIndex(indexes.canonicalName, opening.canonicalName.toLowerCase(), opening.id);
    opening.aliases.forEach((alias) => addIndex(indexes.alias, alias.toLowerCase(), opening.id));
    addIndex(indexes.firstMoves, opening.uciMoves.slice(0, 4).join(' '), opening.id);
  });

  Object.values(graph.nodes).forEach((node) => {
    addIndex(indexes.transpositionGroupId, node.transpositionGroupId, node.id);
  });

  return indexes;
}

export function toCatalogEntry(
  opening: Pick<
    OpeningEntry,
    'id' | 'eco' | 'canonicalName' | 'aliases' | 'pgn' | 'uciMoves' | 'family' | 'subvariation' | 'depth'
  >,
): OpeningCatalogEntry {
  const bucketKey = deriveBucketKey(opening.eco);
  const movePreviewSan = opening.pgn
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)
    .join(' ');
  const movePreviewUci = opening.uciMoves.slice(0, 4).join(' ');

  return {
    id: opening.id,
    eco: opening.eco,
    canonicalName: opening.canonicalName,
    aliases: opening.aliases,
    family: opening.family,
    subvariation: opening.subvariation,
    depth: opening.depth,
    bucketKey,
    movePreviewSan,
    movePreviewUci,
  };
}

export function deriveBucketKey(eco: string): string {
  const normalized = eco.trim().charAt(0).toLowerCase();
  return /^[a-e]$/.test(normalized) ? normalized : 'misc';
}

export function createEmptyGraph(): OpeningGraph {
  const rootChess = new Chess();
  const rootNode = createNode(rootChess, 0);

  return {
    rootNodeId: rootNode.id,
    openingsById: {},
    nodes: {
      [rootNode.id]: rootNode,
    },
    indexes: {
      eco: {},
      canonicalName: {},
      alias: {},
      firstMoves: {},
      transpositionGroupId: {
        [rootNode.transpositionGroupId]: [rootNode.id],
      },
    },
  };
}

export function buildOpeningGraph(openings: OpeningEntry[]): OpeningGraph {
  const graph = createEmptyGraph();
  const openingsById = graph.openingsById;
  const nodes = graph.nodes;
  const rootNode = graph.nodes[graph.rootNodeId];

  for (const opening of openings) {
    openingsById[opening.id] = opening;

    const chess = new Chess();
    let currentNode = rootNode;

    opening.uciMoves.forEach((uci, index) => {
      const move = chess.move(uciToMove(uci));
      if (!move) {
        throw new Error(`Illegal opening move "${uci}" in ${opening.id}`);
      }

      const nextNode = createNode(chess, index + 1);
      const existingNode = nodes[nextNode.id] ?? nextNode;
      nodes[existingNode.id] = existingNode;

      addUnique(existingNode.parentIds, currentNode.id);
      addUnique(existingNode.openingIds, opening.id);
      addUnique(currentNode.openingIds, opening.id);

      ensureEdge(currentNode, {
        fromNodeId: currentNode.id,
        toNodeId: existingNode.id,
        uci,
        san: move.san,
        isMainLine: true,
        source: opening.source,
        weight: 1,
        tags: [index + 1 === opening.uciMoves.length ? 'named-line' : 'catalog'],
      });

      currentNode = existingNode;
    });
  }

  graph.indexes = reindexGraph(graph);
  return graph;
}

export function buildGraphSliceForOpeningIds(
  graph: OpeningGraph,
  openingIds: string[],
  bucketKey: string,
): {
  bucketKey: string;
  openingIds: string[];
  graph: OpeningGraph;
} {
  const allowedOpeningIds = new Set(openingIds);
  const includedNodeIds = new Set<string>();
  includedNodeIds.add(graph.rootNodeId);

  Object.values(graph.nodes).forEach((node) => {
    if (node.openingIds.some((openingId) => allowedOpeningIds.has(openingId))) {
      includedNodeIds.add(node.id);
    }
  });

  const sliceNodes = Object.fromEntries(
    [...includedNodeIds].map((nodeId) => {
      const node = graph.nodes[nodeId];
      const filteredChildEdges = node.childEdges.filter((edge) => includedNodeIds.has(edge.toNodeId));

      return [
        nodeId,
        {
          ...node,
          openingIds: node.openingIds.filter((openingId) => allowedOpeningIds.has(openingId)),
          parentIds: node.parentIds.filter((parentId) => includedNodeIds.has(parentId)),
          childEdges: filteredChildEdges,
        } satisfies PositionNode,
      ];
    }),
  );

  const sliceGraph: OpeningGraph = {
    rootNodeId: graph.rootNodeId,
    openingsById: Object.fromEntries(
      openingIds
        .filter((openingId) => graph.openingsById[openingId])
        .map((openingId) => [openingId, graph.openingsById[openingId]]),
    ),
    nodes: sliceNodes,
    indexes: {
      eco: {},
      canonicalName: {},
      alias: {},
      firstMoves: {},
      transpositionGroupId: {},
    },
  };

  sliceGraph.indexes = reindexGraph(sliceGraph);

  return {
    bucketKey,
    openingIds,
    graph: sliceGraph,
  };
}

export function mergeOpeningGraphs(baseGraph: OpeningGraph, incomingGraph: OpeningGraph): OpeningGraph {
  const openingsById = {
    ...baseGraph.openingsById,
    ...incomingGraph.openingsById,
  };
  const nodes = {
    ...baseGraph.nodes,
  };
  const indexes = cloneIndexes(baseGraph.indexes);

  mergeIndexRecord(indexes.eco, incomingGraph.indexes.eco);
  mergeIndexRecord(indexes.canonicalName, incomingGraph.indexes.canonicalName);
  mergeIndexRecord(indexes.alias, incomingGraph.indexes.alias);
  mergeIndexRecord(indexes.firstMoves, incomingGraph.indexes.firstMoves);
  mergeIndexRecord(indexes.transpositionGroupId, incomingGraph.indexes.transpositionGroupId);

  Object.entries(incomingGraph.nodes).forEach(([nodeId, incomingNode]) => {
    const existingNode = nodes[nodeId];

    if (!existingNode) {
      nodes[nodeId] = structuredClone(incomingNode);
      return;
    }

    const mergedNode: PositionNode = {
      ...existingNode,
      openingIds: [...existingNode.openingIds],
      parentIds: [...existingNode.parentIds],
      childEdges: existingNode.childEdges.map((edge) => ({ ...edge, tags: [...edge.tags] })),
    };

    mergedNode.fen = mergedNode.fen || incomingNode.fen;
    mergedNode.epd = mergedNode.epd || incomingNode.epd;
    mergedNode.moveNumber = Math.min(mergedNode.moveNumber, incomingNode.moveNumber);
    mergedNode.sideToMove = incomingNode.sideToMove;
    incomingNode.openingIds.forEach((openingId) => addUnique(mergedNode.openingIds, openingId));
    incomingNode.parentIds.forEach((parentId) => addUnique(mergedNode.parentIds, parentId));
    incomingNode.childEdges.forEach((edge) => ensureEdge(mergedNode, edge));

    nodes[nodeId] = mergedNode;
  });

  return {
    rootNodeId: baseGraph.rootNodeId,
    openingsById,
    nodes,
    indexes,
  };
}

export function mergeRepertoireLinesIntoGraph(
  baseGraph: OpeningGraph,
  repertoireLines: RepertoireLine[],
): OpeningGraph {
  const graph = structuredClone(baseGraph);

  for (const line of repertoireLines.filter((candidate) => candidate.enabled)) {
    const chess = new Chess();
    let currentNode = graph.nodes[graph.rootNodeId];
    const openingId = line.rootOpeningId in graph.openingsById ? line.rootOpeningId : undefined;

    for (const [index, uci] of line.movePath.entries()) {
      const move = chess.move(uciToMove(uci));
      if (!move) {
        break;
      }

      const nextFen = chess.fen();
      const nextNodeId = toNodeIdFromEpd(normalizeFenToEpd(nextFen));
      const nextNode =
        graph.nodes[nextNodeId] ?? createNodeFromFen(nextFen, index + 1, openingId);

      graph.nodes[nextNodeId] = nextNode;
      addUnique(nextNode.parentIds, currentNode.id);

      if (openingId) {
        addUnique(currentNode.openingIds, openingId);
        addUnique(nextNode.openingIds, openingId);
      }

      addIndex(graph.indexes.transpositionGroupId, nextNode.transpositionGroupId, nextNode.id);

      ensureEdge(currentNode, {
        fromNodeId: currentNode.id,
        toNodeId: nextNode.id,
        uci,
        san: move.san,
        isMainLine: line.tags.includes('main-line'),
        source: 'repertoire',
        weight: Math.max(1, line.priority),
        tags: [...new Set(['repertoire', ...line.tags])],
      });

      currentNode = nextNode;
    }
  }

  return graph;
}

export function resolveNodeIdFromUciLine(graph: OpeningGraph, uciMoves: string[]): string {
  const { epd } = applyUciLine(uciMoves);
  const nodeId = toNodeIdFromEpd(epd);

  if (!graph.nodes[nodeId]) {
    throw new Error(`Line does not resolve to a graph node: ${uciMoves.join(' ')}`);
  }

  return nodeId;
}

export function identifyOpeningsByUci(graph: OpeningGraph, uciMoves: string[]): OpeningEntry[] {
  const nodeId = resolveNodeIdFromUciLine(graph, uciMoves);
  return graph.nodes[nodeId].openingIds.map((openingId) => graph.openingsById[openingId]);
}

export function identifyOpeningsBySan(graph: OpeningGraph, sanMoves: string[]): OpeningEntry[] {
  const chess = new Chess();
  const uciMoves: string[] = [];

  for (const san of sanMoves) {
    const move = chess.move(san, { strict: false });
    if (!move) {
      throw new Error(`Illegal SAN move: ${san}`);
    }

    uciMoves.push(`${move.from}${move.to}${move.promotion ?? ''}`);
  }

  return identifyOpeningsByUci(graph, uciMoves);
}

export function getNodeLabels(graph: OpeningGraph, nodeId: string): {
  canonicalNames: string[];
  aliases: string[];
} {
  const node = graph.nodes[nodeId];

  return {
    canonicalNames: [...new Set(node.openingIds.map((openingId) => graph.openingsById[openingId].canonicalName))],
    aliases: [...new Set(node.openingIds.flatMap((openingId) => graph.openingsById[openingId].aliases))],
  };
}

export function getOpeningNameForNode(graph: OpeningGraph, nodeId: string): string {
  const labels = getNodeLabels(graph, nodeId);
  return labels.canonicalNames[0] ?? 'Unnamed position';
}

export function findPathToNode(
  graph: OpeningGraph,
  targetNodeId: string,
): { uciMoves: string[]; sanMoves: string[] } | undefined {
  if (targetNodeId === graph.rootNodeId) {
    return { uciMoves: [], sanMoves: [] };
  }

  const queue: Array<{ nodeId: string; uciMoves: string[]; sanMoves: string[] }> = [
    {
      nodeId: graph.rootNodeId,
      uciMoves: [],
      sanMoves: [],
    },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.nodeId)) {
      continue;
    }

    visited.add(current.nodeId);

    if (current.nodeId === targetNodeId) {
      return {
        uciMoves: current.uciMoves,
        sanMoves: current.sanMoves,
      };
    }

    graph.nodes[current.nodeId]?.childEdges.forEach((edge) => {
      if (!visited.has(edge.toNodeId)) {
        queue.push({
          nodeId: edge.toNodeId,
          uciMoves: [...current.uciMoves, edge.uci],
          sanMoves: [...current.sanMoves, edge.san],
        });
      }
    });
  }

  return undefined;
}
