import { useMemo, useState } from 'react';
import type { TheoryNote } from '@/domain/opening';
import type { OpeningGraph } from '@/domain/position';
import type { RepertoireLine } from '@/domain/repertoire';
import type {
  ReviewState,
  TrainingMetrics,
  TrainingMode,
  TrainingSettings,
} from '@/domain/training';
import type { OpeningSourceMeta } from '@/lib/chess/openingDisplay';
import { applyUciLine } from '@/lib/chess/openingGraph';
import { buildTrainingSourceSummaries, selectTrainingLines } from '@/lib/training/cards';
import { rescheduleReview } from '@/lib/training/scheduler';
import { EmptyStatePanel } from '@/components/EmptyStatePanel';
import { PlayableBoard } from '@/components/PlayableBoard';
import { SectionCard } from '@/components/SectionCard';

interface TrainingViewProps {
  graph: OpeningGraph;
  allLines: Array<{
    id: string;
    lineSourceId: string;
    color: 'white' | 'black';
    movePath: string[];
    openingName: string;
    tags: string[];
    difficulty: number;
    terminalNodeId: string;
  }>;
  settings: TrainingSettings;
  reviewStates: Record<string, ReviewState>;
  theoryNotes: TheoryNote[];
  repertoireLines: RepertoireLine[];
  metrics: TrainingMetrics;
  onSaveReviewState: (reviewState: ReviewState) => Promise<void>;
  hasLoadedBuckets: boolean;
  isDeckLoading?: boolean;
  scopeLabel?: string;
  onRelaxFilters?: () => void;
  onOpenCatalog?: () => void;
  onClearScope?: () => void;
  focusedSourceId?: string;
  sourceMetaById?: Record<string, OpeningSourceMeta>;
}

const TRAINING_MODES: Array<{ id: TrainingMode; label: string; description: string }> = [
  { id: 'learn', label: 'Learn', description: 'Hints y teoria breve.' },
  { id: 'practice', label: 'Practice', description: 'Memoria activa con reintento.' },
  { id: 'drill', label: 'Drill', description: 'Error corta la linea.' },
];

const MODE_UNLOCKS: Record<TrainingMode, { minimumDiscoveredLines: number; lockedLabel: string }> = {
  learn: {
    minimumDiscoveredLines: 0,
    lockedLabel: '',
  },
  practice: {
    minimumDiscoveredLines: 1,
    lockedLabel: 'Descubre 1 linea para desbloquearlo.',
  },
  drill: {
    minimumDiscoveredLines: 3,
    lockedLabel: 'Descubre 3 lineas para desbloquearlo.',
  },
};

function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatTrainingColorLabel(value: TrainingSettings['trainingColor']): string {
  if (value === 'white') {
    return 'Solo blancas';
  }

  if (value === 'black') {
    return 'Solo negras';
  }

  return 'Ambos lados';
}

function formatPlayerColorLabel(value: 'white' | 'black'): string {
  return value === 'white' ? 'Blancas' : 'Negras';
}

function getTheoryHighlights(note: TheoryNote | undefined): Array<{ label: string; value: string }> {
  if (!note) {
    return [];
  }

  const highlights: Array<{ label: string; value: string }> = [];

  if (note.summary.trim()) {
    highlights.push({ label: 'Idea clave', value: note.summary });
  }

  note.plans.slice(0, 2).forEach((plan) => {
    highlights.push({ label: 'Plan', value: plan });
  });
  note.traps.slice(0, 1).forEach((trap) => {
    highlights.push({ label: 'Trampa', value: trap });
  });
  note.motifs.slice(0, 1).forEach((motif) => {
    highlights.push({ label: 'Motivo', value: motif });
  });

  return highlights.slice(0, 4);
}

export function TrainingView({
  graph,
  allLines,
  settings,
  reviewStates,
  theoryNotes,
  repertoireLines,
  metrics,
  onSaveReviewState,
  hasLoadedBuckets,
  isDeckLoading = false,
  scopeLabel,
  onRelaxFilters,
  onOpenCatalog,
  onClearScope,
  focusedSourceId,
  sourceMetaById,
}: TrainingViewProps) {
  const [mode, setMode] = useState<TrainingMode>('learn');
  const [activeSourceId, setActiveSourceId] = useState<string | undefined>(focusedSourceId);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [drillStreak, setDrillStreak] = useState(0);
  const [sessionStats, setSessionStats] = useState({ completed: 0, mistakes: 0 });
  const [lineKey, setLineKey] = useState(0);

  const deck = useMemo(
    () =>
      selectTrainingLines({
        lines: allLines,
        graph,
        settings,
        reviewStates,
        repertoireLines,
      }),
    [allLines, graph, settings, reviewStates, repertoireLines],
  );

  const sourceSummaries = useMemo(
    () => buildTrainingSourceSummaries(deck, reviewStates, sourceMetaById),
    [deck, reviewStates, sourceMetaById],
  );
  const resolvedActiveSourceId =
    sourceSummaries.find((entry) => entry.sourceId === activeSourceId)?.sourceId ??
    sourceSummaries.find((entry) => (focusedSourceId ? entry.sourceIds.includes(focusedSourceId) : false))?.sourceId ??
    sourceSummaries[0]?.sourceId;
  const activeSourceSummary = useMemo(() => {
    if (sourceSummaries.length === 0) {
      return undefined;
    }

    return (
      sourceSummaries.find((entry) => entry.sourceId === resolvedActiveSourceId) ??
      sourceSummaries[0]
    );
  }, [resolvedActiveSourceId, sourceSummaries]);
  const activeDeck = useMemo(() => {
    if (!activeSourceSummary) {
      return deck;
    }

    return deck.filter((line) => activeSourceSummary.sourceIds.includes(line.lineSourceId));
  }, [activeSourceSummary, deck]);
  const safeLineIndex = activeDeck.length === 0 ? 0 : Math.min(currentLineIndex, activeDeck.length - 1);
  const currentLine = activeDeck[safeLineIndex];
  const discoveredLines = sourceSummaries.reduce((total, entry) => total + entry.discoveredLineCount, 0);
  const masteredLines = sourceSummaries.reduce((total, entry) => total + entry.masteredLineCount, 0);
  const newLines = sourceSummaries.reduce((total, entry) => total + entry.newLineCount, 0);
  const modeUnlockState = {
    learn: true,
    practice: discoveredLines >= MODE_UNLOCKS.practice.minimumDiscoveredLines,
    drill: discoveredLines >= MODE_UNLOCKS.drill.minimumDiscoveredLines,
  } satisfies Record<TrainingMode, boolean>;
  const resolvedMode: TrainingMode = modeUnlockState[mode] ? mode : 'learn';

  if (!currentLine) {
    return (
      <SectionCard title="Entrenamiento">
        <EmptyStatePanel
          title={isDeckLoading ? 'Estamos preparando este curso' : 'No hay lineas listas para practicar'}
          description={
            isDeckLoading
              ? `La apertura o familia ${scopeLabel ? `"${scopeLabel}"` : 'seleccionada'} todavia esta cargando sus slices.`
              : hasLoadedBuckets
                ? 'La configuracion actual dejo este curso sin lineas jugables. Mantuvimos el filtro serio de profundidad para evitar ramas demasiado cortas.'
                : 'Carga una apertura desde la columna izquierda para construir el curso y empezar a practicar.'
          }
          tips={[
            'Mantener profundidad minima en 5 o 6 da cursos mas utiles y evita lineas triviales.',
            'Si esta familia sigue vacia, prueba subir la profundidad maxima o cambiar el color a ambos.',
            'El mazo se arma por apertura elegida, no por todo el catalogo mezclado.',
          ]}
          actions={[
            ...(onRelaxFilters ? [{ label: 'Expandir el curso', onClick: onRelaxFilters }] : []),
            ...(onClearScope ? [{ label: 'Cambiar de apertura', onClick: onClearScope, variant: 'secondary' as const }] : []),
            ...(onOpenCatalog ? [{ label: 'Volver a buscar', onClick: onOpenCatalog, variant: 'secondary' as const }] : []),
          ]}
        />
      </SectionCard>
    );
  }

  const relatedTheory =
    (currentLine.terminalNodeId
      ? theoryNotes.find((note) => note.nodeId === currentLine.terminalNodeId)
      : undefined) ??
    theoryNotes.find((note) => currentLine.tags.some((tag) => note.tags.includes(tag)));
  const theoryHighlights = getTheoryHighlights(relatedTheory);
  const currentReview = reviewStates[currentLine.id];
  const currentSourceMeta = sourceMetaById?.[currentLine.lineSourceId];
  const currentSourceSummary = sourceSummaries.find((entry) =>
    entry.sourceIds.includes(currentLine.lineSourceId),
  );
  const currentSourcePosition = activeSourceSummary
    ? sourceSummaries.findIndex((entry) => entry.sourceId === activeSourceSummary.sourceId)
    : -1;
  const linePreviewSan = applyUciLine(currentLine.movePath).sanMoves.join(' ');
  const playerColorLabel = formatPlayerColorLabel(currentLine.color);
  const trainingColorLabel = formatTrainingColorLabel(settings.trainingColor);

  function moveToSource(offset: 1 | -1) {
    if (!activeSourceSummary || sourceSummaries.length === 0) {
      return;
    }

    const currentIndex = sourceSummaries.findIndex((entry) => entry.sourceId === activeSourceSummary.sourceId);
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + offset + sourceSummaries.length) % sourceSummaries.length;
    const nextSource = sourceSummaries[nextIndex];

    if (!nextSource) {
      return;
    }

    setActiveSourceId(nextSource.sourceId);
    setCurrentLineIndex(0);
    setLineKey((prev) => prev + 1);
  }

  async function handleLineComplete(result: { mistakes: number; completed: boolean }) {
    const grade =
      result.mistakes === 0
        ? 4
        : result.mistakes === 1
          ? 3
          : result.completed
            ? 2
            : 0;

    const nextState = rescheduleReview(reviewStates[currentLine.id], currentLine.id, grade as 0 | 1 | 2 | 3 | 4);
    await onSaveReviewState(nextState);

    setSessionStats((prev) => ({
      completed: prev.completed + 1,
      mistakes: prev.mistakes + result.mistakes,
    }));

    if (resolvedMode === 'drill') {
      setDrillStreak((prev) => (result.mistakes === 0 ? prev + 1 : 0));
    }

    window.setTimeout(() => {
      if (safeLineIndex + 1 < activeDeck.length) {
        setCurrentLineIndex(safeLineIndex + 1);
      } else {
        moveToSource(1);
      }
      setLineKey((prev) => prev + 1);
    }, 900);
  }

  function handleModeChange(nextMode: TrainingMode) {
    if (!modeUnlockState[nextMode]) {
      return;
    }

    setMode(nextMode);
    setCurrentLineIndex(0);
    setDrillStreak(0);
    setLineKey((prev) => prev + 1);
  }

  function handleSkip() {
    if (safeLineIndex + 1 < activeDeck.length) {
      setCurrentLineIndex(safeLineIndex + 1);
      setLineKey((prev) => prev + 1);
      return;
    }

    moveToSource(1);
  }

  return (
    <div className="training-session training-session--focus">
      <div className="training-session__board">
        <section className="section-card training-stage-card">
          <div className="section-card__body training-stage-card__body">
            <div className="training-stage-header training-stage-header--compact">
              <div className="training-stage-banner">
                <span className="training-stage-banner__eyebrow">Ahora juegas</span>
                <h3>{currentSourceMeta?.displayTitle ?? currentLine.openingName ?? 'Linea sin nombre'}</h3>
                <p>
                  {currentSourceMeta?.ecoLabel ? `${currentSourceMeta.ecoLabel} | ` : ''}
                  {currentSourceMeta?.displaySubtitle ?? 'Subvariacion activa'}
                </p>
                <div className="training-stage-meta">
                  <span className="training-stage-stat">{playerColorLabel}</span>
                  <span className="training-stage-stat">
                    Ruta {Math.max(currentSourcePosition + 1, 1)} de {sourceSummaries.length}
                  </span>
                  <span className="training-stage-stat">
                    Linea {safeLineIndex + 1} de {activeDeck.length}
                  </span>
                </div>
                <code>{linePreviewSan}</code>
              </div>

              <div className="training-stage-actions">
                <div className="training-mode-grid training-mode-grid--compact">
                  {TRAINING_MODES.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`mode-chip ${resolvedMode === entry.id ? 'is-active' : ''} ${
                        !modeUnlockState[entry.id] ? 'is-locked' : ''
                      }`}
                      onClick={() => handleModeChange(entry.id)}
                      disabled={!modeUnlockState[entry.id]}
                    >
                      <strong>{entry.label}</strong>
                      <span>
                        {modeUnlockState[entry.id]
                          ? entry.description
                          : MODE_UNLOCKS[entry.id].lockedLabel}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="button-row button-row--compact button-row--toolbar">
                  <button type="button" className="secondary-button" onClick={() => moveToSource(-1)} title="Subvariante anterior">
                    Anterior
                  </button>
                  <button type="button" className="secondary-button" onClick={handleSkip} title="Saltar linea actual">
                    Saltar
                  </button>
                  <button type="button" className="secondary-button" onClick={() => moveToSource(1)} title="Siguiente subvariante">
                    Siguiente
                  </button>
                  {onClearScope ? (
                    <button type="button" className="secondary-button" onClick={onClearScope} title="Cambiar apertura o curso">
                      Cambiar
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="training-focus-layout training-focus-layout--single">
              <div className="training-focus-layout__board">
                <PlayableBoard
                  key={`${currentLine.id}-${lineKey}`}
                  lineMoves={currentLine.movePath}
                  playerColor={currentLine.color}
                  mode={resolvedMode}
                  opponentDelay={settings.opponentDelay}
                  autoRetryDelay={settings.autoRetryDelay}
                  hintsEnabled={resolvedMode === 'learn' && settings.hintsEnabled}
                  theoryNote={relatedTheory}
                  onLineComplete={(result) => void handleLineComplete(result)}
                />
              </div>
            </div>

            <div className="training-context-grid">
              <article className="info-panel">
                <h3>Estado del curso</h3>
                <div className="detail-meta">
                  <p><strong>Curso:</strong> {scopeLabel ?? 'Sin foco'}</p>
                  <p><strong>Filtro actual:</strong> {trainingColorLabel} | profundidad {settings.minimumDepth}-{settings.maximumDepth}</p>
                  <p><strong>Ruta activa:</strong> {activeSourceSummary?.openingName ?? 'Sin foco'} ({activeDeck.length} lineas)</p>
                  <p><strong>Progreso:</strong> {newLines} nuevas | {discoveredLines} descubiertas | {masteredLines} dominadas</p>
                  <p><strong>Retencion:</strong> {formatPercentage(metrics.retentionRate)} | <strong>Reviews:</strong> {metrics.dueLines}</p>
                  <p><strong>Sesion:</strong> {sessionStats.completed} completadas, {sessionStats.mistakes} errores</p>
                  {resolvedMode === 'drill' ? (
                    <p className="drill-streak"><strong>Racha:</strong> <span>{drillStreak}</span></p>
                  ) : null}
                  {currentReview ? (
                    <p><strong>Siguiente review:</strong> {new Date(currentReview.dueAt).toLocaleString()}</p>
                  ) : null}
                </div>
              </article>

              <article className="info-panel">
                <h3>Guia de estudio</h3>
                <div className="detail-meta">
                  <p><strong>Objetivo:</strong> domina esta ruta antes de cambiar a la siguiente.</p>
                  <p><strong>Modo actual:</strong> {resolvedMode === 'learn' ? 'Learn con apoyo' : resolvedMode === 'practice' ? 'Practice con reintento' : 'Drill sin margen de error'}</p>
                  <p><strong>Filtro de color:</strong> {trainingColorLabel}. Al cambiarlo se reinicia la ruta actual para evitar mezclar contextos.</p>
                </div>
                {currentSourceSummary ? (
                  <p className="empty-state">
                    Esta ruta agrupa {currentSourceSummary.lineCount} lineas, {currentSourceSummary.newLineCount} nuevas y una
                    dificultad media de {currentSourceSummary.averageDifficulty.toFixed(1)}.
                  </p>
                ) : null}
                {theoryHighlights.length > 0 ? (
                  <div className="stack-list">
                    {theoryHighlights.map((item) => (
                      <div key={`${item.label}-${item.value}`} className="list-row">
                        <strong>{item.label}</strong>
                        <span>{item.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">
                    Esta subvariante aun no tiene teoria curada. El entrenamiento sigue siendo exacto por SAN/UCI y puedes
                    anadir notas propias desde el panel de teoria.
                  </p>
                )}
              </article>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
