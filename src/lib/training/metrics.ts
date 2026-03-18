import type { TheoryNote } from '@/domain/opening';
import type { OpeningGraph } from '@/domain/position';
import type { CoverageMetric, ReviewState, TrainingLine, TrainingMetrics } from '@/domain/training';
import { getOpeningNameForNode } from '@/lib/chess/openingGraph';
import { isReviewDue } from '@/lib/training/scheduler';

function isMastered(reviewState: ReviewState | undefined): boolean {
  return Boolean(reviewState && reviewState.lastGrade >= 3 && reviewState.streak >= 2 && reviewState.stability >= 4);
}

function isPending(reviewState: ReviewState | undefined, now: Date): boolean {
  return isReviewDue(reviewState, now);
}

function resolveNodeId(line: TrainingLine): string {
  return line.terminalNodeId || `unknown-${line.id}`;
}

function buildCoverage(
  labels: string[],
  lines: TrainingLine[],
  reviewStates: Record<string, ReviewState>,
  now: Date,
  resolver: (line: TrainingLine) => string[],
): CoverageMetric[] {
  return labels.map((label) => {
    const labelLines = lines.filter((line) => resolver(line).includes(label));
    const uniqueNodeIds = [...new Set(labelLines.map(resolveNodeId))];
    const mastered = uniqueNodeIds.filter((nodeId) =>
      labelLines.some((line) => resolveNodeId(line) === nodeId && isMastered(reviewStates[line.id])),
    );
    const pending = uniqueNodeIds.filter((nodeId) =>
      labelLines.some((line) => resolveNodeId(line) === nodeId && isPending(reviewStates[line.id], now)),
    );

    return {
      label,
      total: uniqueNodeIds.length,
      mastered: mastered.length,
      pending: pending.length,
    };
  });
}

export function buildTrainingMetrics(options: {
  lines: TrainingLine[];
  graph: OpeningGraph;
  reviewStates: Record<string, ReviewState>;
  theoryNotes?: TheoryNote[];
  now?: Date;
}): TrainingMetrics {
  const now = options.now ?? new Date();
  const metricLines = options.lines;
  const uniqueNodeIds = [...new Set(metricLines.map(resolveNodeId))];
  const masteredLines = uniqueNodeIds.filter((nodeId) =>
    metricLines.some((line) => resolveNodeId(line) === nodeId && isMastered(options.reviewStates[line.id])),
  );
  const pendingBranches = uniqueNodeIds.filter((nodeId) =>
    metricLines.some((line) => resolveNodeId(line) === nodeId && isPending(options.reviewStates[line.id], now)),
  );
  const successes = metricLines.reduce((total, line) => total + (options.reviewStates[line.id]?.successes ?? 0), 0);
  const lapses = metricLines.reduce((total, line) => total + (options.reviewStates[line.id]?.lapses ?? 0), 0);
  const averageStability =
    metricLines.length > 0
      ? metricLines.reduce((total, line) => total + (options.reviewStates[line.id]?.stability ?? 0), 0) /
        metricLines.length
      : 0;
  const errorsByOpeningMap = new Map<string, number>();

  metricLines.forEach((line) => {
    const lineLapses = options.reviewStates[line.id]?.lapses ?? 0;
    if (lineLapses === 0) return;

    const nodeId = resolveNodeId(line);
    const node = options.graph.nodes[nodeId];
    const openingLabels = node?.openingIds?.length
      ? [...new Set(node.openingIds.map((openingId) => options.graph.openingsById[openingId]?.canonicalName).filter(Boolean))]
      : line.openingName ? [line.openingName] : [getOpeningNameForNode(options.graph, nodeId)];

    openingLabels.forEach((label) => {
      errorsByOpeningMap.set(label, (errorsByOpeningMap.get(label) ?? 0) + lineLapses);
    });
  });

  const colorCoverage = buildCoverage(
    ['Blancas', 'Negras'],
    metricLines,
    options.reviewStates,
    now,
    (line) => [line.color === 'white' ? 'Blancas' : 'Negras'],
  );

  const families = [
    ...new Set(
      metricLines.flatMap((line) => {
        const nodeId = resolveNodeId(line);
        const node = options.graph.nodes[nodeId];
        return node?.openingIds
          ?.map((openingId) => options.graph.openingsById[openingId]?.family)
          .filter((family): family is string => Boolean(family)) ?? [];
      }),
    ),
  ].sort((left, right) => left.localeCompare(right));

  const coverageByFamily = buildCoverage(
    families,
    metricLines,
    options.reviewStates,
    now,
    (line) => {
      const nodeId = resolveNodeId(line);
      const node = options.graph.nodes[nodeId];
      return node?.openingIds
        ?.map((openingId) => options.graph.openingsById[openingId]?.family)
        .filter((family): family is string => Boolean(family)) ?? [];
    },
  );

  const weakPointsRaw = uniqueNodeIds
    .map((nodeId) => {
      const nodeLines = metricLines.filter((line) => resolveNodeId(line) === nodeId);
      const totalLapses = nodeLines.reduce((total, line) => total + (options.reviewStates[line.id]?.lapses ?? 0), 0);
      const openingLabel = getOpeningNameForNode(options.graph, nodeId);

      return {
        nodeId,
        label: openingLabel === 'Unnamed position' ? nodeId : openingLabel,
        openingLabel,
        lapses: totalLapses,
      };
    })
    .filter((entry) => entry.lapses > 0)
    .sort((left, right) => right.lapses - left.lapses || left.label.localeCompare(right.label))
    .slice(0, 10);
  const maxLapses = weakPointsRaw[0]?.lapses ?? 1;

  const theoryNotes = options.theoryNotes ?? [];
  const theoryNodeIds = new Set(theoryNotes.map((note) => note.nodeId));
  const notesWithLinks = theoryNotes.filter((note) => note.linkedNodeIds.length > 0).length;
  const notesWithMarkdown = theoryNotes.filter((note) => note.markdown.trim().length > 0).length;
  const theoryCoverageRate = uniqueNodeIds.length > 0 ? theoryNodeIds.size / uniqueNodeIds.length : 0;

  return {
    totalLines: metricLines.length,
    dueLines: metricLines.filter((line) => isPending(options.reviewStates[line.id], now)).length,
    masteredLines: masteredLines.length,
    pendingBranches: pendingBranches.length,
    retentionRate: successes + lapses > 0 ? successes / (successes + lapses) : 0,
    averageStability,
    errorsByOpening: [...errorsByOpeningMap.entries()]
      .map(([label, lapses]) => ({ label, lapses }))
      .sort((left, right) => right.lapses - left.lapses || left.label.localeCompare(right.label))
      .slice(0, 6),
    coverageByColor: colorCoverage,
    coverageByFamily: coverageByFamily
      .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label))
      .slice(0, 6),
    theoryCoverage: {
      notedNodes: theoryNodeIds.size,
      linkedNotes: notesWithLinks,
      markdownNotes: notesWithMarkdown,
      coverageRate: theoryCoverageRate,
    },
    weakPoints: weakPointsRaw.map((entry) => ({
      ...entry,
      intensity: entry.lapses / maxLapses,
    })),
  };
}
