import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { WorkspaceOverview } from '@/app/WorkspaceOverview';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CourseSelector } from '@/components/CourseSelector';
import { CatalogView } from '@/features/openings-catalog/CatalogView';
import { ExplorerView } from '@/features/opening-explorer/ExplorerView';
import { RepertoireView } from '@/features/repertoire/RepertoireView';
import { SettingsView } from '@/features/settings/SettingsView';
import { TheoryView } from '@/features/theory/TheoryView';
import { TrainingView } from '@/features/training/TrainingView';
import { buildFamilyIndex, normalizeFamily } from '@/lib/chess/familyIndex';
import { createTrainingLines } from '@/lib/training/cards';
import { buildTrainingMetrics } from '@/lib/training/metrics';
import { useAppStore } from '@/store/useAppStore';

const TABS = [
  { id: 'catalog', label: 'Catalogo' },
  { id: 'explorer', label: 'Explorador' },
  { id: 'training', label: 'Entrenamiento' },
  { id: 'repertoire', label: 'Repertorios' },
  { id: 'theory', label: 'Teoria' },
  { id: 'settings', label: 'Ajustes' },
] as const;

export function App() {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const {
    status,
    error,
    activeTab,
    openings,
    openingDetailsById,
    graph,
    loadedBuckets,
    loadingBuckets,
    theoryNotes,
    repertoireLines,
    selectedOpeningId,
    selectedNodeId,
    explorerPath,
    settings,
    reviewStates,
    initialize,
    setActiveTab,
    selectOpening,
    selectNode,
    selectExplorerMove,
    resetExplorerToOpening,
    updateSettings,
    saveReviewState,
    saveTheoryNote,
    deleteTheoryNote,
    activeCourseKey,
    saveRepertoireLine,
    toggleRepertoireLine,
    createRepertoireFromOpening,
    importRepertoirePgn,
    selectCourse,
    clearCourse,
  } = useAppStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const selectedOpening = openings.find((opening) => opening.id === selectedOpeningId);
  const isSelectedOpeningLoading =
    !!selectedOpening && loadingBuckets.includes(selectedOpening.bucketKey);
  const isHydrating = status === 'loading' || status === 'idle';
  const allLines = useMemo(() => createTrainingLines(graph, repertoireLines), [graph, repertoireLines]);
  const trainingMetrics = useMemo(
    () =>
      buildTrainingMetrics({
        lines: allLines,
        graph,
        reviewStates,
        theoryNotes,
      }),
    [allLines, graph, reviewStates, theoryNotes],
  );
  const familyIndex = useMemo(() => buildFamilyIndex(openings), [openings]);
  const courseOpeningIds = useMemo(() => {
    if (!activeCourseKey) return undefined;
    const entries = familyIndex.openingsByFamily.get(activeCourseKey);
    return entries ? new Set(entries.map((e) => e.id)) : undefined;
  }, [activeCourseKey, familyIndex]);
  const scopedLines = useMemo(
    () => (courseOpeningIds ? allLines.filter((l) => courseOpeningIds.has(l.lineSourceId)) : allLines),
    [allLines, courseOpeningIds],
  );
  const scopedMetrics = useMemo(
    () =>
      courseOpeningIds
        ? buildTrainingMetrics({ lines: scopedLines, graph, reviewStates, theoryNotes })
        : trainingMetrics,
    [courseOpeningIds, scopedLines, graph, reviewStates, theoryNotes, trainingMetrics],
  );
  const scopedRepertoireLines = useMemo(
    () =>
      courseOpeningIds
        ? repertoireLines.filter((l) => l.rootOpeningId && courseOpeningIds.has(l.rootOpeningId))
        : repertoireLines,
    [repertoireLines, courseOpeningIds],
  );
  const scopedOpenings = useMemo(
    () => (courseOpeningIds ? openings.filter((o) => courseOpeningIds.has(o.id)) : openings),
    [openings, courseOpeningIds],
  );
  const activeCourse = useMemo(
    () => familyIndex.groups.find((g) => g.key === activeCourseKey),
    [familyIndex.groups, activeCourseKey],
  );

  const handleQueryChange = (nextQuery: string) => {
    startTransition(() => {
      setQuery(nextQuery);
    });
  };

  useEffect(() => {
    const tabsByShortcut = ['catalog', 'explorer', 'training', 'repertoire', 'theory', 'settings'] as const;

    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;

      if (event.key === '/' && !isTypingTarget) {
        event.preventDefault();
        setActiveTab('catalog');
        searchInputRef.current?.focus();
        return;
      }

      if (event.altKey && /^[1-6]$/.test(event.key)) {
        event.preventDefault();
        const nextTab = tabsByShortcut[Number(event.key) - 1];
        if (nextTab) {
          setActiveTab(nextTab);
          if (nextTab === 'catalog') {
            window.setTimeout(() => searchInputRef.current?.focus(), 0);
          }
        }
      }
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [setActiveTab]);

  if (status === 'error') {
    return (
      <main className="app-shell">
        <header className="hero">
          <div>
            <p className="hero__eyebrow">Local first chess opening trainer</p>
            <h1>Aprende aperturas por posicion, no solo por secuencia</h1>
            <p className="hero__copy">Error al iniciar: {error}</p>
          </div>
        </header>
      </main>
    );
  }

  return (
    <ErrorBoundary>
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="hero__eyebrow">Local first chess opening trainer</p>
          <h1>Aprende aperturas por posicion, no solo por secuencia</h1>
          <p className="hero__copy">
            El grafo colapsa transposiciones, mantiene aliases y deja la app usable offline sin backend.
          </p>
        </div>
        <nav className="tab-bar" aria-label="Navegacion principal">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-bar__button ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {!isHydrating ? (
        <WorkspaceOverview
          loadedOpenings={openings.length}
          enabledRepertoireLines={repertoireLines.filter((line) => line.enabled).length}
          theoryNotes={theoryNotes.length}
          dueCards={scopedMetrics.dueLines}
          activeCourse={activeCourse}
          courseLineCount={courseOpeningIds ? scopedLines.length : undefined}
        />
      ) : null}

      {!isHydrating ? (
        <CourseSelector
          familyIndex={familyIndex}
          activeCourseKey={activeCourseKey}
          onSelectCourse={selectCourse}
          onClearCourse={clearCourse}
        />
      ) : null}

      {isHydrating ? (
        <section className="section-card">
          <div className="section-card__body">
            <p className="empty-state">
              Cargando catalogo optimizado de aperturas. La shell ya esta lista y los slices se cargan bajo demanda.
            </p>
          </div>
        </section>
      ) : null}

      {!isHydrating && activeTab === 'catalog' ? (
        <CatalogView
          openings={openings}
          openingDetailsById={openingDetailsById}
          graph={graph}
          theoryNotes={theoryNotes}
          repertoireLines={repertoireLines}
          selectedOpeningId={selectedOpeningId}
          selectedNodeId={selectedNodeId}
          isSelectedOpeningLoading={isSelectedOpeningLoading}
          onSelectOpening={selectOpening}
          query={query}
          onQueryChange={handleQueryChange}
          searchInputRef={searchInputRef}
          onSelectCourse={selectCourse}
          courseOpeningIds={courseOpeningIds}
        />
      ) : null}

      {!isHydrating && activeTab === 'explorer' ? (
        <ExplorerView
          graph={graph}
          selectedNodeId={selectedNodeId}
          explorerPath={explorerPath}
          onPlayMove={selectExplorerMove}
          onReset={resetExplorerToOpening}
          onOpenCatalog={() => setActiveTab('catalog')}
          onLoadSelectedOpening={selectedOpeningId ? () => selectOpening(selectedOpeningId) : undefined}
          courseOpeningIds={courseOpeningIds}
        />
      ) : null}

      {!isHydrating && activeTab === 'training' ? (
        <TrainingView
          graph={graph}
          allLines={scopedLines}
          settings={settings}
          reviewStates={reviewStates}
          theoryNotes={theoryNotes}
          repertoireLines={scopedRepertoireLines}
          metrics={scopedMetrics}
          onSaveReviewState={saveReviewState}
          hasLoadedBuckets={loadedBuckets.length > 0}
        />
      ) : null}

      {!isHydrating && activeTab === 'repertoire' ? (
        <RepertoireView
          openings={scopedOpenings}
          repertoireLines={scopedRepertoireLines}
          selectedOpeningId={selectedOpeningId}
          onCreateFromOpening={createRepertoireFromOpening}
          onImportPgn={importRepertoirePgn}
          onToggleEnabled={toggleRepertoireLine}
          onSaveLine={saveRepertoireLine}
        />
      ) : null}
      {!isHydrating && activeTab === 'theory' ? (
        <TheoryView
          graph={graph}
          selectedNodeId={selectedNodeId}
          theoryNotes={theoryNotes}
          onSelectNode={selectNode}
          onSaveNote={saveTheoryNote}
          onDeleteNote={deleteTheoryNote}
          onOpenCatalog={() => setActiveTab('catalog')}
          courseOpeningIds={courseOpeningIds}
        />
      ) : null}
      {!isHydrating && activeTab === 'settings' ? (
        <SettingsView settings={settings} onChange={(partial) => { updateSettings(partial).catch((err) => console.error('Settings save failed', err)); }} />
      ) : null}
    </main>
    </ErrorBoundary>
  );
}
