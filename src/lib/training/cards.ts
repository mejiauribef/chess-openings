import type { OpeningEntry } from '@/domain/opening';
import type { RepertoireLine } from '@/domain/repertoire';
import type { OpeningGraph, PositionNode } from '@/domain/position';
import type { ReviewState, TrainingLine, TrainingSettings } from '@/domain/training';
import { applyUciLine, toNodeIdFromEpd } from '@/lib/chess/openingGraph';

export function normalizeTrainingAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').trim();
}

function getDepthFromTags(tags: string[]): number {
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

function buildLineTags(graph: OpeningGraph, movePath: string[], opening?: OpeningEntry): string[] {
  const tags: string[] = [];
  const depth = Math.ceil(movePath.length / 2);
  tags.push(`depth:${depth}`);

  if (opening) {
    if (opening.family) {
      tags.push(`family:${opening.family.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    }
    tags.push('catalog');
  }

  const { epd } = applyUciLine(movePath);
  const nodeId = toNodeIdFromEpd(epd);
  const node = graph.nodes[nodeId];
  if (node && node.sideToMove === 'w') {
    tags.push('white-turn');
  } else if (node) {
    tags.push('black-turn');
  }

  return tags;
}

function collectRepertoireNodeIds(graph: OpeningGraph, repertoireLines: RepertoireLine[]): Set<string> {
  const nodeIds = new Set<string>();

  repertoireLines
    .filter((line) => line.enabled)
    .forEach((line) => {
      for (let length = 1; length <= line.movePath.length; length += 1) {
        const prefix = line.movePath.slice(0, length);
        const { epd } = applyUciLine(prefix);
        const nodeId = toNodeIdFromEpd(epd);

        if (graph.nodes[nodeId]) {
          nodeIds.add(nodeId);
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

    lines.push({
      id: `line-rep-${repLine.id}`,
      lineSourceId: repLine.id,
      color: repLine.color,
      movePath: repLine.movePath,
      openingName,
      tags: [...repLine.tags, ...buildLineTags(graph, repLine.movePath, opening), 'repertoire'],
      difficulty: Math.min(10, Math.max(1, Math.floor(repLine.movePath.length / 2))),
    });

    if (opening) {
      coveredOpeningIds.add(opening.id);
    }
  }

  // From catalog openings not already covered by repertoire
  for (const opening of Object.values(graph.openingsById)) {
    if (coveredOpeningIds.has(opening.id)) continue;
    if (opening.uciMoves.length === 0) continue;

    for (const color of ['white', 'black'] as const) {
      lines.push({
        id: `line-cat-${opening.id}-${color}`,
        lineSourceId: opening.id,
        color,
        movePath: opening.uciMoves,
        openingName: opening.canonicalName,
        tags: buildLineTags(graph, opening.uciMoves, opening),
        difficulty: Math.min(10, Math.max(1, Math.floor(opening.uciMoves.length / 2))),
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
    const sidelinesAllowed = settings.includeSidelines || !isSidelineLine(line);

    if (settings.trainingColor !== 'both' && line.color !== settings.trainingColor) {
      return false;
    }

    return withinDepth && sidelinesAllowed;
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
      const { epd } = applyUciLine(line.movePath);
      const nodeId = toNodeIdFromEpd(epd);
      return repertoireNodeIds.has(nodeId);
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
