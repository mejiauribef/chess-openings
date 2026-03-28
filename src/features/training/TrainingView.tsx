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
import { buildTrainingSourceSummaries, selectTrainingLines } from '@/lib/training/cards';
import { rescheduleReview } from '@/lib/training/scheduler';
import { applyUciLine } from '@/lib/chess/openingGraph';
import { PlayableBoard } from '@/components/PlayableBoard';
import { EmptyStatePanel } from '@/components/EmptyStatePanel';
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

function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function getPreferredLineIndex(
  deck: TrainingViewProps['allLines'],
  focusedSourceId: string | undefined,
): number {
  if (!focusedSourceId) {
    return 0;
  }

  const matchingIndex = deck.findIndex((line) => line.lineSourceId === focusedSourceId);
  return matchingIndex >= 0 ? matchingIndex : 0;
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
  const [currentLineIndex, setCurrentLineIndex] = useState(() => getPreferredLineIndex(allLines, focusedSourceId));
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
  const visibleSourceSummaries = sourceSummaries.slice(0, 18);
  const safeLineIndex = deck.length === 0 ? 0 : Math.min(currentLineIndex, deck.length - 1);
  const currentLine = deck[safeLineIndex];

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
  const currentReview = reviewStates[currentLine.id];
  const currentSourceMeta = sourceMetaById?.[currentLine.lineSourceId];
  const currentSourceSummary = sourceSummaries.find((entry) =>
    entry.sourceIds.includes(currentLine.lineSourceId),
  );
  const linePreviewSan = applyUciLine(currentLine.movePath).sanMoves.join(' ');

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

    if (mode === 'drill') {
      setDrillStreak(result.mistakes === 0 ? (prev) => prev + 1 : 0);
    }

    window.setTimeout(() => {
      const nextIndex = (safeLineIndex + 1) % deck.length;
      setCurrentLineIndex(nextIndex);
      setLineKey((prev) => prev + 1);
    }, 900);
  }

  function handleModeChange(nextMode: TrainingMode) {
    setMode(nextMode);
    setCurrentLineIndex(0);
    setDrillStreak(0);
    setLineKey((prev) => prev + 1);
  }

  function handleSkip() {
    const nextIndex = (safeLineIndex + 1) % deck.length;
    setCurrentLineIndex(nextIndex);
    setLineKey((prev) => prev + 1);
  }

  function handleFocusSource(sourceIds: string[]) {
    const nextIndex = deck.findIndex((line) => sourceIds.includes(line.lineSourceId));
    if (nextIndex < 0) {
      return;
    }

    setCurrentLineIndex(nextIndex);
    setLineKey((prev) => prev + 1);
  }

  return (
    <div className="training-session training-session--focus">
      <div className="training-session__board">
        <SectionCard title="Practica" eyebrow={scopeLabel ?? 'Curso activo'}>
          <div className="training-stage-header">
            <div className="training-stage-banner">
              <span className="training-stage-banner__eyebrow">Ahora juegas</span>
              <h3>{currentSourceMeta?.displayTitle ?? currentLine.openingName ?? 'Linea sin nombre'}</h3>
              <p>
                {currentSourceMeta?.ecoLabel ? `${currentSourceMeta.ecoLabel} | ` : ''}
                {currentSourceMeta?.displaySubtitle ?? 'Subvariacion activa'}
              </p>
              <code>{linePreviewSan}</code>
            </div>

            <div className="training-stage-actions">
              <div className="training-mode-grid training-mode-grid--compact">
                {TRAINING_MODES.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`mode-chip ${mode === entry.id ? 'is-active' : ''}`}
                    onClick={() => handleModeChange(entry.id)}
                  >
                    <strong>{entry.label}</strong>
                    <span>{entry.description}</span>
                  </button>
                ))}
              </div>

              <div className="button-row button-row--compact">
                <button type="button" className="secondary-button" onClick={handleSkip}>
                  Saltar linea
                </button>
                {onClearScope ? (
                  <button type="button" className="secondary-button" onClick={onClearScope}>
                    Cambiar apertura
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="training-focus-layout">
            <div className="training-focus-layout__board">
              <PlayableBoard
                key={`${currentLine.id}-${lineKey}`}
                lineMoves={currentLine.movePath}
                playerColor={currentLine.color}
                mode={mode}
                opponentDelay={settings.opponentDelay}
                autoRetryDelay={settings.autoRetryDelay}
                hintsEnabled={mode === 'learn' && settings.hintsEnabled}
                theoryNote={relatedTheory}
                onLineComplete={(result) => void handleLineComplete(result)}
              />
            </div>

            <aside className="training-focus-layout__sidebar">
              <article className="info-panel">
                <h3>Estado del curso</h3>
                <div className="detail-meta">
                  <p><strong>Curso:</strong> {scopeLabel ?? 'Sin foco'}</p>
                  <p><strong>Subvariantes activas:</strong> {sourceSummaries.length}</p>
                  <p><strong>Lineas del mazo:</strong> {deck.length}</p>
                  <p><strong>Profundidad:</strong> {settings.minimumDepth}-{settings.maximumDepth}</p>
                  <p><strong>Retencion:</strong> {formatPercentage(metrics.retentionRate)}</p>
                  <p><strong>Sesion:</strong> {sessionStats.completed} completadas, {sessionStats.mistakes} errores</p>
                  <p><strong>Turno:</strong> {currentLine.color === 'white' ? 'Practicas blancas' : 'Practicas negras'}</p>
                  {mode === 'drill' ? (
                    <p className="drill-streak"><strong>Racha:</strong> <span>{drillStreak}</span></p>
                  ) : null}
                  {currentReview ? (
                    <p><strong>Siguiente review:</strong> {new Date(currentReview.dueAt).toLocaleString()}</p>
                  ) : null}
                </div>
              </article>

              <article className="info-panel">
                <h3>Cola de subvariantes</h3>
                <div className="training-source-list">
                  {visibleSourceSummaries.map((entry) => {
                    const isActive = entry.sourceIds.includes(currentLine.lineSourceId);

                    return (
                      <button
                        key={entry.sourceId}
                        type="button"
                        className={`training-source-card ${isActive ? 'is-active' : ''}`}
                        onClick={() => handleFocusSource(entry.sourceIds)}
                      >
                        <strong>{entry.openingName}</strong>
                        <span>
                          {entry.ecoLabel ? `${entry.ecoLabel} | ` : ''}
                          {entry.displaySubtitle ?? 'Ruta activa'}
                        </span>
                        <small>{entry.movePreviewSan ?? 'Sin preview SAN'}</small>
                        <small>
                          {entry.namedLineCount && entry.namedLineCount > 1
                            ? `${entry.namedLineCount} lineas equivalentes | `
                            : ''}
                          {entry.lineCount} lineas del mazo | {entry.dueCount} vencidas | profundidad{' '}
                          {entry.minDepth}-{entry.maxDepth}
                        </small>
                      </button>
                    );
                  })}
                </div>
                {sourceSummaries.length > visibleSourceSummaries.length ? (
                  <p className="empty-state">
                    Mostrando {visibleSourceSummaries.length} de {sourceSummaries.length} subvariantes en cola para
                    mantener el tablero rapido.
                  </p>
                ) : null}
              </article>

              <article className="info-panel">
                <h3>Metricas utiles</h3>
                <div className="detail-meta">
                  <p><strong>Lineas dominadas:</strong> {metrics.masteredLines}</p>
                  <p><strong>Ramas pendientes:</strong> {metrics.pendingBranches}</p>
                  <p><strong>Estabilidad media:</strong> {metrics.averageStability.toFixed(1)}</p>
                  <p><strong>Notas teoricas:</strong> {metrics.theoryCoverage.notedNodes}</p>
                </div>
                {currentSourceSummary ? (
                  <p className="empty-state">
                    Esta subvariacion aporta {currentSourceSummary.lineCount} lineas al curso y su dificultad media es{' '}
                    {currentSourceSummary.averageDifficulty.toFixed(1)}.
                  </p>
                ) : null}
              </article>
            </aside>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
