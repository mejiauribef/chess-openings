import { useMemo, useState } from 'react';
import type { TheoryNote } from '@/domain/opening';
import type { OpeningGraph } from '@/domain/position';
import type { RepertoireLine } from '@/domain/repertoire';
import type { ReviewState, TrainingLine, TrainingMetrics, TrainingMode, TrainingSettings } from '@/domain/training';
import { selectTrainingLines } from '@/lib/training/cards';
import { rescheduleReview } from '@/lib/training/scheduler';
import { PlayableBoard } from '@/components/PlayableBoard';
import { EmptyStatePanel } from '@/components/EmptyStatePanel';
import { SectionCard } from '@/components/SectionCard';

interface TrainingViewProps {
  graph: OpeningGraph;
  allLines: TrainingLine[];
  settings: TrainingSettings;
  reviewStates: Record<string, ReviewState>;
  theoryNotes: TheoryNote[];
  repertoireLines: RepertoireLine[];
  metrics: TrainingMetrics;
  onSaveReviewState: (reviewState: ReviewState) => Promise<void>;
  hasLoadedBuckets: boolean;
}

const TRAINING_MODES: Array<{ id: TrainingMode; label: string; description: string }> = [
  {
    id: 'learn',
    label: 'Learn',
    description: 'Hints visuales y notas de teoria.',
  },
  {
    id: 'practice',
    label: 'Practice',
    description: 'Sin hints, reintento tras error.',
  },
  {
    id: 'drill',
    label: 'Drill',
    description: 'Velocidad: error termina la linea.',
  },
];

function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
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
}: TrainingViewProps) {
  const [mode, setMode] = useState<TrainingMode>('learn');
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

  const currentLine = deck[currentLineIndex];

  if (!currentLine) {
    return (
      <SectionCard title="Entrenamiento">
        <EmptyStatePanel
          title="No hay lineas listas para esta sesion"
          description={
            hasLoadedBuckets
              ? 'La configuracion actual dejo el mazo vacio. Ajusta profundidad, color, repertorio o carga mas slices.'
              : 'Carga al menos una apertura desde el catalogo para generar lineas de entrenamiento.'
          }
          tips={[
            'Cambia de modo o activa hints para ampliar las opciones.',
            'Si entrenas solo repertorio, confirma que haya lineas activas.',
            'Aumenta la profundidad maxima para incluir mas variantes.',
          ]}
        />
      </SectionCard>
    );
  }

  const relatedTheory = (currentLine.terminalNodeId
    ? theoryNotes.find((note) => note.nodeId === currentLine.terminalNodeId)
    : undefined)
    ?? theoryNotes.find((note) =>
      currentLine.tags.some((tag) => note.tags.includes(tag)),
    );

  // Move history is shown as UCI moves (no Chess instantiation needed)
  const moveHistory = currentLine.movePath;

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

    // Auto-advance to next line after a short delay
    setTimeout(() => {
      const nextIndex = (currentLineIndex + 1) % deck.length;
      setCurrentLineIndex(nextIndex);
      setLineKey((prev) => prev + 1);
    }, 1500);
  }

  function handleModeChange(nextMode: TrainingMode) {
    setMode(nextMode);
    setCurrentLineIndex(0);
    setDrillStreak(0);
    setLineKey((prev) => prev + 1);
  }

  function handleSkip() {
    const nextIndex = (currentLineIndex + 1) % deck.length;
    setCurrentLineIndex(nextIndex);
    setLineKey((prev) => prev + 1);
  }

  const currentReview = reviewStates[currentLine.id];

  return (
    <div className="training-session">
      <div className="training-session__board">
        <SectionCard title="Sesion de entrenamiento" eyebrow={TRAINING_MODES.find((entry) => entry.id === mode)?.label}>
          <div className="button-row">
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

          <PlayableBoard
            key={lineKey}
            lineMoves={currentLine.movePath}
            playerColor={currentLine.color}
            mode={mode}
            opponentDelay={settings.opponentDelay}
            autoRetryDelay={settings.autoRetryDelay}
            hintsEnabled={mode === 'learn' && settings.hintsEnabled}
            theoryNote={relatedTheory}
            onLineComplete={(result) => void handleLineComplete(result)}
          />

          <div className="button-row">
            <button type="button" className="secondary-button" onClick={handleSkip}>
              Saltar linea
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="training-session__info">
        <SectionCard title="Informacion">
          <div className="detail-meta">
            <p><strong>Apertura:</strong> {currentLine.openingName || 'Linea sin nombre'}</p>
            <p><strong>Color:</strong> {currentLine.color === 'white' ? 'Blancas' : 'Negras'}</p>
            <p><strong>Progreso:</strong> {currentLineIndex + 1}/{deck.length} lineas</p>
            {mode === 'drill' ? (
              <p className="drill-streak"><strong>Racha:</strong> <span>{drillStreak}</span></p>
            ) : null}
            <p><strong>Sesion:</strong> {sessionStats.completed} completadas, {sessionStats.mistakes} errores</p>
            <p>
              <strong>Estado:</strong>{' '}
              {currentReview
                ? `vence ${new Date(currentReview.dueAt).toLocaleString()} | racha ${currentReview.streak}`
                : 'Linea nueva'}
            </p>
          </div>

          {moveHistory.length > 0 ? (
            <article className="info-panel">
              <h3>Movimientos</h3>
              <div className="move-history-compact">
                {moveHistory.map((uci, i) => (
                  <span key={`${uci}-${i}`}>
                    {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}{uci}{' '}
                  </span>
                ))}
              </div>
            </article>
          ) : null}
        </SectionCard>

        <SectionCard title="Metricas" eyebrow={`${metrics.dueLines} vencidas`}>
          <div className="detail-meta">
            <p><strong>Lineas activas:</strong> {metrics.totalLines}</p>
            <p><strong>Lineas dominadas:</strong> {metrics.masteredLines}</p>
            <p><strong>Ramas pendientes:</strong> {metrics.pendingBranches}</p>
            <p><strong>Retencion:</strong> {formatPercentage(metrics.retentionRate)}</p>
            <p><strong>Estabilidad media:</strong> {metrics.averageStability.toFixed(1)}</p>
          </div>

          {metrics.coverageByColor.length > 0 ? (
            <article className="info-panel">
              <h3>Cobertura por color</h3>
              <div className="stack-list">
                {metrics.coverageByColor.map((entry) => (
                  <div key={entry.label} className="list-row">
                    <strong>{entry.label}</strong>
                    <span>{entry.mastered}/{entry.total} dominadas</span>
                    <code>{entry.pending} pendientes</code>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {metrics.coverageByFamily.length > 0 ? (
            <article className="info-panel">
              <h3>Cobertura por familia</h3>
              <div className="stack-list">
                {metrics.coverageByFamily.map((entry) => (
                  <div key={entry.label} className="list-row">
                    <strong>{entry.label}</strong>
                    <span>{entry.mastered}/{entry.total} dominadas</span>
                    <code>{entry.pending} pendientes</code>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {metrics.errorsByOpening.length > 0 ? (
            <article className="info-panel">
              <h3>Errores por apertura</h3>
              <div className="stack-list">
                {metrics.errorsByOpening.map((entry) => (
                  <div key={entry.label} className="list-row">
                    <strong>{entry.label}</strong>
                    <code>{entry.lapses} fallos</code>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {metrics.weakPoints.length > 0 ? (
            <article className="info-panel">
              <h3>Puntos debiles</h3>
              <div className="heatmap-grid">
                {metrics.weakPoints.map((point) => (
                  <div
                    key={point.nodeId}
                    className="heatmap-cell"
                    style={{ opacity: 0.35 + point.intensity * 0.65 }}
                  >
                    <strong>{point.label}</strong>
                    <span>{point.openingLabel}</span>
                    <code>{point.lapses} lapses</code>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          <article className="info-panel">
            <h3>Cobertura teorica</h3>
            <p><strong>Nodos con notas:</strong> {metrics.theoryCoverage.notedNodes}</p>
            <p><strong>Notas enlazadas:</strong> {metrics.theoryCoverage.linkedNotes}</p>
            <p><strong>Cobertura:</strong> {formatPercentage(metrics.theoryCoverage.coverageRate)}</p>
          </article>
        </SectionCard>
      </div>
    </div>
  );
}
