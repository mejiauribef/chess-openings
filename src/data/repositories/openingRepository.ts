import type { OpeningCatalogEntry, OpeningEntry, TheoryNote } from '@/domain/opening';
import type { OpeningGraph } from '@/domain/position';
import {
  hydrateGeneratedCatalogIndex,
  loadGeneratedBootstrapAsset,
  loadGeneratedCatalogEntriesAsset,
  loadGeneratedGraphSlice,
  loadGeneratedOpeningSlice,
  loadRuntimeManifest,
} from '@/data/adapters/generatedOpeningsAdapter';
import type { GeneratedRuntimeManifest } from '@/domain/runtimeAssets';
import { RuntimeAssetRepository } from './runtimeAssetRepository';

export interface OpeningRepositoryPayload {
  openings: OpeningCatalogEntry[];
  graph: OpeningGraph;
  theoryNotes: TheoryNote[];
  defaultOpeningId?: string;
  preloadedOpenings: OpeningEntry[];
}

export class OpeningRepository {
  private readonly runtimeAssetRepository = new RuntimeAssetRepository();
  private manifestPromise?: Promise<GeneratedRuntimeManifest>;

  private getManifest(): Promise<GeneratedRuntimeManifest> {
    if (!this.manifestPromise) {
      this.manifestPromise = loadRuntimeManifest();
    }

    return this.manifestPromise;
  }

  async load(): Promise<OpeningRepositoryPayload> {
    const manifest = await this.getManifest();
    const cachedCatalog = await this.runtimeAssetRepository.load<OpeningCatalogEntry[]>(
      'catalog',
      manifest.generatedAt,
    );
    const bootstrap = await loadGeneratedBootstrapAsset();

    if (cachedCatalog) {
      return {
        ...hydrateGeneratedCatalogIndex(cachedCatalog),
        graph: bootstrap.graph,
        defaultOpeningId: bootstrap.opening.id,
        preloadedOpenings: [bootstrap.opening],
      };
    }

    const openings = await loadGeneratedCatalogEntriesAsset();
    await this.runtimeAssetRepository.save('catalog', manifest.generatedAt, openings);
    return {
      ...hydrateGeneratedCatalogIndex(openings),
      graph: bootstrap.graph,
      defaultOpeningId: bootstrap.opening.id,
      preloadedOpenings: [bootstrap.opening],
    };
  }

  async loadGraphSlice(bucketKey: string): Promise<OpeningGraph> {
    const manifest = await this.getManifest();
    const cacheKey = `graph:${bucketKey}`;
    const cached = await this.runtimeAssetRepository.load<OpeningGraph>(cacheKey, manifest.generatedAt);

    if (cached) {
      return cached;
    }

    const graph = await loadGeneratedGraphSlice(bucketKey);
    await this.runtimeAssetRepository.save(cacheKey, manifest.generatedAt, graph);
    return graph;
  }

  async loadOpeningSlice(bucketKey: string): Promise<OpeningEntry[]> {
    const manifest = await this.getManifest();
    const cacheKey = `openings:${bucketKey}`;
    const cached = await this.runtimeAssetRepository.load<OpeningEntry[]>(cacheKey, manifest.generatedAt);

    if (cached) {
      return cached;
    }

    const openings = await loadGeneratedOpeningSlice(bucketKey);
    await this.runtimeAssetRepository.save(cacheKey, manifest.generatedAt, openings);
    return openings;
  }
}
