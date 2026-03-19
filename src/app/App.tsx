import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SectionCard } from '@/components/SectionCard';
import { buildCourseSummaries } from '@/lib/chess/courseOverview';
import { buildFamilyIndex, normalizeFamily } from '@/lib/chess/familyIndex';
import { applyUciLine, getNodeLabels, getOpeningNameForNode } from '@/lib/chess/openingGraph';
import { searchOpenings } from '@/lib/search/openingSearch';
import { createTrainingLines } from '@/lib/training/cards';
import { buildTrainingMetrics } from '@/lib/training/metrics';
import { RepertoireView } from '@/features/repertoire/RepertoireView';
import { SettingsView } from '@/features/settings/SettingsView';
import { TheoryView } from '@/features/theory/TheoryView';
import { TrainingView } from '@/features/training/TrainingView';
import { useAppStore } from '@/store/useAppStore';

const COURSE_CARD_LIMIT = 18;
const SEARCH_RESULT_LIMIT = 24;
const VARIATION_RESULT_LIMIT = 60;

export function App() {
  const [query, setQuery] = useState('');
  const [variationQuery, setVariationQuery] = useState('');
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
        searchInputRef.current?.focus();
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
    activeCourseOpenings.find((opening) => opening.id === selectedOpeningId) ??
    selectedOpening ??
    activeCourseOpenings[0];
  const selectedOpeningDetail = selectedOpeningSummary
    ? openingDetailsById[selectedOpeningSummary.id]
    : undefined;
  const sourceMetaById = useMemo(
    () =>
      Object.fromEntries(
        activeCourseOpenings.map((opening) => [
          opening.id,
          {
            eco: opening.eco,
            subvariation: opening.subvariation,
          },
        ]),
      ),
    [activeCourseOpenings],
  );
  const searchResults = useMemo(
    () => searchOpenings(openings, deferredQuery).slice(0, SEARCH_RESULT_LIMIT),
    [openings, deferredQuery],
  );
  const featuredCourses = useMemo(() => {
    if (!deferredQuery.trim()) {
      return courseSummaries.slice(0, COURSE_CARD_LIMIT);
    }

    const matchingKeys = new Set(searchResults.map((opening) => normalizeFamily(opening.family)));
    return courseSummaries
      .filter(
        (summary) =>
          matchingKeys.has(summary.key) ||
          summary.displayName.toLowerCase().includes(deferredQuery.trim().toLowerCase()) ||
          summary.ecoRange.toLowerCase().includes(deferredQuery.trim().toLowerCase()),
      )
      .slice(0, COURSE_CARD_LIMIT);
  }, [courseSummaries, deferredQuery, searchResults]);
  const visibleVariations = useMemo(() => {
    if (!deferredVariationQuery.trim()) {
      return activeCourseOpenings.slice(0, VARIATION_RESULT_LIMIT);
    }

    const normalizedQuery = deferredVariationQuery.trim().toLowerCase();
    return activeCourseOpenings
      .filter(
        (opening) =>
          opening.canonicalName.toLowerCase().includes(normalizedQuery) ||
          opening.eco.toLowerCase().includes(normalizedQuery) ||
          opening.subvariation.toLowerCase().includes(normalizedQuery) ||
          opening.aliases.some((alias) => alias.toLowerCase().includes(normalizedQuery)),
      )
      .slice(0, VARIATION_RESULT_LIMIT);
  }, [activeCourseOpenings, deferredVariationQuery]);
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

  function focusSearch() {
    searchInputRef.current?.focus();
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
        <header className="hero hero--study">
          <div>
            <p className="hero__eyebrow">Local first chess opening trainer</p>
            <h1>Elige una apertura y practica todas sus subvariantes utiles</h1>
            <p className="hero__copy">
              Inspirado en el flujo de curso de{' '}
              <a href="https://www.chessreps.com/" target="_blank" rel="noreferrer">
                ChessReps
              </a>
              , pero aterrizado a un modelo local-first y a una sola pantalla principal. Priorizamos ramas de
              5+ jugadas para evitar lineas triviales.
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
              <span>Curso</span>
              <strong>{activeCourseSummary?.studyReadyCount ?? 0}</strong>
              <small>subvariantes de {settings.minimumDepth}+ jugadas</small>
            </article>
            <article className="hero-metric">
              <span>Review</span>
              <strong>{scopedMetrics.dueLines}</strong>
              <small>lineas vencidas</small>
            </article>
          </div>
        </header>

        {isHydrating ? (
          <section className="section-card">
            <div className="section-card__body">
              <p className="empty-state">
                Cargando el catalogo optimizado y preparando el primer curso. La shell ya esta lista y los slices
                grandes se hidratan bajo demanda.
              </p>
            </div>
          </section>
        ) : (
          <>
            <div className="study-layout">
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
                        onClick={() => selectOpening(opening.id)}
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
                        onClick={() => selectCourse(summary.key)}
                      >
                        <strong>{summary.displayName}</strong>
                        <span>{summary.studyReadyCount}/{summary.openingCount} subvariantes utiles</span>
                        <small>{summary.ecoRange} | profundidad {summary.minDepth}-{summary.maxDepth}</small>
                      </button>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Filtros de estudio" eyebrow="Todo desde una sola pantalla">
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
                    <small className="field__hint">El curso evita lineas menores a 5 jugadas completas.</small>
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

                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.includeSidelines}
                      onChange={(event) => void updateSettings({ includeSidelines: event.target.checked })}
                    />
                    <span>Incluir sidelines</span>
                  </label>
                </div>
              </SectionCard>
            </aside>

            <section className="study-main">
              <SectionCard
                title={activeCourse?.displayName ?? 'Elige una apertura'}
                eyebrow={activeCourseSummary?.ecoRange ?? 'Curso principal'}
              >
                <div className="study-course-summary">
                  <p className="empty-state">
                    El dataset actual es amplio para lineas nombradas y permite practicar por familia. No modela
                    "todas las jugadas posibles", sino un curso util: lineas nombradas, ramas cargadas y
                    transposiciones detectadas por posicion.
                  </p>
                  <div className="study-course-pills">
                    <span className="training-pill">
                      <strong>Subvariantes</strong>
                      <span>{activeCourseSummary?.openingCount ?? 0}</span>
                    </span>
                    <span className="training-pill">
                      <strong>Jugables</strong>
                      <span>{activeCourseSummary?.studyReadyCount ?? 0}</span>
                    </span>
                    <span className="training-pill">
                      <strong>Profundidad</strong>
                      <span>{activeCourseSummary ? `${activeCourseSummary.minDepth}-${activeCourseSummary.maxDepth}` : '-'}</span>
                    </span>
                    <span className="training-pill">
                      <strong>Buckets</strong>
                      <span>{activeCourseSummary?.bucketCount ?? 0}</span>
                    </span>
                  </div>

                  <div className="button-row">
                    <button type="button" className="secondary-button" onClick={focusSearch}>
                      Buscar otra apertura
                    </button>
                  </div>
                </div>
              </SectionCard>

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
                onOpenCatalog={focusSearch}
                onClearScope={focusSearch}
                focusedSourceId={selectedOpeningSummary?.id}
                sourceMetaById={sourceMetaById}
              />
            </section>

            <aside className="study-rail">
              <SectionCard title="Subvariantes del curso" eyebrow={`${activeCourseOpenings.length} nombradas`}>
                <label className="field">
                  <span>Filtrar subvariacion</span>
                  <input
                    type="search"
                    value={variationQuery}
                    onChange={(event) => handleVariationQueryChange(event.target.value)}
                    placeholder="Najdorf, Classical, B90..."
                  />
                </label>

                <div className="variation-list">
                  {visibleVariations.map((opening) => (
                    <button
                      key={opening.id}
                      type="button"
                      className={`variation-item ${selectedOpeningSummary?.id === opening.id ? 'is-active' : ''}`}
                      onClick={() => selectOpening(opening.id)}
                    >
                      <strong>{opening.canonicalName}</strong>
                      <span>{opening.subvariation}</span>
                      <small>{opening.eco} | profundidad {opening.depth}</small>
                    </button>
                  ))}
                </div>
              </SectionCard>

              {selectedOpeningSummary ? (
                <SectionCard title={selectedOpeningSummary.canonicalName} eyebrow={selectedOpeningSummary.eco}>
                  <div className="detail-meta">
                    <p><strong>Familia:</strong> {selectedOpeningSummary.family}</p>
                    <p><strong>Subvariacion:</strong> {selectedOpeningSummary.subvariation}</p>
                    <p><strong>Aliases:</strong> {selectedOpeningSummary.aliases.join(', ') || 'Sin aliases'}</p>
                    <p><strong>Preview:</strong> {selectedLineSan ?? selectedOpeningSummary.movePreviewSan}</p>
                    <p><strong>Repertorios ligados:</strong> {relatedRepertoires.length}</p>
                    <p><strong>Notas teoricas:</strong> {relatedNotes.length}</p>
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
                      <h3>Teoria activa</h3>
                      {relatedNotes.length > 0 ? (
                        <div className="stack-list">
                          {relatedNotes.slice(0, 4).map((note) => (
                            <div key={`${note.nodeId}-${note.title}`} className="list-row">
                              <strong>{note.title}</strong>
                              <span>{note.summary || 'Nota sin resumen'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="empty-state">Todavia no hay notas teoricas enlazadas a esta posicion.</p>
                      )}
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
                    openings={activeCourseOpenings}
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
                    onOpenCatalog={focusSearch}
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
        )}
      </main>
    </ErrorBoundary>
  );
}
