import type { RefObject } from 'react';
import { useDeferredValue, useMemo, useState } from 'react';
import type { OpeningCatalogEntry, OpeningEntry, TheoryNote } from '@/domain/opening';
import type { OpeningGraph } from '@/domain/position';
import type { RepertoireLine } from '@/domain/repertoire';
import { searchOpenings } from '@/lib/search/openingSearch';
import { applyUciLine, getNodeLabels, getOpeningNameForNode } from '@/lib/chess/openingGraph';
import { toOpeningSummary } from '@/data/mappers/openingMapper';
import { BoardPanel } from '@/components/BoardPanel';
import { EmptyStatePanel } from '@/components/EmptyStatePanel';
import { SectionCard } from '@/components/SectionCard';

const CATALOG_PAGE_SIZE = 120;

interface CatalogViewProps {
  openings: OpeningCatalogEntry[];
  openingDetailsById: Record<string, OpeningEntry>;
  graph: OpeningGraph;
  theoryNotes: TheoryNote[];
  repertoireLines: RepertoireLine[];
  selectedOpeningId?: string;
  selectedNodeId?: string;
  isSelectedOpeningLoading: boolean;
  onSelectOpening: (openingId: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
}

export function CatalogView({
  openings,
  openingDetailsById,
  graph,
  theoryNotes,
  repertoireLines,
  selectedOpeningId,
  selectedNodeId,
  isSelectedOpeningLoading,
  onSelectOpening,
  query,
  onQueryChange,
  searchInputRef,
}: CatalogViewProps) {
  const deferredQuery = useDeferredValue(query);
  const [paginationState, setPaginationState] = useState({
    query: '',
    visibleCount: CATALOG_PAGE_SIZE,
  });
  const filtered = useMemo(
    () => searchOpenings(openings, deferredQuery),
    [openings, deferredQuery],
  );
  const visibleCount =
    paginationState.query === deferredQuery ? paginationState.visibleCount : CATALOG_PAGE_SIZE;
  const visibleOpenings = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const selectedOpeningSummary = deferredQuery.trim()
    ? filtered.find((opening) => opening.id === selectedOpeningId) ?? filtered[0]
    : openings.find((opening) => opening.id === selectedOpeningId) ?? filtered[0];
  const selectedOpening = selectedOpeningSummary
    ? openingDetailsById[selectedOpeningSummary.id]
    : undefined;
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
  const selectedNode = selectedNodeId ? graph.nodes[selectedNodeId] : undefined;
  const childBranches =
    selectedNode?.childEdges.map((edge) => ({
      edge,
      title: getOpeningNameForNode(graph, edge.toNodeId),
    })) ?? [];
  const relatedTranspositions =
    selectedNode?.openingIds
      .filter((openingId) => openingId !== selectedOpening?.id)
      .map((openingId) => graph.openingsById[openingId])
      .filter(Boolean) ?? [];
  const relatedRepertoires = useMemo(
    () =>
      selectedOpeningSummary
        ? repertoireLines.filter(
            (line) =>
              line.rootOpeningId === selectedOpeningSummary.id ||
              (selectedOpening
                ? selectedOpening.uciMoves.every((move, index) => line.movePath[index] === move)
                : false),
          )
        : [],
    [selectedOpeningSummary, selectedOpening, repertoireLines],
  );
  const repertoireSanMap = useMemo(
    () => new Map(relatedRepertoires.map((line) => [line.id, applyUciLine(line.movePath).sanMoves.join(' ')])),
    [relatedRepertoires],
  );

  return (
    <div className="feature-grid">
      <SectionCard title="Catalogo" eyebrow={`${filtered.length} lineas`}>
        <label className="field">
          <span>Buscar por nombre, ECO, SAN o UCI</span>
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Ej: QGD, Ruy Lopez, e2e4"
          />
        </label>
        <p className="catalog-meta">
          Mostrando {visibleOpenings.length} de {filtered.length} resultados
          {deferredQuery !== query ? ' | refinando busqueda...' : ''}
        </p>
        <div className="opening-list">
          {visibleOpenings.map((opening) => {
            const summary = toOpeningSummary(opening);
            return (
              <button
                key={opening.id}
                type="button"
                className={`opening-list__item ${selectedOpeningSummary?.id === opening.id ? 'is-active' : ''}`}
                onClick={() => onSelectOpening(opening.id)}
              >
                <strong>{summary.title}</strong>
                <span>{summary.subtitle}</span>
                <code>{summary.eco}</code>
              </button>
            );
          })}
        </div>
        {filtered.length > visibleOpenings.length ? (
          <button
            type="button"
            className="secondary-button secondary-button--full"
            onClick={() =>
              setPaginationState((current) => ({
                query: deferredQuery,
                visibleCount:
                  current.query === deferredQuery
                    ? current.visibleCount + CATALOG_PAGE_SIZE
                    : CATALOG_PAGE_SIZE * 2,
              }))
            }
          >
            Cargar {Math.min(CATALOG_PAGE_SIZE, filtered.length - visibleOpenings.length)} aperturas mas
          </button>
        ) : null}
      </SectionCard>

      {selectedOpeningSummary ? (
        <SectionCard title={selectedOpeningSummary.canonicalName} eyebrow={selectedOpeningSummary.eco}>
          <div className="detail-meta">
            <p>
              <strong>Familia:</strong> {selectedOpeningSummary.family}
            </p>
            <p>
              <strong>Subvariacion:</strong> {selectedOpeningSummary.subvariation}
            </p>
            <p>
              <strong>Aliases:</strong> {selectedOpeningSummary.aliases.join(', ') || 'Sin aliases'}
            </p>
            <p>
              <strong>Preview:</strong> {selectedOpeningSummary.movePreviewSan}
            </p>
          </div>
          {selectedOpening ? (
            <BoardPanel title="Linea principal" uciMoves={selectedOpening.uciMoves} />
          ) : (
            <p className="empty-state">
              {isSelectedOpeningLoading
                ? 'Cargando movimientos completos de esta apertura...'
                : 'Selecciona esta apertura para cargar su linea completa.'}
            </p>
          )}
          {selectedNodeId ? (
            <>
              <div className="chip-row">
                {labels.canonicalNames.map((label) => (
                  <span key={label} className="chip">
                    {label}
                  </span>
                ))}
                {labels.aliases.map((label) => (
                  <span key={label} className="chip chip--muted">
                    {label}
                  </span>
                ))}
              </div>
              <div className="detail-grid">
                <article className="info-panel">
                  <h3>Ramas hijas</h3>
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
                    <p className="empty-state">Esta linea no tiene ramas hijas cargadas todavia.</p>
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
                    <p className="empty-state">Sin clasificaciones adicionales en esta posicion.</p>
                  )}
                </article>

                <article className="info-panel">
                  <h3>Repertorios que la usan</h3>
                  {relatedRepertoires.length > 0 ? (
                    <div className="stack-list">
                      {relatedRepertoires.map((line) => (
                        <div key={line.id} className="list-row">
                          <strong>{line.color === 'white' ? 'Blancas' : 'Negras'}</strong>
                          <span>{repertoireSanMap.get(line.id) ?? line.movePath.join(' ')}</span>
                          <code>{line.enabled ? 'Activa' : 'Pausada'}</code>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-state">Aun no hay repertorios locales ligados a esta apertura.</p>
                  )}
                </article>
              </div>
            </>
          ) : (
            <p className="empty-state">
              {isSelectedOpeningLoading
                ? 'Cargando slice del grafo para esta apertura...'
                : 'Selecciona esta apertura para cargar sus ramas, transposiciones y repertorios relacionados.'}
            </p>
          )}
          <div className="note-list">
            {relatedNotes.length > 0 ? (
              relatedNotes.map((note) => (
                <article key={`${note.nodeId}-${note.title}`} className="note-card">
                  <h3>{note.title}</h3>
                  <p>{note.summary}</p>
                </article>
              ))
            ) : (
              <p className="empty-state">
                Esta posicion aun no tiene teoria cargada. La estructura ya soporta notas por nodo y comentarios PGN.
              </p>
            )}
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Sin resultados">
          <EmptyStatePanel
            title="No hubo coincidencias"
            description="La busqueda actual no devolvio aperturas. Puedes volver a una consulta clasica o probar con notacion UCI."
            tips={[
              'Prueba con ECO como C60 o D30.',
              'Prueba con alias como QGD o Spanish Opening.',
              'Usa una secuencia corta como e2e4 e7e5.',
            ]}
            actions={[
              { label: 'Buscar C60', onClick: () => onQueryChange('C60') },
              { label: 'Buscar QGD', onClick: () => onQueryChange('QGD'), variant: 'secondary' },
              { label: 'Limpiar busqueda', onClick: () => onQueryChange(''), variant: 'secondary' },
            ]}
          />
        </SectionCard>
      )}
    </div>
  );
}
