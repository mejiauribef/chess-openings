import { z } from 'zod';
import type { OpeningGraph } from './position';
import { epdSchema, fenSchema, uciMoveSchema } from './notation';

export const openingSourceSchema = z.enum([
  'lichess-org/chess-openings',
  'eco-json',
  'user-pgn',
  'manual',
  'seed',
]);

export const theoryNoteSchema = z.object({
  id: z.string().optional(),
  nodeId: z.string().min(1),
  moveUci: uciMoveSchema.optional(),
  title: z.string().min(1),
  summary: z.string().default(''),
  markdown: z.string().default(''),
  keyIdeasWhite: z.array(z.string()).default([]),
  keyIdeasBlack: z.array(z.string()).default([]),
  plans: z.array(z.string()).default([]),
  traps: z.array(z.string()).default([]),
  motifs: z.array(z.string()).default([]),
  pawnStructures: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  linkedNodeIds: z.array(z.string()).default([]),
  references: z.array(z.string()).default([]),
  provenance: z.string().min(1),
  license: z.string().min(1),
});

export const openingEntrySchema = z.object({
  id: z.string().min(1),
  eco: z.string().min(1),
  canonicalName: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  pgn: z.string().min(1),
  uciMoves: z.array(uciMoveSchema).min(1),
  epd: epdSchema,
  fen: fenSchema,
  family: z.string().min(1),
  subvariation: z.string().min(1),
  source: openingSourceSchema,
  sourceLicense: z.string().min(1),
  depth: z.number().int().nonnegative(),
  isInterpolated: z.boolean(),
});

export const openingCatalogEntrySchema = z.object({
  id: z.string().min(1),
  eco: z.string().min(1),
  canonicalName: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  family: z.string().min(1),
  subvariation: z.string().min(1),
  depth: z.number().int().nonnegative(),
  bucketKey: z.string().min(1),
  movePreviewSan: z.string().min(1),
  movePreviewUci: z.string().min(1),
});

export const generatedOpeningsSchema = z.object({
  mode: z.enum(['sample', 'full']),
  generatedAt: z.string(),
  openings: z.array(openingEntrySchema),
});

export const generatedCatalogSchema = z.object({
  mode: z.enum(['sample', 'full']),
  generatedAt: z.string(),
  openings: z.array(openingCatalogEntrySchema),
});

export const generatedOpeningSliceSchema = z.object({
  mode: z.enum(['sample', 'full']),
  generatedAt: z.string(),
  bucketKey: z.string().min(1),
  openings: z.array(openingEntrySchema),
});

export type TheoryNote = z.infer<typeof theoryNoteSchema>;
export type OpeningEntry = z.infer<typeof openingEntrySchema>;
export type OpeningCatalogEntry = z.infer<typeof openingCatalogEntrySchema>;
export type GeneratedOpenings = z.infer<typeof generatedOpeningsSchema>;
export type GeneratedCatalog = z.infer<typeof generatedCatalogSchema>;
export type GeneratedOpeningSlice = z.infer<typeof generatedOpeningSliceSchema>;

export interface GeneratedBootstrap {
  mode: 'sample' | 'full';
  generatedAt: string;
  opening: OpeningEntry;
  graph: OpeningGraph;
}
