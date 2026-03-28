import { describe, expect, it } from 'vitest';
import type { TrainingLine } from '@/domain/training';
import { buildTrainingSourceSummaries } from '@/lib/training/cards';

describe('buildTrainingSourceSummaries', () => {
  it('groups equivalent sources when display metadata points to the same variation', () => {
    const lines: TrainingLine[] = [
      {
        id: 'line-1',
        lineSourceId: 'sic-1',
        color: 'white',
        movePath: ['e2e4', 'c7c5'],
        openingName: 'Sicilian Defence',
        tags: ['depth:5'],
        difficulty: 3,
        terminalNodeId: 'node-1',
      },
      {
        id: 'line-2',
        lineSourceId: 'sic-2',
        color: 'black',
        movePath: ['e2e4', 'c7c5', 'g1f3', 'd7d6'],
        openingName: 'Sicilian Defense',
        tags: ['depth:6'],
        difficulty: 4,
        terminalNodeId: 'node-2',
      },
    ];

    const summaries = buildTrainingSourceSummaries(
      lines,
      {},
      {
        'sic-1': {
          displayKey: 'sicilian|main line|e2e4 c7c5',
          displayTitle: 'Sicilian Defense',
          displayFamily: 'Sicilian Defense',
          displaySubtitle: 'Main line',
          ecoLabel: 'B20',
          movePreviewSan: '1. e4 c5',
          namedLineCount: 2,
          minDepth: 5,
          maxDepth: 6,
        },
        'sic-2': {
          displayKey: 'sicilian|main line|e2e4 c7c5',
          displayTitle: 'Sicilian Defense',
          displayFamily: 'Sicilian Defense',
          displaySubtitle: 'Main line',
          ecoLabel: 'B20',
          movePreviewSan: '1. e4 c5',
          namedLineCount: 2,
          minDepth: 5,
          maxDepth: 6,
        },
      },
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      openingName: 'Sicilian Defense',
      ecoLabel: 'B20',
      displaySubtitle: 'Main line',
      namedLineCount: 2,
      lineCount: 2,
      discoveredLineCount: 0,
      masteredLineCount: 0,
      newLineCount: 2,
      minDepth: 5,
      maxDepth: 6,
    });
    expect(summaries[0]?.sourceIds).toEqual(expect.arrayContaining(['sic-1', 'sic-2']));
  });

  it('tracks discovered and mastered lines per grouped source', () => {
    const lines: TrainingLine[] = [
      {
        id: 'line-1',
        lineSourceId: 'sic-1',
        color: 'white',
        movePath: ['e2e4', 'c7c5'],
        openingName: 'Sicilian Defense',
        tags: ['depth:5'],
        difficulty: 3,
        terminalNodeId: 'node-1',
      },
      {
        id: 'line-2',
        lineSourceId: 'sic-1',
        color: 'black',
        movePath: ['e2e4', 'c7c5', 'g1f3', 'd7d6'],
        openingName: 'Sicilian Defense',
        tags: ['depth:6'],
        difficulty: 4,
        terminalNodeId: 'node-2',
      },
    ];

    const summaries = buildTrainingSourceSummaries(
      lines,
      {
        'line-1': {
          cardId: 'line-1',
          dueAt: '2026-03-27T10:00:00.000Z',
          stability: 4,
          difficulty: 4,
          lapses: 0,
          successes: 1,
          lastGrade: 4,
          streak: 2,
        },
      },
      {
        'sic-1': {
          displayKey: 'sicilian|main line|e2e4 c7c5',
          displayTitle: 'Sicilian Defense',
          displayFamily: 'Sicilian Defense',
          displaySubtitle: 'Main line',
          ecoLabel: 'B20',
          movePreviewSan: '1. e4 c5',
          namedLineCount: 1,
          minDepth: 5,
          maxDepth: 6,
        },
      },
      new Date('2026-03-27T12:00:00.000Z'),
    );

    expect(summaries[0]).toMatchObject({
      discoveredLineCount: 1,
      masteredLineCount: 1,
      newLineCount: 1,
      dueCount: 2,
    });
  });
});
