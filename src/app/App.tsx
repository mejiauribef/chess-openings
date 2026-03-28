import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SectionCard } from '@/components/SectionCard';
import { RepertoireView } from '@/features/repertoire/RepertoireView';
import { SettingsView } from '@/features/settings/SettingsView';
import { TheoryView } from '@/features/theory/TheoryView';
import { TrainingView } from '@/features/training/TrainingView';
import { buildCourseSummaries } from '@/lib/chess/courseOverview';
import { buildFamilyIndex, normalizeFamily } from '@/lib/chess/familyIndex';
import { applyUciLine, getNodeLabels, getOpeningNameForNode } from '@/lib/chess/openingGraph';
import { searchOpenings } from '@/lib/search/openingSearch';
import { createTrainingLines } from '@/lib/training/cards';
import { buildTrainingMetrics } from '@/lib/training/metrics';
import { useAppStore } from '@/store/useAppStore';

const COURSE_CARD_LIMIT = 18;
const SEARCH_RESULT_LIMIT = 24;
const BROWSE_VARIATION_LIMIT = 18;
const FOCUS_VARIATION_LIMIT = 24;

function getDepthRange(depths: number[]): { min: number; max: number } {
  if (depths.length === 0) {
    return { min: 0, max: 0 };
  }

  return {
    min: Math.min(...depths),
    max: Math.max(...depths),
  };
}

function formatCourseCount(studyReadyCount: number, totalCount: number): string {
  if (totalCount <= 0) {
    return 'Sin subvariantes disponibles';
  }

  if (studyReadyCount === totalCount) {
    return `${studyReadyCount} subvariantes jugables`;
  }

  return `${studyReadyCount} jugables de ${totalCount} nombradas`;
}

export function App() {
  const [query, setQuery] = useState('');
  const [variationQuery, setVariationQuery] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const deferredQuery = useDeferredValue(query);
  const deferredVariationQuery = useDeferredValue(variationQuery);
  const {
    status,
    error,
    openings,
    openingDetailsById,
    graph,
    loadedBuckets,
    loadingBuckets,
    theoryNotes,
    repertoireLines,
    selectedOpeningId,
    selectedNodeId,
    settings,
    reviewStates,
    initialize,
    selectOpening,
    selectNode,
    updateSettings,
    saveReviewState,
    saveTheoryNote,
    deleteTheoryNote,
    activeCourseKey,
    selectCourse,
    saveRepertoireLine,
    toggleRepertoireLine,
    createRepertoireFromOpening,
    importRepertoirePgn,
  } = useAppStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (event.key === '/' && !isTypingTarget) {
        event.preventDefault();
        setIsPickerOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const isHydrating = status === 'loading' || status === 'idle';
  const selectedOpening = openings.find((opening) => opening.id === selectedOpeningId);
  const familyIndex = useMemo(() => buildFamilyIndex(openings), [openings]);
  const courseSummaries = useMemo(
    () => buildCourseSummaries(familyIndex, settings.minimumDepth),
    [familyIndex, settings.minimumDepth],
  );
  const resolvedCourseKey =
    activeCourseKey ?? (selectedOpening ? normalizeFamily(selectedOpening.family) : undefined);
  const activeCourse = useMemo(
    () => familyIndex.groups.find((group) => group.key === resolvedCourseKey),
    [familyIndex.groups, resolvedCourseKey],
  );
  const activeCourseOpenings = useMemo(
    () => (resolvedCourseKey ? familyIndex.openingsByFamily.get(resolvedCourseKey) ?? [] : []),
    [familyIndex.openingsByFamily, resolvedCourseKey],
  );
  const effectiveCourseOpenings = useMemo(
    () =>
      activeCourseOpenings.filter(
        (opening) =>
          opening.depth >= settings.minimumDepth &&
          opening.depth <= settings.maximumDepth,
      ),
    [activeCourseOpenings, settings.maximumDepth, settings.minimumDepth],
  );
  const isCourseActive = activeCourseOpenings.length > 0;
  const isPickerVisible = !isCourseActive || isPickerOpen;
  const isFocusMode = isCourseActive && !isPickerVisible;
  const courseOpeningIds = useMemo(
    () => new Set(activeCourseOpenings.map((opening) => opening.id)),
    [activeCourseOpenings],
  );
  const allLines = useMemo(() => createTrainingLines(graph, repertoireLines), [graph, repertoireLines]);
  const scopedLines = useMemo(
    () => allLines.filter((line) => courseOpeningIds.has(line.lineSourceId)),
    [allLines, courseOpeningIds],
  );
  const scopedMetrics = useMemo(
    () =>
      buildTrainingMetrics({
        lines: scopedLines,
        graph,
        reviewStates,
        theoryNotes,
      }),
    [graph, reviewStates, scopedLines, theoryNotes],
  );
  const activeCourseSummary = useMemo(
    () => courseSummaries.find((summary) => summary.key === resolvedCourseKey),
    [courseSummaries, resolvedCourseKey],
  );
  const selectedOpeningSummary =
    effectiveCourseOpenings.find((opening) => opening.id === selectedOpeningId) ??
    activeCourseOpenings.find((opening) => opening.id === selectedOpeningId) ??
    effectiveCourseOpenings[0] ??
    activeCourseOpenings[0] ??
    selectedOpening;
  const selectedOpeningDetail = selectedOpeningSummary
    ? openingDetailsById[selectedOpeningSummary.id]
    : undefined;
  const sourceMetaById = useMemo(
    () =>
      Object.fromEntries(
        effectiveCourseOpenings.map((opening) => [
          opening.id,
          {
            eco: opening.eco,
            subvariation: opening.subvariation,
            movePreviewSan: opening.movePreviewSan,
          },
        ]),
      ),
    [effectiveCourseOpenings],
  );
  const searchResults = useMemo(
    () => searchOpenings(openings, deferredQuery).slice(0, SEARCH_RESULT_LIMIT),
    [openings, deferredQuery],
  );
  const featuredCourses = useMemo(() => {
    if (!deferredQuery.trim()) {
      return courseSummaries.slice(0, COURSE_CARD_LIMIT);
    }

    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const matchingKeys = new Set(searchResults.map((opening) => normalizeFamily(opening.family)));

    return courseSummaries
      .filter(
        (summary) =>
          matchingKeys.has(summary.key) ||
          summary.displayName.toLowerCase().includes(normalizedQuery) ||
          summary.ecoRange.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, COURSE_CARD_LIMIT);
  }, [courseSummaries, deferredQuery, searchResults]);
  const visibleVariations = useMemo(() => {
    const source = effectiveCourseOpenings;

    if (!deferredVariationQuery.trim()) {
      return source.slice(0, isFocusMode ? FOCUS_VARIATION_LIMIT : BROWSE_VARIATION_LIMIT);
    }

    const normalizedQuery = deferredVariationQuery.trim().toLowerCase();
    return source
      .filter(
        (opening) =>
          opening.canonicalName.toLowerCase().includes(normalizedQuery) ||
          opening.eco.toLowerCase().includes(normalizedQuery) ||
          opening.subvariation.toLowerCase().includes(normalizedQuery) ||
          opening.aliases.some((alias) => alias.toLowerCase().includes(normalizedQuery)),
      )
      .slice(0, FOCUS_VARIATION_LIMIT);
  }, [deferredVariationQuery, effectiveCourseOpenings, isFocusMode]);
  const selectedNode = selectedNodeId ? graph.nodes[selectedNodeId] : undefined;
  const labels = useMemo(
    () =>
      selectedNodeId
        ? getNodeLabels(graph, selectedNodeId)
        : { canonicalNames: [], aliases: [] },
    [graph, selectedNodeId],
  );
  const relatedNotes = useMemo(
    () => (selectedNodeId ? theoryNotes.filter((note) => note.nodeId === selectedNodeId) : []),
    [selectedNodeId, theoryNotes],
  );
  const childBranches =
    selectedNode?.childEdges
      .map((edge) => ({
        edge,
        title: getOpeningNameForNode(graph, edge.toNodeId),
      }))
      .slice(0, 8) ?? [];
  const relatedTranspositions =
    selectedNode?.openingIds
      .filter((openingId) => openingId !== selectedOpeningSummary?.id)
      .map((openingId) => graph.openingsById[openingId])
      .filter(Boolean)
      .slice(0, 8) ?? [];
  const relatedRepertoires = useMemo(
    () =>
      selectedOpeningSummary
        ? repertoireLines.filter((line) => line.rootOpeningId === selectedOpeningSummary.id)
        : [],
    [repertoireLines, selectedOpeningSummary],
  );
  const selectedLineSan = useMemo(
    () => (selectedOpeningDetail ? applyUciLine(selectedOpeningDetail.uciMoves).sanMoves.join(' ') : undefined),
    [selectedOpeningDetail],
  );
  const isTrainingScopeLoading = useMemo(() => {
    if (activeCourseOpenings.length === 0) {
      return false;
    }

    const pendingBuckets = new Set(activeCourseOpenings.map((opening) => opening.bucketKey));
    return (
      scopedLines.length === 0 &&
      [...pendingBuckets].some(
        (bucketKey) => loadingBuckets.includes(bucketKey) || !loadedBuckets.includes(bucketKey),
      )
    );
  }, [activeCourseOpenings, loadedBuckets, loadingBuckets, scopedLines.length]);
  const effectiveDepthRange = useMemo(
    () => getDepthRange(effectiveCourseOpenings.map((opening) => opening.depth)),
    [effectiveCourseOpenings],
  );

  useEffect(() => {
    if (isHydrating || isTrainingScopeLoading || scopedLines.length > 0) {
      return;
    }

    const fallbackCourse = courseSummaries.find(
      (summary) => summary.studyReadyCount > 0 && summary.representativeOpeningId,
    );

    if (
      fallbackCourse?.representativeOpeningId &&
      fallbackCourse.representativeOpeningId !== selectedOpeningId
    ) {
      selectOpening(fallbackCourse.representativeOpeningId);
    }
  }, [
    courseSummaries,
    isHydrating,
    isTrainingScopeLoading,
    scopedLines.length,
    selectOpening,
    selectedOpeningId,
  ]);

  function handleQueryChange(nextQuery: string) {
    startTransition(() => {
      setQuery(nextQuery);
    });
  }

  function handleVariationQueryChange(nextQuery: string) {
    startTransition(() => {
      setVariationQuery(nextQuery);
    });
  }

  function openPicker() {
    setIsPickerOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function closePicker() {
    setIsPickerOpen(false);
  }

  function handleSelectCourse(nextCourseKey: string) {
    closePicker();
    setVariationQuery('');
    selectCourse(nextCourseKey);
  }

  function handleSelectOpening(nextOpeningId: string) {
    closePicker();
    setVariationQuery('');
    selectOpening(nextOpeningId);
  }

  if (status === 'error') {
    return (
      <main className="app-shell">
        <header className="hero">
          <div>
            <p className="hero__eyebrow">Local first chess opening trainer</p>
            <h1>Aprende aperturas como un curso real</h1>
            <p className="hero__copy">Error al iniciar: {error}</p>
          </div>
        </header>
      </main>
    );
  }

  return (
    <ErrorBoundary>
      <main className="app-shell app-shell--study">
        {isFocusMode ? (
          <section className="focus-toolbar" aria-label="Curso activo">
            <div className="focus-toolbar__summary">
              <p className="hero__eyebrow">Curso activo</p>
              <h1>{activeCourse?.displayName ?? selectedOpeningSummary?.family ?? 'Curso'}</h1>
              <p className="focus-toolbar__meta">
                {formatCourseCount(effectiveCourseOpenings.length, activeCourseOpenings.length)}
                {effectiveCourseOpenings.length > 0
                  ? ` | profundidad efectiva ${effectiveDepthRange.min}-${effectiveDepthRange.max}`
                  : ''}
                {` | ${scopedMetrics.dueLines} reviews pendientes`}
              </p>
            </div>

            <div className="focus-toolbar__actions">
              <label className="field field--compact">
                <span>Min</span>
                <input
                  type="number"
                  min={5}
                  max={16}
                  value={settings.minimumDepth}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value)) {
                      void updateSettings({ minimumDepth: Math.max(5, value) });
                    }
                  }}
                />
              </label>

              <label className="field field--compact">
                <span>Max</span>
                <input
                  type="number"
                  min={settings.minimumDepth}
                  max={32}
                  value={settings.maximumDepth}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value)) {
                      void updateSettings({ maximumDepth: Math.max(settings.minimumDepth, value) });
                    }
                  }}
                />
              </label>

              <label className="field field--compact">
                <span>Color</span>
                <select
                  value={settings.trainingColor}
                  onChange={(event) =>
                    void updateSettings({
                      trainingColor: event.target.value as typeof settings.trainingColor,
                    })
                  }
                >
                  <option value="both">Ambos</option>
                  <option value="white">Blancas</option>
                  <option value="black">Negras</option>
                </select>
              </label>

              <button type="button" className="secondary-button" onClick={openPicker}>
                Cambiar apertura
              </button>
            </div>
          </section>
        ) : (
          <header className="hero hero--study">
            <div>
              <p className="hero__eyebrow">Local first chess opening trainer</p>
              <h1>Elige una apertura y practica todas sus subvariantes utiles</h1>
              <p className="hero__copy">
                Flujo local-first inspirado por la experiencia de curso de{' '}
                <a href="https://www.chessreps.com/" target="_blank" rel="noreferrer">
                  ChessReps
                </a>
                . Una vez eliges el curso, el tablero toma prioridad y la navegacion se comprime.
              </p>
            </div>

            <div className="hero-metrics" aria-label="Estado rapido del workspace">
              <article className="hero-metric">
                <span>Catalogo</span>
                <strong>{openings.length}</strong>
                <small>lineas nombradas</small>
              </article>
              <article className="hero-metric">
                <span>Familias</span>
                <strong>{familyIndex.groups.length}</strong>
                <small>cursos potenciales</small>
              </article>
              <article className="hero-metric">
                <span>Curso listo</span>
                <strong>{activeCourseSummary?.studyReadyCount ?? 0}</strong>
                <small>subvariantes con profundidad util</small>
              </article>
              <article className="hero-metric">
                <span>Review</span>
                <strong>{scopedMetrics.dueLines}</strong>
                <small>lineas vencidas</small>
              </article>
            </div>
          </header>
        )}

        {isHydrating ? (
          <section className="section-card">
            <div className="section-card__body">
              <p className="empty-state">
                Cargando el catalogo optimizado y preparando el primer curso. La shell ya esta lista y los slices
                grandes se hidratan bajo demanda.
              </p>
            </div>
          </section>
        ) : isFocusMode ? (
          <>
            <div className="study-layout study-layout--focus">
              <section className="study-main">
                <TrainingView
                  key={`${resolvedCourseKey ?? 'course'}-${selectedOpeningSummary?.id ?? 'none'}`}
                  graph={graph}
                  allLines={scopedLines}
                  settings={settings}
                  reviewStates={reviewStates}
                  theoryNotes={theoryNotes}
                  repertoireLines={repertoireLines.filter((line) =>
                    line.rootOpeningId ? courseOpeningIds.has(line.rootOpeningId) : false,
                  )}
                  metrics={scopedMetrics}
                  onSaveReviewState={saveReviewState}
                  hasLoadedBuckets={loadedBuckets.length > 0}
                  isDeckLoading={isTrainingScopeLoading}
                  scopeLabel={activeCourse?.displayName ?? selectedOpeningSummary?.family}
                  onRelaxFilters={() =>
                    void updateSettings({
                      minimumDepth: 5,
                      maximumDepth: Math.max(settings.maximumDepth, 16),
                      trainingColor: 'both',
                    })
                  }
                  onOpenCatalog={openPicker}
                  onClearScope={openPicker}
                  focusedSourceId={selectedOpeningSummary?.id}
                  sourceMetaById={sourceMetaById}
                />
              </section>

              <aside className="study-rail study-rail--focus">
                <SectionCard
                  title="Subvariantes del curso"
                  eyebrow={`${visibleVariations.length} visibles de ${effectiveCourseOpenings.length} jugables`}
                >
                  <label className="field">
                    <span>Filtrar subvariacion</span>
                    <input
                      type="search"
                      value={variationQuery}
                      onChange={(event) => handleVariationQueryChange(event.target.value)}
                      placeholder="Najdorf, Classical, B90..."
                    />
                  </label>

                  <div className="variation-list variation-list--focus">
                    {visibleVariations.map((opening) => (
                      <button
                        key={opening.id}
                        type="button"
                        className={`variation-item ${selectedOpeningSummary?.id === opening.id ? 'is-active' : ''}`}
                        onClick={() => handleSelectOpening(opening.id)}
                      >
                        <strong>{opening.canonicalName}</strong>
                        <span>{opening.eco} | {opening.subvariation}</span>
                        <small>{opening.movePreviewSan}</small>
                      </button>
                    ))}
                  </div>

                  {effectiveCourseOpenings.length > visibleVariations.length ? (
                    <p className="empty-state">
                      La lista se recorta para mantener el layout rapido. Usa el filtro para saltar a una subvariante
                      concreta.
                    </p>
                  ) : null}
                </SectionCard>

                {selectedOpeningSummary ? (
                  <SectionCard title={selectedOpeningSummary.canonicalName} eyebrow={selectedOpeningSummary.eco}>
                    <div className="detail-meta">
                      <p><strong>Curso:</strong> {activeCourse?.displayName ?? selectedOpeningSummary.family}</p>
                      <p><strong>Subvariacion:</strong> {selectedOpeningSummary.subvariation}</p>
                      <p><strong>Preview:</strong> {selectedLineSan ?? selectedOpeningSummary.movePreviewSan}</p>
                      <p><strong>Aliases:</strong> {selectedOpeningSummary.aliases.join(', ') || 'Sin aliases'}</p>
                    </div>

                    {labels.canonicalNames.length > 0 || labels.aliases.length > 0 ? (
                      <div className="chip-row">
                        {labels.canonicalNames.map((label) => (
                          <span key={label} className="chip">{label}</span>
                        ))}
                        {labels.aliases.map((label) => (
                          <span key={label} className="chip chip--muted">{label}</span>
                        ))}
                      </div>
                    ) : null}

                    <div className="detail-grid detail-grid--single">
                      <article className="info-panel">
                        <h3>Ramas disponibles</h3>
                        {childBranches.length > 0 ? (
                          <div className="stack-list">
                            {childBranches.map(({ edge, title }) => (
                              <div key={`${edge.fromNodeId}-${edge.uci}`} className="list-row">
                                <strong>{edge.san}</strong>
                                <span>{title}</span>
                                <code>{edge.uci}</code>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="empty-state">
                            {loadingBuckets.includes(selectedOpeningSummary.bucketKey)
                              ? 'Cargando ramas de esta posicion...'
                              : 'Esta linea aun no tiene ramas hijas cargadas en memoria.'}
                          </p>
                        )}
                      </article>

                      <article className="info-panel">
                        <h3>Transposiciones relacionadas</h3>
                        {relatedTranspositions.length > 0 ? (
                          <div className="stack-list">
                            {relatedTranspositions.map((opening) => (
                              <div key={opening.id} className="list-row">
                                <strong>{opening.canonicalName}</strong>
                                <span>{opening.subvariation}</span>
                                <code>{opening.eco}</code>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="empty-state">Sin otras clasificaciones visibles en esta posicion.</p>
                        )}
                      </article>

                      <article className="info-panel">
                        <h3>Teoria y repertorio</h3>
                        <p><strong>Notas teoricas:</strong> {relatedNotes.length}</p>
                        <p><strong>Repertorios ligados:</strong> {relatedRepertoires.length}</p>
                      </article>
                    </div>
                  </SectionCard>
                ) : null}
              </aside>
            </div>

            <section className="workspace-drawers" aria-label="Herramientas avanzadas">
              <details className="workspace-drawer">
                <summary>Repertorio local</summary>
                <div className="workspace-drawer__body">
                  <RepertoireView
                    openings={effectiveCourseOpenings}
                    repertoireLines={repertoireLines.filter((line) =>
                      line.rootOpeningId ? courseOpeningIds.has(line.rootOpeningId) : false,
                    )}
                    selectedOpeningId={selectedOpeningSummary?.id}
                    onCreateFromOpening={createRepertoireFromOpening}
                    onImportPgn={importRepertoirePgn}
                    onToggleEnabled={toggleRepertoireLine}
                    onSaveLine={saveRepertoireLine}
                  />
                </div>
              </details>

              <details className="workspace-drawer">
                <summary>Teoria por posicion</summary>
                <div className="workspace-drawer__body">
                  <TheoryView
                    graph={graph}
                    selectedNodeId={selectedNodeId}
                    theoryNotes={theoryNotes}
                    onSelectNode={selectNode}
                    onSaveNote={saveTheoryNote}
                    onDeleteNote={deleteTheoryNote}
                    onOpenCatalog={openPicker}
                    courseOpeningIds={courseOpeningIds}
                  />
                </div>
              </details>

              <details className="workspace-drawer">
                <summary>Ajustes avanzados</summary>
                <div className="workspace-drawer__body">
                  <SettingsView
                    settings={settings}
                    onChange={(partial) => {
                      updateSettings(partial).catch((nextError) => console.error('Settings save failed', nextError));
                    }}
                  />
                </div>
              </details>
            </section>
          </>
        ) : (
          <div className="study-layout study-layout--browse">
            <aside className="study-sidebar">
              <SectionCard title="Abrir una apertura" eyebrow="Busca por nombre, ECO, SAN o UCI">
                <label className="field">
                  <span>Buscar</span>
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={query}
                    onChange={(event) => handleQueryChange(event.target.value)}
                    placeholder="Ej: Sicilian, B90, Najdorf, e2e4"
                  />
                </label>

                {deferredQuery.trim() ? (
                  <div className="opening-list opening-list--compact">
                    {searchResults.map((opening) => (
                      <button
                        key={opening.id}
                        type="button"
                        className={`opening-list__item ${selectedOpeningSummary?.id === opening.id ? 'is-active' : ''}`}
                        onClick={() => handleSelectOpening(opening.id)}
                      >
                        <strong>{opening.canonicalName}</strong>
                        <span>{opening.family}</span>
                        <code>{opening.eco}</code>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="course-card-grid">
                    {featuredCourses.map((summary) => (
                      <button
                        key={summary.key}
                        type="button"
                        className={`course-card ${resolvedCourseKey === summary.key ? 'is-active' : ''}`}
                        onClick={() => handleSelectCourse(summary.key)}
                      >
                        <strong>{summary.displayName}</strong>
                        <span>{formatCourseCount(summary.studyReadyCount, summary.openingCount)}</span>
                        <small>{summary.ecoRange}</small>
                      </button>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Filtros de estudio" eyebrow="Se aplican al curso activo">
                <div className="settings-grid settings-grid--compact">
                  <label className="field">
                    <span>Profundidad minima</span>
                    <input
                      type="number"
                      min={5}
                      max={16}
                      value={settings.minimumDepth}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) {
                          void updateSettings({ minimumDepth: Math.max(5, value) });
                        }
                      }}
                    />
                    <small className="field__hint">No se mostraran lineas menores a 5 en el curso activo.</small>
                  </label>

                  <label className="field">
                    <span>Profundidad maxima</span>
                    <input
                      type="number"
                      min={settings.minimumDepth}
                      max={32}
                      value={settings.maximumDepth}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) {
                          void updateSettings({ maximumDepth: Math.max(settings.minimumDepth, value) });
                        }
                      }}
                    />
                  </label>

                  <label className="field">
                    <span>Color</span>
                    <select
                      value={settings.trainingColor}
                      onChange={(event) =>
                        void updateSettings({
                          trainingColor: event.target.value as typeof settings.trainingColor,
                        })
                      }
                    >
                      <option value="both">Ambos</option>
                      <option value="white">Solo blancas</option>
                      <option value="black">Solo negras</option>
                    </select>
                  </label>

                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.hintsEnabled}
                      onChange={(event) => void updateSettings({ hintsEnabled: event.target.checked })}
                    />
                    <span>Hints en modo Learn</span>
                  </label>
                </div>
              </SectionCard>
            </aside>

            <section className="study-main">
              <SectionCard
                title={activeCourse?.displayName ?? 'Selecciona un curso'}
                eyebrow={activeCourseSummary?.ecoRange ?? 'Cursos listos para practicar'}
              >
                <div className="study-course-summary">
                  <p className="empty-state">
                    El curso se arma por familia, filtrando por profundidad util. Al elegirlo, la interfaz entra en
                    modo focus y el tablero sube al frente.
                  </p>

                  {activeCourse ? (
                    <div className="study-course-pills">
                      <span className="training-pill">
                        <strong>Jugables</strong>
                        <span>{formatCourseCount(effectiveCourseOpenings.length, activeCourseOpenings.length)}</span>
                      </span>
                      <span className="training-pill">
                        <strong>Rango</strong>
                        <span>
                          {effectiveCourseOpenings.length > 0
                            ? `${effectiveDepthRange.min}-${effectiveDepthRange.max}`
                            : 'Sin lineas'}
                        </span>
                      </span>
                      <span className="training-pill">
                        <strong>Preview</strong>
                        <span>{selectedOpeningSummary?.eco ?? 'Sin apertura seleccionada'}</span>
                      </span>
                      <span className="training-pill">
                        <strong>Review</strong>
                        <span>{scopedMetrics.dueLines} pendientes</span>
                      </span>
                    </div>
                  ) : null}

                  {selectedOpeningSummary ? (
                    <div className="detail-grid detail-grid--single">
                      <article className="info-panel">
                        <h3>{selectedOpeningSummary.canonicalName}</h3>
                        <p><strong>Subvariacion:</strong> {selectedOpeningSummary.subvariation}</p>
                        <p><strong>Preview:</strong> {selectedLineSan ?? selectedOpeningSummary.movePreviewSan}</p>
                        <p><strong>Aliases:</strong> {selectedOpeningSummary.aliases.join(', ') || 'Sin aliases'}</p>
                      </article>
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            </section>
          </div>
        )}
      </main>
    </ErrorBoundary>
  );
}
