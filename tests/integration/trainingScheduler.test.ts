import type { ReviewState, TrainingLine } from '@/domain/training';
import { filterLinesBySettings, selectTrainingLines } from '@/lib/training/cards';
import { rescheduleReview } from '@/lib/training/scheduler';
import { buildOpeningGraph } from '@/lib/chess/openingGraph';
import { sampleOpenings } from '../fixtures/sampleOpenings';

describe('training scheduler', () => {
  it('reschedules a failed card close to now', () => {
    const now = new Date('2026-03-16T10:00:00.000Z');
    const next = rescheduleReview(undefined, 'card-1', 1, now);

    expect(next.lapses).toBe(1);
    expect(new Date(next.dueAt).getTime()).toBe(now.getTime() + 10 * 60 * 1000);
  });

  it('changes line selection with settings without mutating progress', () => {
    const lines: TrainingLine[] = [
      {
        id: 'main',
        lineSourceId: 'opening-1',
        color: 'white',
        movePath: ['e2e4'],
        openingName: 'Main Line',
        tags: ['catalog', 'depth:1'],
        difficulty: 1,
        terminalNodeId: '',
      },
      {
        id: 'sideline',
        lineSourceId: 'opening-2',
        color: 'white',
        movePath: ['a2a3'],
        openingName: 'Sideline',
        tags: ['sideline', 'depth:1'],
        difficulty: 1,
        terminalNodeId: '',
      },
    ];

    const reviewStates: Record<string, ReviewState> = {
      main: {
        cardId: 'main',
        dueAt: '2026-03-17T00:00:00.000Z',
        stability: 2,
        difficulty: 4,
        lapses: 0,
        successes: 1,
        lastGrade: 4,
        streak: 1,
      },
    };

    const strict = filterLinesBySettings(
      lines,
      {
        maximumDepth: 10,
        minimumDepth: 0,
        includeSidelines: false,
        catalogScope: 'catalog',
        hintsEnabled: true,
        trainingColor: 'both',
        opponentDelay: 500,
        autoRetryDelay: 1500,
      },
    );

    const relaxed = filterLinesBySettings(
      lines,
      {
        maximumDepth: 10,
        minimumDepth: 0,
        includeSidelines: true,
        catalogScope: 'catalog',
        hintsEnabled: true,
        trainingColor: 'both',
        opponentDelay: 500,
        autoRetryDelay: 1500,
      },
    );

    expect(strict).toHaveLength(1);
    expect(relaxed).toHaveLength(2);
    expect(reviewStates.main?.streak).toBe(1);
  });

  it('prioritizes due lines using SRS sorting', () => {
    const graph = buildOpeningGraph(sampleOpenings);
    const lines: TrainingLine[] = [
      {
        id: 'new-line',
        lineSourceId: 'ruy-lopez',
        color: 'white',
        movePath: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'],
        openingName: 'Ruy Lopez',
        tags: ['catalog', 'depth:3'],
        difficulty: 2,
        terminalNodeId: '',
      },
      {
        id: 'due-line',
        lineSourceId: 'italian-game',
        color: 'white',
        movePath: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'],
        openingName: 'Italian Game',
        tags: ['catalog', 'depth:3'],
        difficulty: 3,
        terminalNodeId: '',
      },
    ];
    const reviewStates: Record<string, ReviewState> = {
      'due-line': {
        cardId: 'due-line',
        dueAt: '2026-03-16T08:00:00.000Z',
        stability: 1,
        difficulty: 5,
        lapses: 1,
        successes: 0,
        lastGrade: 1,
        streak: 0,
      },
    };

    const selected = selectTrainingLines({
      lines,
      graph,
      settings: {
        maximumDepth: 12,
        minimumDepth: 0,
        includeSidelines: true,
        catalogScope: 'catalog',
        hintsEnabled: true,
        trainingColor: 'both',
        opponentDelay: 500,
        autoRetryDelay: 1500,
      },
      reviewStates,
      repertoireLines: [],
      now: new Date('2026-03-16T10:00:00.000Z'),
    });

    expect(selected[0]?.id).toBe('due-line');
  });
});
