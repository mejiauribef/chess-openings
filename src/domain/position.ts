import { z } from 'zod';
import { openingEntrySchema } from './opening';
import { epdSchema, fenSchema, sideToMoveSchema, uciMoveSchema } from './notation';

export const moveEdgeSchema = z.object({
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  uci: uciMoveSchema,
  san: z.string().min(1),
  isMainLine: z.boolean(),
  source: z.string().min(1),
  weight: z.number().nonnegative(),
  tags: z.array(z.string()).default([]),
});

export const positionNodeSchema = z.object({
  id: z.string().min(1),
  fen: fenSchema,
  epd: epdSchema,
  moveNumber: z.number().int().nonnegative(),
  sideToMove: sideToMoveSchema,
  openingIds: z.array(z.string()).default([]),
  parentIds: z.array(z.string()).default([]),
  childEdges: z.array(moveEdgeSchema).default([]),
  transpositionGroupId: z.string().min(1),
});

export const openingGraphSchema = z.object({
  rootNodeId: z.string().min(1),
  openingsById: z.record(z.string(), openingEntrySchema),
  nodes: z.record(z.string(), positionNodeSchema),
  indexes: z.object({
    eco: z.record(z.string(), z.array(z.string())),
    canonicalName: z.record(z.string(), z.array(z.string())),
    alias: z.record(z.string(), z.array(z.string())),
    firstMoves: z.record(z.string(), z.array(z.string())),
    transpositionGroupId: z.record(z.string(), z.array(z.string())),
  }),
});

export const generatedOpeningGraphSchema = z.object({
  mode: z.enum(['sample', 'full']),
  generatedAt: z.string(),
  rootNodeId: z.string().min(1),
  nodeCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
  graph: openingGraphSchema,
});

export const generatedOpeningGraphSliceSchema = z.object({
  mode: z.enum(['sample', 'full']),
  generatedAt: z.string(),
  bucketKey: z.string().min(1),
  openingIds: z.array(z.string()),
  nodeCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
  graph: openingGraphSchema,
});

export type MoveEdge = z.infer<typeof moveEdgeSchema>;
export type PositionNode = z.infer<typeof positionNodeSchema>;
export type OpeningGraph = z.infer<typeof openingGraphSchema>;
export type GeneratedOpeningGraph = z.infer<typeof generatedOpeningGraphSchema>;
export type GeneratedOpeningGraphSlice = z.infer<typeof generatedOpeningGraphSliceSchema>;
