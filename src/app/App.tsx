import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SectionCard } from '@/components/SectionCard';
import { RepertoireView } from '@/features/repertoire/RepertoireView';
import { SettingsView } from '@/features/settings/SettingsView';
import { TheoryView } from '@/features/theory/TheoryView';
import { TrainingView } from '@/features/training/TrainingView';
import {
  buildCourseVariationDisplays,
  buildOpeningSourceMetaMap,
  getOpeningDisplayFields,
  matchesCourseVariationQuery,
  normalizeOpeningText,
} from '@/lib/chess/openingDisplay';
import { buildCourseSummaries } from '@/lib/chess/courseOverview';
import { buildFamilyIndex, normalizeFamily } from '@/lib/chess/familyIndex';
import { applyUciLine, getNodeLabels, getOpeningNameForNode } from '@/lib/chess/openingGraph';
import { searchOpenings } from '@/lib/search/openingSearch';
import { createCourseTrainingLines } from '@/lib/training/cards';
import { buildTrainingMetrics } from '@/lib/training/metrics';
import { useAppStore } from '@/store/useAppStore';

const COURSE_CARD_LIMIT = 18;
const SEARCH_RESULT_LIMIT = 24;
const BROWSE_VARIATION_PAGE_SIZE = 12;
const FOCUS_VARIATION_PAGE_SIZE = 18;
type FocusRailPanel = 'detail' | 'repertoire' | 'theory' | 'settings';

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
    return 'Sin lineas jugables';
  }

  if (studyReadyCount === totalCount) {
    return `${studyReadyCount} lineas jugables`;
  }

  return `${studyReadyCount} lineas jugables de ${totalCount} nombradas`;
}

export function App() {
  const [query, setQuery] = useState('');
  const [variationQuery, setVariationQuery] = useState('');
  const [variationPage, setVariationPage] = useState(1);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [focusRailPanel, setFocusRailPanel] = useState<FocusRailPanel>('detail');
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
  const scopedLines = useMemo(
    () =>
      createCourseTrainingLines({
        graph,
        courseOpenings: activeCourseOpenings,
        repertoireLines,
      }),
    [activeCourseOpenings, graph, repertoireLines],
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
  const browseMetrics = useMemo(() => {
    if (activeCourseSummary && activeCourseOpenings.length > 0) {
      return [
        {
          label: 'Curso',
          value: activeCourse?.displayName ?? activeCourseSummary.displayName,
          hint: 'curso seleccionado',
        },
        {
          label: 'Jugables',
          value: effectiveCourseOpenings.length,
          hint: formatCourseCount(effectiveCourseOpenings.length, activeCourseOpenings.length),
        },
        {
          label: 'Profundidad',
          value:
            activeCourseSummary.studyReadyCount > 0
              ? `${activeCourseSummary.effectiveMinDepth}-${activeCourseSummary.effectiveMaxDepth}`
              : 'Sin lineas',
          hint: 'rango util del curso',
        },
        {
          label: 'Review',
          value: scopedMetrics.dueLines,
          hint: 'lineas vencidas del curso',
        },
      ];
    }

    return [
      {
        label: 'Catalogo',
        value: openings.length,
        hint: 'lineas nombradas',
      },
      {
        label: 'Familias',
        value: familyIndex.groups.length,
        hint: 'cursos potenciales',
      },
      {
        label: 'Curso listo',
        value: activeCourseSummary?.studyReadyCount ?? 0,
        hint: 'subvariantes con profundidad util',
      },
      {
        label: 'Review',
        value: scopedMetrics.dueLines,
        hint: 'lineas vencidas',
      },
    ];
  }, [
    activeCourse,
    activeCourseOpenings.length,
    activeCourseSummary,
    effectiveCourseOpenings.length,
    familyIndex.groups.length,
    openings.length,
    scopedMetrics.dueLines,
  ]);
  const selectedOpeningSummary =
    effectiveCourseOpenings.find((opening) => opening.id === selectedOpeningId) ??
    activeCourseOpenings.find((opening) => opening.id === selectedOpeningId) ??
    effectiveCourseOpenings[0] ??
    activeCourseOpenings[0] ??
    selectedOpening;
  const selectedOpeningDetail = selectedOpeningSummary
    ? openingDetailsById[selectedOpeningSummary.id]
    : undefined;
  const courseVariationDisplays = useMemo(
    () => buildCourseVariationDisplays(effectiveCourseOpenings),
    [effectiveCourseOpenings],
  );
  const selectedVariationDisplay =
    courseVariationDisplays.find((variation) =>
      selectedOpeningSummary ? variation.openingIds.includes(selectedOpeningSummary.id) : false,
    ) ?? courseVariationDisplays[0];
  const sourceMetaById = useMemo(
    () => buildOpeningSourceMetaMap(courseVariationDisplays),
    [courseVariationDisplays],
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
  const filteredVariations = useMemo(() => {
    if (!deferredVariationQuery.trim()) {
      return courseVariationDisplays;
    }

    return courseVariationDisplays.filter((variation) =>
      matchesCourseVariationQuery(variation, deferredVariationQuery),
    );
  }, [courseVariationDisplays, deferredVariationQuery]);
  const variationPageSize = isFocusMode ? FOCUS_VARIATION_PAGE_SIZE : BROWSE_VARIATION_PAGE_SIZE;
  const visibleVariations = useMemo(
    () => filteredVariations.slice(0, variationPage * variationPageSize),
    [filteredVariations, variationPage, variationPageSize],
  );
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
  const selectedOpeningDisplay = selectedOpeningSummary
    ? getOpeningDisplayFields(selectedOpeningSummary)
    : undefined;
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
  const trainingColorSummary =
    settings.trainingColor === 'white'
      ? 'Solo blancas'
      : settings.trainingColor === 'black'
        ? 'Solo negras'
        : 'Ambos lados';
  const focusToolbarStats = useMemo(
    () => [
      {
        label: 'Subvariantes',
        value: courseVariationDisplays.length,
        hint: 'rutas utiles del curso',
      },
      {
        label: 'Lineas',
        value: effectiveCourseOpenings.length,
        hint:
          effectiveCourseOpenings.length > 0
            ? `profundidad ${effectiveDepthRange.min}-${effectiveDepthRange.max}`
            : 'sin lineas jugables',
      },
      {
        label: 'Color',
        value: trainingColorSummary,
        hint: 'lado que practicas ahora',
      },
      {
        label: 'Review',
        value: scopedMetrics.dueLines,
        hint: 'repasos pendientes',
      },
    ],
    [
      courseVariationDisplays.length,
      effectiveCourseOpenings.length,
      effectiveDepthRange.max,
      effectiveDepthRange.min,
      scopedMetrics.dueLines,
      trainingColorSummary,
    ],
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
      setVariationPage(1);
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
    setVariationPage(1);
    selectCourse(nextCourseKey);
  }

  function handleSelectOpening(nextOpeningId: string) {
    closePicker();
    setVariationQuery('');
    setVariationPage(1);
    selectOpening(nextOpeningId);
  }

  const focusPanelTitle =
    focusRailPanel === 'detail'
      ? selectedVariationDisplay?.displayTitle ??
        selectedOpeningDisplay?.displayTitle ??
        selectedOpeningSummary?.canonicalName ??
        'Detalle'
      : focusRailPanel === 'repertoire'
        ? 'Repertorio local'
        : focusRailPanel === 'theory'
          ? 'Teoria por posicion'
          : 'Ajustes avanzados';
  const focusPanelEyebrow =
    focusRailPanel === 'detail'
      ? selectedVariationDisplay?.ecoLabel ??
        selectedOpeningDisplay?.ecoLabel ??
        selectedOpeningSummary?.eco ??
        'Detalle del curso'
      : focusRailPanel === 'repertoire'
        ? 'Lineas activas y seeds'
        : focusRailPanel === 'theory'
          ? 'Notas por posicion'
          : 'Control del curso';

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
              <p className="focus-toolbar__hint">
                El tablero queda en foco. Cambiar el color reinicia la ruta actual para no mezclar contextos.
              </p>
              <div className="focus-toolbar__stats" aria-label="Resumen del curso activo">
                {focusToolbarStats.map((stat) => (
                  <article key={stat.label} className="focus-toolbar__stat">
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                    <small>{stat.hint}</small>
                  </article>
                ))}
              </div>
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
                <span>Entrenas como</span>
                <select
                  value={settings.trainingColor}
                  onChange={(event) =>
                    void updateSettings({
                      trainingColor: event.target.value as typeof settings.trainingColor,
                    })
                  }
                >
                  <option value="both">Ambos lados</option>
                  <option value="white">Solo blancas</option>
                  <option value="black">Solo negras</option>
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
              <h1>Elige una apertura y entra a practicar</h1>
              <p className="hero__copy">
                Busca por nombre, ECO o primeras jugadas. En cuanto eliges un curso, el tablero toma prioridad y el
                resto de herramientas se mueve al lateral.
              </p>
            </div>

            <div className="hero-metrics" aria-label="Estado rapido del workspace">
              {browseMetrics.map((metric) => (
                <article key={metric.label} className="hero-metric">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.hint}</small>
                </article>
              ))}
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
                  key={`${resolvedCourseKey ?? 'course'}-${selectedOpeningSummary?.id ?? 'none'}-${settings.trainingColor}-${settings.minimumDepth}-${settings.maximumDepth}`}
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
                  title="Plan del curso"
                  eyebrow={`${filteredVariations.length} rutas | ${effectiveCourseOpenings.length} lineas | ${trainingColorSummary.toLowerCase()}`}
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
                    {visibleVariations.map((variation) => (
                      <button
                        key={variation.key}
                        type="button"
                        className={`variation-item ${
                          selectedVariationDisplay?.key === variation.key ? 'is-active' : ''
                        }`}
                        onClick={() => handleSelectOpening(variation.representativeId)}
                      >
                        <strong>{variation.displayTitle}</strong>
                        <span>{variation.ecoLabel} | {variation.displaySubtitle}</span>
                        <small>{variation.movePreviewSan}</small>
                        <small>
                          {variation.namedLineCount > 1
                            ? `${variation.namedLineCount} lineas equivalentes | `
                            : ''}
                          profundidad {variation.minDepth}-{variation.maxDepth}
                        </small>
                      </button>
                    ))}
                  </div>

                  {filteredVariations.length > visibleVariations.length ? (
                    <div className="variation-list__footer">
                      <p className="empty-state">
                        Mostrando {visibleVariations.length} de {filteredVariations.length} rutas. Cada tarjeta agrupa
                        lineas equivalentes del dataset para evitar duplicados visuales.
                      </p>
                      <div className="button-row button-row--compact">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setVariationPage((current) => current + 1)}
                        >
                          Ver mas
                        </button>
                        {variationPage > 1 ? (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setVariationPage(1)}
                          >
                            Ver menos
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </SectionCard>

                <SectionCard title={focusPanelTitle} eyebrow={focusPanelEyebrow}>
                  <div className="focus-panel-tabs" role="tablist" aria-label="Herramientas del curso">
                    {[
                      { id: 'detail', label: 'Detalle' },
                      { id: 'repertoire', label: 'Repertorio' },
                      { id: 'theory', label: 'Teoria' },
                      { id: 'settings', label: 'Ajustes' },
                    ].map((panel) => (
                      <button
                        key={panel.id}
                        type="button"
                        className={`focus-panel-tabs__button ${focusRailPanel === panel.id ? 'is-active' : ''}`}
                        onClick={() => setFocusRailPanel(panel.id as FocusRailPanel)}
                        role="tab"
                        aria-selected={focusRailPanel === panel.id}
                      >
                        {panel.label}
                      </button>
                    ))}
                  </div>

                  {focusRailPanel === 'detail' && selectedOpeningSummary ? (
                    <>
                      <div className="detail-meta">
                        <p><strong>Curso:</strong> {activeCourse?.displayName ?? selectedOpeningDisplay?.displayFamily ?? selectedOpeningSummary.family}</p>
                        <p><strong>Subvariacion:</strong> {selectedVariationDisplay?.displaySubtitle ?? selectedOpeningDisplay?.displaySubtitle ?? selectedOpeningSummary.subvariation}</p>
                        <p><strong>Preview:</strong> {normalizeOpeningText(selectedLineSan ?? selectedVariationDisplay?.movePreviewSan ?? selectedOpeningSummary.movePreviewSan)}</p>
                        <p><strong>Aliases:</strong> {selectedOpeningSummary.aliases.map((alias) => normalizeOpeningText(alias)).join(', ') || 'Sin aliases'}</p>
                        {selectedVariationDisplay && selectedVariationDisplay.namedLineCount > 1 ? (
                          <p>
                            <strong>Agrupa:</strong> {selectedVariationDisplay.namedLineCount} lineas equivalentes del dataset
                          </p>
                        ) : null}
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
                                  <strong>{normalizeOpeningText(opening.canonicalName)}</strong>
                                  <span>{normalizeOpeningText(opening.subvariation)}</span>
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
                    </>
                  ) : null}

                  {focusRailPanel === 'repertoire' ? (
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
                  ) : null}

                  {focusRailPanel === 'theory' ? (
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
                  ) : null}

                  {focusRailPanel === 'settings' ? (
                    <SettingsView
                      settings={settings}
                      onChange={(partial) => {
                        updateSettings(partial).catch((nextError) => console.error('Settings save failed', nextError));
                      }}
                    />
                  ) : null}
                </SectionCard>
              </aside>
            </div>
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
                    {searchResults.map((opening) => {
                      const display = getOpeningDisplayFields(opening);

                      return (
                      <button
                        key={opening.id}
                        type="button"
                        className={`opening-list__item ${selectedOpeningSummary?.id === opening.id ? 'is-active' : ''}`}
                        onClick={() => handleSelectOpening(opening.id)}
                      >
                        <strong>{display.displayTitle}</strong>
                        <span>{display.displayFamily}</span>
                        <code>{opening.eco}</code>
                      </button>
                      );
                    })}
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
                        <small>
                          {summary.ecoRange}
                          {summary.studyReadyCount > 0
                            ? ` | profundidad util ${summary.effectiveMinDepth}-${summary.effectiveMaxDepth}`
                            : ''}
                        </small>
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
                          {activeCourseSummary?.studyReadyCount
                            ? `${activeCourseSummary.effectiveMinDepth}-${activeCourseSummary.effectiveMaxDepth}`
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
                        <h3>{selectedVariationDisplay?.displayTitle ?? selectedOpeningDisplay?.displayTitle ?? selectedOpeningSummary.canonicalName}</h3>
                        <p><strong>Subvariacion:</strong> {selectedVariationDisplay?.displaySubtitle ?? selectedOpeningDisplay?.displaySubtitle ?? selectedOpeningSummary.subvariation}</p>
                        <p><strong>Preview:</strong> {normalizeOpeningText(selectedLineSan ?? selectedVariationDisplay?.movePreviewSan ?? selectedOpeningSummary.movePreviewSan)}</p>
                        <p><strong>Aliases:</strong> {selectedOpeningSummary.aliases.map((alias) => normalizeOpeningText(alias)).join(', ') || 'Sin aliases'}</p>
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
