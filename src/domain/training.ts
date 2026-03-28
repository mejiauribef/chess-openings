import { z } from 'zod';

export const trainingLineSchema = z.object({
  id: z.string().min(1),
  lineSourceId: z.string().min(1),
  color: z.enum(['white', 'black']),
  movePath: z.array(z.string()).min(1),
  openingName: z.string().default(''),
  tags: z.array(z.string()).default([]),
  difficulty: z.number().min(1).max(10),
  terminalNodeId: z.string().default(''),
});

export const reviewStateSchema = z.object({
  cardId: z.string().min(1),
  dueAt: z.string(),
  stability: z.number().nonnegative(),
  difficulty: z.number().min(1).max(10),
  lapses: z.number().int().nonnegative(),
  successes: z.number().int().nonnegative(),
  lastGrade: z.number().int().min(0).max(4),
  streak: z.number().int().nonnegative(),
});

export const trainingSettingsSchema = z.object({
  maximumDepth: z.number().int().positive(),
  minimumDepth: z.number().int().nonnegative().default(0),
  includeSidelines: z.boolean(),
  catalogScope: z.enum(['repertoire', 'catalog']),
  hintsEnabled: z.boolean(),
  trainingColor: z.enum(['white', 'black', 'both']),
  opponentDelay: z.number().int().min(200).max(2000),
  autoRetryDelay: z.number().int().min(500).max(3000),
});

export type TrainingLine = z.infer<typeof trainingLineSchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;
export type TrainingSettings = z.infer<typeof trainingSettingsSchema>;
export type TrainingMode = 'learn' | 'practice' | 'drill';

export interface TrainingSourceSummary {
  sourceId: string;
  sourceIds: string[];
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
  averageDifficulty: number;
}

export interface CoverageMetric {
  label: string;
  total: number;
  mastered: number;
  pending: number;
}

export interface WeakPoint {
  nodeId: string;
  label: string;
  openingLabel: string;
  lapses: number;
  intensity: number;
}

export interface TrainingMetrics {
  totalLines: number;
  dueLines: number;
  masteredLines: number;
  pendingBranches: number;
  retentionRate: number;
  averageStability: number;
  errorsByOpening: Array<{ label: string; lapses: number }>;
  coverageByColor: CoverageMetric[];
  coverageByFamily: CoverageMetric[];
  theoryCoverage: {
    notedNodes: number;
    linkedNotes: number;
    markdownNotes: number;
    coverageRate: number;
  };
  weakPoints: WeakPoint[];
}

export const defaultTrainingSettings: TrainingSettings = {
  maximumDepth: 12,
  minimumDepth: 5,
  includeSidelines: true,
  catalogScope: 'catalog',
  hintsEnabled: true,
  trainingColor: 'both',
  opponentDelay: 500,
  autoRetryDelay: 1500,
};
