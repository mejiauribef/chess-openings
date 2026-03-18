import type { ReviewState, TrainingLine } from '@/domain/training';
import { buildOpeningGraph, resolveNodeIdFromUciLine } from '@/lib/chess/openingGraph';
import { createTrainingLines, selectTrainingLines } from '@/lib/training/cards';
import { buildTrainingMetrics } from '@/lib/training/metrics';
import { sampleOpenings } from '../fixtures/sampleOpenings';

describe('training metrics and line selection', () => {
  it('filters deck to the requested color and repertoire scope', () => {
    const graph = buildOpeningGraph(sampleOpenings);
    const lines = createTrainingLines(graph, [
      {
        id: 'rep-1',
        color: 'black',
        rootOpeningId: 'qgd-main-order',
        movePath: ['d2d4', 'd7d5', 'c2c4', 'e7e6'],
        tags: ['main-line'],
        priority: 1,
        enabled: true,
      },
    ]);

    const selected = selectTrainingLines({
      lines,
      graph,
      settings: {
        maximumDepth: 12,
        includeSidelines: true,
        catalogScope: 'repertoire',
        hintsEnabled: true,
        trainingColor: 'black',
        opponentDelay: 500,
        autoRetryDelay: 1500,
      },
      reviewStates: {},
      repertoireLines: [
        {
          id: 'rep-1',
          color: 'black',
          rootOpeningId: 'qgd-main-order',
          movePath: ['d2d4', 'd7d5', 'c2c4', 'e7e6'],
          tags: ['main-line'],
          priority: 1,
          enabled: true,
        },
      ],
    });

    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((line) => line.color === 'black')).toBe(true);
  });

  it('builds basic metrics including weak points and theory coverage', () => {
    const graph = buildOpeningGraph(sampleOpenings);
    const transpositionNodeId = resolveNodeIdFromUciLine(graph, [
      'd2d4',
      'd7d5',
      'c2c4',
      'e7e6',
      'b1c3',
      'g8f6',
    ]);
    const relevantLines: TrainingLine[] = [
      {
        id: `line-cat-qgd-main-order-white`,
        lineSourceId: 'qgd-main-order',
        color: 'white',
        movePath: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6'],
        openingName: "Queen's Gambit Declined",
        tags: ['catalog', 'depth:3', 'white-turn'],
        difficulty: 3,
      },
      {
        id: `line-cat-qgd-main-order-black`,
        lineSourceId: 'qgd-main-order',
        color: 'black',
        movePath: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6'],
        openingName: "Queen's Gambit Declined",
        tags: ['catalog', 'depth:3', 'black-turn'],
        difficulty: 3,
      },
    ];
    const reviewStates: Record<string, ReviewState> = Object.fromEntries(
      relevantLines.map((line) => [
        line.id,
        {
          cardId: line.id,
          dueAt: '2026-03-16T09:00:00.000Z',
          stability: 2,
          difficulty: 6,
          lapses: 2,
          successes: 0,
          lastGrade: 1,
          streak: 0,
        },
      ]),
    );

    const metrics = buildTrainingMetrics({
      lines: relevantLines,
      graph,
      reviewStates,
      theoryNotes: [
        {
          id: 'note-1',
          nodeId: transpositionNodeId,
          title: 'QGD transposition',
          summary: 'Las lineas convergen a la misma estructura.',
          markdown: '## QGD\n- Misma posicion',
          keyIdeasWhite: [],
          keyIdeasBlack: [],
          plans: [],
          traps: [],
          motifs: [],
          pawnStructures: [],
          tags: ['plan'],
          linkedNodeIds: ['other-node'],
          references: [],
          provenance: 'manual',
          license: 'user',
        },
      ],
      now: new Date('2026-03-16T10:00:00.000Z'),
    });

    expect(metrics.totalLines).toBeGreaterThan(0);
    expect(metrics.theoryCoverage.notedNodes).toBe(1);
    expect(metrics.errorsByOpening.some((entry) => entry.label.includes("Queen's Gambit"))).toBe(true);
    expect(metrics.weakPoints.length).toBeGreaterThan(0);
  });
});
