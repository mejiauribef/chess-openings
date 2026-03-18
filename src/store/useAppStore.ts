import { create } from 'zustand';
import type { OpeningCatalogEntry, OpeningEntry, TheoryNote } from '@/domain/opening';
import type { OpeningGraph } from '@/domain/position';
import type { RepertoireLine } from '@/domain/repertoire';
import type { ReviewState, TrainingSettings } from '@/domain/training';
import { defaultTrainingSettings } from '@/domain/training';
import { importPgnRepertoire } from '@/lib/chess/pgn';
import {
  createEmptyGraph,
  deriveBucketKey,
  findPathToNode,
  mergeOpeningGraphs,
  mergeRepertoireLinesIntoGraph,
  resolveNodeIdFromUciLine,
} from '@/lib/chess/openingGraph';
import { OpeningRepository } from '@/data/repositories/openingRepository';
import { RepertoireRepository } from '@/data/repositories/repertoireRepository';
import { ReviewStateRepository } from '@/data/repositories/reviewStateRepository';
import { SettingsRepository } from '@/data/repositories/settingsRepository';
import { TheoryNotesRepository } from '@/data/repositories/theoryNotesRepository';

type AppTab = 'catalog' | 'explorer' | 'training' | 'repertoire' | 'theory' | 'settings';

function dedupeTheoryNotes(notes: TheoryNote[]): TheoryNote[] {
  return [...new Map(notes.map((note) => [note.id ?? `${note.nodeId}|${note.title}|${note.summary}|${note.markdown.length}`, note])).values()];
}

function buildWorkingGraph(baseGraph: OpeningGraph, repertoireLines: RepertoireLine[]): OpeningGraph {
  return mergeRepertoireLinesIntoGraph(baseGraph, repertoireLines);
}

function getLoadedOpening(
  detailsById: Record<string, OpeningEntry>,
  openingId: string | undefined,
): OpeningEntry | undefined {
  return openingId ? detailsById[openingId] : undefined;
}

function tryResolveNodeIdFromUciLine(graph: OpeningGraph, uciMoves: string[]): string | undefined {
  try {
    return resolveNodeIdFromUciLine(graph, uciMoves);
  } catch {
    return undefined;
  }
}

interface AppState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  activeTab: AppTab;
  error?: string;
  openings: OpeningCatalogEntry[];
  openingDetailsById: Record<string, OpeningEntry>;
  baseGraph: OpeningGraph;
  graph: OpeningGraph;
  loadedBuckets: string[];
  loadingBuckets: string[];
  theoryNotes: TheoryNote[];
  repertoireLines: RepertoireLine[];
  selectedOpeningId?: string;
  selectedNodeId?: string;
  explorerPath: string[];
  settings: TrainingSettings;
  reviewStates: Record<string, ReviewState>;
  initialize: () => Promise<void>;
  setActiveTab: (tab: AppTab) => void;
  selectOpening: (openingId: string) => void;
  selectNode: (nodeId: string) => void;
  selectExplorerMove: (uci: string) => void;
  resetExplorerToOpening: () => void;
  updateSettings: (partial: Partial<TrainingSettings>) => Promise<void>;
  saveReviewState: (reviewState: ReviewState) => Promise<void>;
  saveTheoryNote: (note: TheoryNote) => Promise<TheoryNote>;
  deleteTheoryNote: (noteId: string) => Promise<void>;
  saveRepertoireLine: (line: RepertoireLine) => Promise<void>;
  toggleRepertoireLine: (lineId: string) => Promise<void>;
  createRepertoireFromOpening: (color: RepertoireLine['color']) => Promise<void>;
  importRepertoirePgn: (payload: { pgn: string; color: RepertoireLine['color'] }) => Promise<void>;
  ensureOpeningLoaded: (openingId: string) => Promise<void>;
}

const openingRepository = new OpeningRepository();
const repertoireRepository = new RepertoireRepository();
const settingsRepository = new SettingsRepository();
const reviewStateRepository = new ReviewStateRepository();
const theoryNotesRepository = new TheoryNotesRepository();

export const useAppStore = create<AppState>((set, get) => ({
  status: 'idle',
  activeTab: 'catalog',
  openings: [],
  openingDetailsById: {},
  baseGraph: createEmptyGraph(),
  graph: createEmptyGraph(),
  loadedBuckets: [],
  loadingBuckets: [],
  repertoireLines: [],
  theoryNotes: [],
  explorerPath: [],
  settings: defaultTrainingSettings,
  reviewStates: {},
  initialize: async () => {
    if (get().status === 'ready') {
      return;
    }

    set({ status: 'loading', error: undefined });

    try {
      const [{ openings, graph, theoryNotes, defaultOpeningId, preloadedOpenings }, settings, reviewStates, repertoireLines, persistedNotes] =
        await Promise.all([
          openingRepository.load(),
          settingsRepository.load(),
          reviewStateRepository.loadAll(),
          repertoireRepository.loadAll(),
          theoryNotesRepository.loadAll(),
        ]);

      const workingGraph = buildWorkingGraph(graph, repertoireLines);
      const openingDetailsById = Object.fromEntries(preloadedOpenings.map((entry) => [entry.id, entry]));
      const defaultOpening =
        openings.find((opening) => opening.id === defaultOpeningId) ??
        openings.find((opening) => opening.id === preloadedOpenings[0]?.id) ??
        openings[0];
      const defaultOpeningDetail = getLoadedOpening(openingDetailsById, defaultOpening?.id);

      set({
        status: 'ready',
        openings,
        openingDetailsById,
        baseGraph: graph,
        graph: workingGraph,
        loadedBuckets: [],
        loadingBuckets: [],
        theoryNotes: dedupeTheoryNotes([...theoryNotes, ...persistedNotes]),
        repertoireLines,
        settings,
        reviewStates,
        selectedOpeningId: defaultOpening?.id,
        selectedNodeId: defaultOpeningDetail
          ? tryResolveNodeIdFromUciLine(workingGraph, defaultOpeningDetail.uciMoves)
          : undefined,
        explorerPath: defaultOpeningDetail?.uciMoves ?? [],
      });

      if (defaultOpening) {
        void get().ensureOpeningLoaded(defaultOpening.id);
      }
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'No se pudo inicializar la aplicacion.',
      });
    }
  },
  setActiveTab: (activeTab) => set({ activeTab }),
  selectOpening: (openingId) => {
    const graph = get().graph;
    const opening = get().openings.find((candidate) => candidate.id === openingId);
    const openingDetail = getLoadedOpening(get().openingDetailsById, openingId);

    if (!opening) {
      return;
    }

    const isLoaded = get().loadedBuckets.includes(opening.bucketKey) && !!openingDetail;
    const selectedNodeId = openingDetail
      ? tryResolveNodeIdFromUciLine(graph, openingDetail.uciMoves)
      : undefined;

    set({
      selectedOpeningId: openingId,
      selectedNodeId,
      explorerPath: openingDetail?.uciMoves ?? [],
    });

    if (!isLoaded) {
      void get().ensureOpeningLoaded(openingId);
    }
  },
  selectNode: (nodeId) => {
    const graph = get().graph;
    if (!graph.nodes[nodeId]) {
      return;
    }

    const path = findPathToNode(graph, nodeId);
    if (!path) {
      return;
    }

    set({
      selectedNodeId: nodeId,
      explorerPath: path.uciMoves,
    });
  },
  selectExplorerMove: (uci) => {
    const graph = get().graph;
    const currentNodeId = get().selectedNodeId;

    if (!currentNodeId) {
      return;
    }

    const currentNode = graph.nodes[currentNodeId];
    const edge = currentNode.childEdges.find((candidate) => candidate.uci === uci);

    if (!edge) {
      return;
    }

    set((state) => ({
      selectedNodeId: edge.toNodeId,
      explorerPath: [...state.explorerPath, edge.uci],
    }));
  },
  resetExplorerToOpening: () => {
    const graph = get().graph;
    const opening = get().openings.find((candidate) => candidate.id === get().selectedOpeningId);
    const openingDetail = getLoadedOpening(get().openingDetailsById, opening?.id);

    if (!opening) {
      return;
    }

    if (get().loadedBuckets.includes(opening.bucketKey) && openingDetail) {
      set({
        selectedNodeId: tryResolveNodeIdFromUciLine(graph, openingDetail.uciMoves),
        explorerPath: openingDetail.uciMoves,
      });
      return;
    }

    if (openingDetail) {
      set({
        selectedNodeId: tryResolveNodeIdFromUciLine(graph, openingDetail.uciMoves),
        explorerPath: openingDetail.uciMoves,
      });
    }

    void get().ensureOpeningLoaded(opening.id);
  },
  updateSettings: async (partial) => {
    const nextSettings = { ...get().settings, ...partial };
    await settingsRepository.save(nextSettings);
    set({ settings: nextSettings });
  },
  saveReviewState: async (reviewState) => {
    await reviewStateRepository.save(reviewState);
    set((state) => ({
      reviewStates: {
        ...state.reviewStates,
        [reviewState.cardId]: reviewState,
      },
    }));
  },
  saveTheoryNote: async (note) => {
    const saved = await theoryNotesRepository.save(note);
    set((state) => ({
      theoryNotes: dedupeTheoryNotes([
        ...state.theoryNotes.filter((candidate) => candidate.id !== saved.id),
        saved,
      ]),
    }));
    return saved;
  },
  deleteTheoryNote: async (noteId) => {
    await theoryNotesRepository.delete(noteId);
    set((state) => ({
      theoryNotes: state.theoryNotes.filter((note) => note.id !== noteId),
    }));
  },
  saveRepertoireLine: async (line) => {
    await repertoireRepository.save(line);

    set((state) => {
      const repertoireLines = [...state.repertoireLines.filter((candidate) => candidate.id !== line.id), line];
      const graph = state.baseGraph ? buildWorkingGraph(state.baseGraph, repertoireLines) : state.graph;
      const opening = getLoadedOpening(state.openingDetailsById, state.selectedOpeningId);

      return {
        repertoireLines,
        graph,
        selectedNodeId:
          opening
            ? tryResolveNodeIdFromUciLine(graph, opening.uciMoves)
            : state.selectedNodeId,
      };
    });
  },
  toggleRepertoireLine: async (lineId) => {
    const line = get().repertoireLines.find((candidate) => candidate.id === lineId);
    if (!line) {
      return;
    }

    await get().saveRepertoireLine({ ...line, enabled: !line.enabled });
  },
  createRepertoireFromOpening: async (color) => {
    const selectedOpeningId = get().selectedOpeningId;
    if (!selectedOpeningId) {
      return;
    }

    await get().ensureOpeningLoaded(selectedOpeningId);
    const opening = getLoadedOpening(get().openingDetailsById, selectedOpeningId);
    if (!opening) {
      return;
    }

    await get().saveRepertoireLine({
      id: `repertoire-${Date.now()}`,
      color,
      rootOpeningId: opening.id,
      movePath: opening.uciMoves,
      tags: ['main-line'],
      priority: 1,
      enabled: true,
    });
  },
  importRepertoirePgn: async ({ pgn, color }) => {
    const rootOpeningId = get().selectedOpeningId;
    const imported = importPgnRepertoire(pgn, {
      color,
      rootOpeningId,
      id: `repertoire-${Date.now()}`,
    });

    await repertoireRepository.save(imported.repertoireLine);

    if (imported.theoryNotes.length > 0) {
      await theoryNotesRepository.saveMany(imported.theoryNotes);
    }

    set((state) => {
      const repertoireLines = [...state.repertoireLines, imported.repertoireLine];
      const graph = state.baseGraph ? buildWorkingGraph(state.baseGraph, repertoireLines) : state.graph;
      const theoryNotes = dedupeTheoryNotes([...state.theoryNotes, ...imported.theoryNotes]);

      return {
        repertoireLines,
        graph,
        theoryNotes,
      };
    });
  },
  ensureOpeningLoaded: async (openingId) => {
    const opening = get().openings.find((candidate) => candidate.id === openingId);
    if (!opening) {
      return;
    }

    const bucketKey = deriveBucketKey(opening.eco);

    if (get().loadedBuckets.includes(bucketKey)) {
      const loadedOpening = getLoadedOpening(get().openingDetailsById, openingId);
      if (get().selectedOpeningId === openingId && loadedOpening) {
        set((state) => ({
          selectedNodeId: tryResolveNodeIdFromUciLine(state.graph, loadedOpening.uciMoves),
          explorerPath: loadedOpening.uciMoves,
        }));
      }
      return;
    }

    if (get().loadingBuckets.includes(bucketKey)) {
      set({ selectedOpeningId: openingId });
      return;
    }

    set((state) => ({
      loadingBuckets: [...state.loadingBuckets, bucketKey],
    }));

    try {
      const [sliceGraph, openingSlice] = await Promise.all([
        openingRepository.loadGraphSlice(bucketKey),
        openingRepository.loadOpeningSlice(bucketKey),
      ]);

      set((state) => {
        const baseGraph = mergeOpeningGraphs(state.baseGraph, sliceGraph);
        const graph = buildWorkingGraph(baseGraph, state.repertoireLines);
        const selectedOpening = state.openings.find((candidate) => candidate.id === state.selectedOpeningId);
        const openingDetailsById = {
          ...state.openingDetailsById,
          ...Object.fromEntries(openingSlice.map((entry) => [entry.id, entry])),
        };
        const selectedOpeningDetail = getLoadedOpening(
          openingDetailsById,
          selectedOpening?.bucketKey === bucketKey ? selectedOpening.id : undefined,
        );

        return {
          baseGraph,
          graph,
          openingDetailsById,
          loadedBuckets: [...state.loadedBuckets, bucketKey],
          loadingBuckets: state.loadingBuckets.filter((candidate) => candidate !== bucketKey),
          selectedNodeId: selectedOpeningDetail
            ? tryResolveNodeIdFromUciLine(graph, selectedOpeningDetail.uciMoves)
            : state.selectedNodeId,
          explorerPath: selectedOpeningDetail ? selectedOpeningDetail.uciMoves : state.explorerPath,
        };
      });
    } catch (error) {
      set((state) => ({
        loadingBuckets: state.loadingBuckets.filter((candidate) => candidate !== bucketKey),
        error: error instanceof Error ? error.message : 'No se pudo cargar el slice de aperturas.',
      }));
    }
  },
}));
