import { z } from 'zod';

export const generatedBucketSummarySchema = z.object({
  bucketKey: z.string().min(1),
  openingCount: z.number().int().nonnegative(),
  nodeCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
});

export const generatedRuntimeManifestSchema = z.object({
  mode: z.enum(['sample', 'full']),
  generatedAt: z.string(),
  catalogCount: z.number().int().nonnegative(),
  graphNodeCount: z.number().int().nonnegative(),
  graphEdgeCount: z.number().int().nonnegative(),
  buckets: z.array(generatedBucketSummarySchema),
});

export const compactCatalogRowSchema = z.tuple([
  z.string().min(1),
  z.string().min(1),
  z.string().min(1),
  z.array(z.string()),
  z.string().min(1),
  z.string().min(1),
  z.number().int().nonnegative(),
  z.string().min(1),
  z.string().min(1),
]);

export const generatedCompactCatalogSchema = z.object({
  mode: z.enum(['sample', 'full']),
  generatedAt: z.string(),
  openings: z.array(compactCatalogRowSchema),
});

export type GeneratedRuntimeManifest = z.infer<typeof generatedRuntimeManifestSchema>;
export type CompactCatalogRow = z.infer<typeof compactCatalogRowSchema>;
