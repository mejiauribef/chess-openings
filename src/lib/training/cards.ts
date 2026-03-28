import type { OpeningEntry } from '@/domain/opening';
import type { OpeningCatalogEntry } from '@/domain/opening';
import type { RepertoireLine } from '@/domain/repertoire';
import type { OpeningGraph } from '@/domain/position';
import type { ReviewState, TrainingLine, TrainingSettings, TrainingSourceSummary } from '@/domain/training';
import { tryResolveNodeIdViaGraph } from '@/lib/chess/openingGraph';
import type { OpeningSourceMeta } from '@/lib/chess/openingDisplay';

export function normalizeTrainingAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').trim();
}

export function getDepthFromTags(tags: string[]): number {
  const depthTag = tags.find((tag) => tag.startsWith('depth:'));
  return depthTag ? Number(depthTag.split(':')[1]) : 0;
}

function isSidelineLine(line: TrainingLine): boolean {
  const hasPreferredTag =
    line.tags.includes('named-line') ||
    line.tags.includes('catalog') ||
    line.tags.includes('repertoire') ||
    line.tags.includes('main-line');

  return line.tags.includes('sideline') && !hasPreferredTag;
}

function getReviewPriority(reviewState: ReviewState | undefined, now: Date): number {
  if (!reviewState) {
    return 60;
  }

  const dueDelta = new Date(reviewState.dueAt).getTime() - now.getTime();
  if (dueDelta <= 0) {
    return 100 + Math.min(50, Math.floor(Math.abs(dueDelta) / (60 * 60 * 1000)));
  }

  return Math.max(0, 30 - Math.floor(dueDelta / (24 * 60 * 60 * 1000)));
}

function isMastered(reviewState: ReviewState | undefined): boolean {
  return Boolean(reviewState && reviewState.lastGrade >= 3 && reviewState.streak >= 2 && reviewState.stability >= 4);
}

function buildLineTags(movePath: string[], opening?: OpeningEntry): string[] {
  const tags: string[] = [];
  const depth = Math.ceil(movePath.length / 2);
  tags.push(`depth:${depth}`);

  if (opening) {
    if (opening.family) {
      tags.push(`family:${opening.family.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    }
    tags.push('catalog');
  }

  // Infer side-to-move from movePath length (no Chess instantiation needed)
  const isWhiteTurn = movePath.length % 2 === 0;
  tags.push(isWhiteTurn ? 'white-turn' : 'black-turn');

  return tags;
}

function collectRepertoireNodeIds(graph: OpeningGraph, repertoireLines: RepertoireLine[]): Set<string> {
  const nodeIds = new Set<string>();

  repertoireLines
    .filter((line) => line.enabled)
    .forEach((line) => {
      // Walk the graph edges to collect all intermediate nodeIds
      let currentNodeId = graph.rootNodeId;
      for (const uci of line.movePath) {
        const node = graph.nodes[currentNodeId];
        if (!node) break;
        const edge = node.childEdges.find((e) => e.uci === uci);
        if (!edge) break;
        currentNodeId = edge.toNodeId;
        if (graph.nodes[currentNodeId]) {
          nodeIds.add(currentNodeId);
        }
      }
    });

  return nodeIds;
}

export function createTrainingLines(graph: OpeningGraph, repertoireLines: RepertoireLine[]): TrainingLine[] {
  const lines: TrainingLine[] = [];
  const coveredOpeningIds = new Set<string>();

  // From enabled repertoire lines: one TrainingLine per line
  for (const repLine of repertoireLines.filter((l) => l.enabled)) {
    if (repLine.movePath.length === 0) continue;

    const opening = graph.openingsById[repLine.rootOpeningId];
    const openingName = opening?.canonicalName ?? '';
    const terminalNodeId = tryResolveNodeIdViaGraph(graph, repLine.movePath) ?? '';

    lines.push({
      id: `line-rep-${repLine.id}`,
      lineSourceId: repLine.id,
      color: repLine.color,
      movePath: repLine.movePath,
      openingName,
      tags: [...repLine.tags, ...buildLineTags(repLine.movePath, opening), 'repertoire'],
      difficulty: Math.min(10, Math.max(1, Math.floor(repLine.movePath.length / 2))),
      terminalNodeId,
    });

    if (opening) {
      coveredOpeningIds.add(opening.id);
    }
  }

  // From catalog openings not already covered by repertoire
  for (const opening of Object.values(graph.openingsById)) {
    if (coveredOpeningIds.has(opening.id)) continue;
    if (opening.uciMoves.length === 0) continue;

    const terminalNodeId = tryResolveNodeIdViaGraph(graph, opening.uciMoves) ?? '';

    for (const color of ['white', 'black'] as const) {
      lines.push({
        id: `line-cat-${opening.id}-${color}`,
        lineSourceId: opening.id,
        color,
        movePath: opening.uciMoves,
        openingName: opening.canonicalName,
        tags: buildLineTags(opening.uciMoves, opening),
        difficulty: Math.min(10, Math.max(1, Math.floor(opening.uciMoves.length / 2))),
        terminalNodeId,
      });
    }
  }

  return lines;
}

export function createCourseTrainingLines(options: {
  graph: OpeningGraph;
  courseOpenings: OpeningCatalogEntry[];
  repertoireLines: RepertoireLine[];
}): TrainingLine[] {
  const courseOpeningIds = new Set(options.courseOpenings.map((opening) => opening.id));
  const lines: TrainingLine[] = [];
  const coveredOpeningIds = new Set<string>();

  for (const repLine of options.repertoireLines.filter((line) => line.enabled)) {
    if (!repLine.rootOpeningId || !courseOpeningIds.has(repLine.rootOpeningId) || repLine.movePath.length === 0) {
      continue;
    }

    const opening = options.graph.openingsById[repLine.rootOpeningId];
    const openingName = opening?.canonicalName ?? '';
    const terminalNodeId = tryResolveNodeIdViaGraph(options.graph, repLine.movePath) ?? '';

    lines.push({
      id: `line-rep-${repLine.id}`,
      lineSourceId: repLine.id,
      color: repLine.color,
      movePath: repLine.movePath,
      openingName,
      tags: [...repLine.tags, ...buildLineTags(repLine.movePath, opening), 'repertoire'],
      difficulty: Math.min(10, Math.max(1, Math.floor(repLine.movePath.length / 2))),
      terminalNodeId,
    });

    coveredOpeningIds.add(repLine.rootOpeningId);
  }

  for (const opening of options.courseOpenings) {
    if (coveredOpeningIds.has(opening.id)) continue;

    const graphOpening = options.graph.openingsById[opening.id];
    if (!graphOpening || graphOpening.uciMoves.length === 0) continue;

    const terminalNodeId = tryResolveNodeIdViaGraph(options.graph, graphOpening.uciMoves) ?? '';

    for (const color of ['white', 'black'] as const) {
      lines.push({
        id: `line-cat-${graphOpening.id}-${color}`,
        lineSourceId: graphOpening.id,
        color,
        movePath: graphOpening.uciMoves,
        openingName: graphOpening.canonicalName,
        tags: buildLineTags(graphOpening.uciMoves, graphOpening),
        difficulty: Math.min(10, Math.max(1, Math.floor(graphOpening.uciMoves.length / 2))),
        terminalNodeId,
      });
    }
  }

  return lines;
}

export function filterLinesBySettings(
  lines: TrainingLine[],
  settings: TrainingSettings,
): TrainingLine[] {
  return lines.filter((line) => {
    const depth = getDepthFromTags(line.tags);
    const withinDepth = depth <= settings.maximumDepth || depth === 0;
    const aboveMinimum = depth >= settings.minimumDepth || depth === 0;
    const sidelinesAllowed = settings.includeSidelines || !isSidelineLine(line);

    if (settings.trainingColor !== 'both' && line.color !== settings.trainingColor) {
      return false;
    }

    return withinDepth && aboveMinimum && sidelinesAllowed;
  });
}

export function selectTrainingLines(options: {
  lines: TrainingLine[];
  graph: OpeningGraph;
  settings: TrainingSettings;
  reviewStates: Record<string, ReviewState>;
  repertoireLines: RepertoireLine[];
  now?: Date;
}): TrainingLine[] {
  const now = options.now ?? new Date();
  let filtered = filterLinesBySettings(options.lines, options.settings);

  if (
    options.settings.catalogScope === 'repertoire' &&
    options.repertoireLines.some((line) => line.enabled)
  ) {
    const repertoireNodeIds = collectRepertoireNodeIds(options.graph, options.repertoireLines);
    filtered = filtered.filter((line) => {
      // Repertoire lines always pass
      if (line.id.startsWith('line-rep-')) return true;
      // Catalog lines pass only if their terminal node is in the repertoire
      return line.terminalNodeId ? repertoireNodeIds.has(line.terminalNodeId) : false;
    });
  }

  return [...filtered].sort((left, right) => {
    const leftReview = options.reviewStates[left.id];
    const rightReview = options.reviewStates[right.id];
    const leftScore = getReviewPriority(leftReview, now);
    const rightScore = getReviewPriority(rightReview, now);

    return (
      rightScore - leftScore ||
      left.difficulty - right.difficulty ||
      left.id.localeCompare(right.id)
    );
  });
}

export function buildTrainingSourceSummaries(
  lines: TrainingLine[],
  reviewStates: Record<string, ReviewState>,
  sourceMetaById: Record<string, OpeningSourceMeta> = {},
  now: Date = new Date(),
): TrainingSourceSummary[] {
  const grouped = new Map<
    string,
    {
      sourceId: string;
      sourceIds: Set<string>;
      openingName: string;
      displaySubtitle?: string;
      ecoLabel?: string;
      movePreviewSan?: string;
      namedLineCount?: number;
      lineCount: number;
      dueCount: number;
      discoveredLineCount: number;
      masteredLineCount: number;
      newLineCount: number;
      minDepth: number;
      maxDepth: number;
      difficultyTotal: number;
    }
  >();

  lines.forEach((line) => {
    const depth = getDepthFromTags(line.tags);
    const reviewState = reviewStates[line.id];
    const isDue = !reviewState || new Date(reviewState.dueAt).getTime() <= now.getTime();
    const meta = sourceMetaById[line.lineSourceId];
    const groupingKey = meta?.displayKey ?? line.lineSourceId;
    const entry = grouped.get(groupingKey) ?? {
      sourceId: line.lineSourceId,
      sourceIds: new Set<string>(),
      openingName: meta?.displayTitle ?? line.openingName ?? 'Linea sin nombre',
      displaySubtitle: meta?.displaySubtitle,
      ecoLabel: meta?.ecoLabel,
      movePreviewSan: meta?.movePreviewSan,
      namedLineCount: meta?.namedLineCount,
      lineCount: 0,
      dueCount: 0,
      discoveredLineCount: 0,
      masteredLineCount: 0,
      newLineCount: 0,
      minDepth: Number.POSITIVE_INFINITY,
      maxDepth: 0,
      difficultyTotal: 0,
    };

    entry.sourceIds.add(line.lineSourceId);
    entry.lineCount += 1;
    entry.difficultyTotal += line.difficulty;
    entry.minDepth = Math.min(entry.minDepth, depth || 0);
    entry.maxDepth = Math.max(entry.maxDepth, depth || 0);

    if (!reviewState || reviewState.successes + reviewState.lapses === 0) {
      entry.newLineCount += 1;
    } else {
      entry.discoveredLineCount += 1;
    }

    if (isMastered(reviewState)) {
      entry.masteredLineCount += 1;
    }

    if (isDue) {
      entry.dueCount += 1;
    }

    grouped.set(groupingKey, entry);
  });

  return [...grouped.values()]
    .map((entry) => ({
      sourceId: entry.sourceId,
      sourceIds: [...entry.sourceIds],
      openingName: entry.openingName,
      displaySubtitle: entry.displaySubtitle,
      ecoLabel: entry.ecoLabel,
      movePreviewSan: entry.movePreviewSan,
      namedLineCount: entry.namedLineCount,
      lineCount: entry.lineCount,
      dueCount: entry.dueCount,
      discoveredLineCount: entry.discoveredLineCount,
      masteredLineCount: entry.masteredLineCount,
      newLineCount: entry.newLineCount,
      minDepth: Number.isFinite(entry.minDepth) ? entry.minDepth : 0,
      maxDepth: entry.maxDepth,
      averageDifficulty: entry.lineCount > 0 ? entry.difficultyTotal / entry.lineCount : 0,
    }))
    .sort(
      (left, right) =>
        Number(right.dueCount > 0) - Number(left.dueCount > 0) ||
        Number(right.newLineCount > 0) - Number(left.newLineCount > 0) ||
        right.discoveredLineCount - left.discoveredLineCount ||
        right.dueCount - left.dueCount ||
        right.masteredLineCount - left.masteredLineCount ||
        right.lineCount - left.lineCount ||
        left.openingName.localeCompare(right.openingName),
    );
}
