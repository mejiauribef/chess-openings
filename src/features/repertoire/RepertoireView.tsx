import { useMemo, useState } from 'react';
import type { OpeningCatalogEntry } from '@/domain/opening';
import type { RepertoireLine } from '@/domain/repertoire';
import { exportRepertoireAsJson, exportRepertoireAsPgn } from '@/lib/chess/pgn';
import { applyUciLine } from '@/lib/chess/openingGraph';
import { EmptyStatePanel } from '@/components/EmptyStatePanel';
import { SectionCard } from '@/components/SectionCard';

interface RepertoireViewProps {
  openings: OpeningCatalogEntry[];
  repertoireLines: RepertoireLine[];
  selectedOpeningId?: string;
  onCreateFromOpening: (color: RepertoireLine['color']) => Promise<void>;
  onImportPgn: (payload: { pgn: string; color: RepertoireLine['color'] }) => Promise<void>;
  onToggleEnabled: (lineId: string) => Promise<void>;
  onSaveLine: (line: RepertoireLine) => Promise<void>;
}

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const SAMPLE_PGNS = {
  caroKann: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 {Presiona el centro antes de recuperar el peon} *',
  qgd: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 {Desarrolla rapido y fija la tension central} *',
};

export function RepertoireView({
  openings,
  repertoireLines,
  selectedOpeningId,
  onCreateFromOpening,
  onImportPgn,
  onToggleEnabled,
  onSaveLine,
}: RepertoireViewProps) {
  const [pgn, setPgn] = useState('');
  const [color, setColor] = useState<RepertoireLine['color']>('white');
  const [importError, setImportError] = useState<string>();
  const selectedOpening = openings.find((opening) => opening.id === selectedOpeningId);
  const sortedLines = useMemo(
    () =>
      [...repertoireLines].sort(
        (left, right) =>
          Number(right.enabled) - Number(left.enabled) ||
          left.priority - right.priority ||
          left.id.localeCompare(right.id),
      ),
    [repertoireLines],
  );

  async function handleImport() {
    if (!pgn.trim()) {
      return;
    }

    try {
      setImportError(undefined);
      await onImportPgn({ pgn, color });
      setPgn('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Error al importar PGN.');
    }
  }

  return (
    <div className="feature-grid">
      <SectionCard title="Crear repertorio" eyebrow={selectedOpening?.canonicalName ?? 'Sin apertura seleccionada'}>
        <p className="empty-state">
          {selectedOpening
            ? `Puedes sembrar el repertorio desde la apertura seleccionada (${selectedOpening.eco}) o importar una linea PGN.`
            : 'Selecciona una apertura en el catalogo para crear una linea base rapidamente.'}
        </p>

        <div className="button-row">
          <button type="button" onClick={() => void onCreateFromOpening('white')} disabled={!selectedOpening}>
            Agregar a blancas
          </button>
          <button type="button" onClick={() => void onCreateFromOpening('black')} disabled={!selectedOpening}>
            Agregar a negras
          </button>
        </div>

        <label className="field">
          <span>Color del PGN importado</span>
          <select value={color} onChange={(event) => setColor(event.target.value as RepertoireLine['color'])}>
            <option value="white">Blancas</option>
            <option value="black">Negras</option>
          </select>
        </label>

        <label className="field">
          <span>Importar PGN</span>
          <textarea
            value={pgn}
            onChange={(event) => setPgn(event.target.value)}
            placeholder='Ej: 1. e4 c6 2. d4 d5 3. Nc3 dxe4 {nota}'
            rows={8}
          />
        </label>

        <button type="button" onClick={() => void handleImport()} disabled={!pgn.trim()}>
          Importar como repertorio entrenable
        </button>
        {importError ? <p className="feedback feedback--error">{importError}</p> : null}

        {!selectedOpening ? (
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => setPgn(SAMPLE_PGNS.caroKann)}>
              Seed Caro-Kann
            </button>
            <button type="button" className="secondary-button" onClick={() => setPgn(SAMPLE_PGNS.qgd)}>
              Seed QGD
            </button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Lineas guardadas" eyebrow={`${repertoireLines.length} lineas`}>
        <div className="button-row">
          <button
            type="button"
            onClick={() => downloadText('repertoire.json', exportRepertoireAsJson(repertoireLines))}
            disabled={repertoireLines.length === 0}
          >
            Exportar JSON
          </button>
          <button
            type="button"
            onClick={() => downloadText('repertoire.pgn', exportRepertoireAsPgn(repertoireLines))}
            disabled={repertoireLines.length === 0}
          >
            Exportar PGN
          </button>
        </div>

        {sortedLines.length > 0 ? (
          <div className="stack-list">
            {sortedLines.map((line) => {
              const rootOpening = openings.find((opening) => opening.id === line.rootOpeningId);
              const san = applyUciLine(line.movePath).sanMoves.join(' ');

              return (
                <article key={line.id} className="repertoire-card">
                  <div className="repertoire-card__header">
                    <div>
                      <strong>{rootOpening?.canonicalName ?? 'User imported line'}</strong>
                      <span>{line.color === 'white' ? 'Blancas' : 'Negras'}</span>
                    </div>
                    <button type="button" className="secondary-button" onClick={() => void onToggleEnabled(line.id)}>
                      {line.enabled ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>

                  <p className="empty-state">{san || line.movePath.join(' ')}</p>

                  <div className="repertoire-card__controls">
                    <label className="field">
                      <span>Prioridad</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={line.priority}
                        onChange={(event) =>
                          void onSaveLine({
                            ...line,
                            priority: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <div className="chip-row">
                      {line.tags.map((tag) => (
                        <span key={`${line.id}-${tag}`} className="chip chip--muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyStatePanel
            title="Tu repertorio aun esta vacio"
            description="Puedes sembrarlo desde la apertura actual o importar un PGN propio con comentarios que se convertiran en teoria local."
            tips={[
              'Usa los botones de blancas/negras para crear una linea base.',
              'Pega un PGN con comentarios entre llaves para guardar notas por posicion.',
            ]}
            actions={[
              ...(selectedOpening
                ? [{ label: 'Agregar apertura actual a blancas', onClick: () => void onCreateFromOpening('white') }]
                : []),
              ...(!selectedOpening
                ? [
                    { label: 'Seed Caro-Kann', onClick: () => setPgn(SAMPLE_PGNS.caroKann), variant: 'secondary' as const },
                    { label: 'Seed QGD', onClick: () => setPgn(SAMPLE_PGNS.qgd), variant: 'secondary' as const },
                  ]
                : []),
            ]}
          />
        )}
      </SectionCard>
    </div>
  );
}
