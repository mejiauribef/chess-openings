import { Chess } from 'chess.js';
import type { OpeningGraph } from '@/domain/position';
import { getNodeLabels } from '@/lib/chess/openingGraph';
import { EmptyStatePanel } from '@/components/EmptyStatePanel';
import { SectionCard } from '@/components/SectionCard';

interface ExplorerViewProps {
  graph: OpeningGraph;
  selectedNodeId?: string;
  explorerPath: string[];
  onPlayMove: (uci: string) => void;
  onReset: () => void;
  onOpenCatalog: () => void;
  onLoadSelectedOpening?: () => void;
  courseOpeningIds?: Set<string>;
}

export function ExplorerView({
  graph,
  selectedNodeId,
  explorerPath,
  onPlayMove,
  onReset,
  onOpenCatalog,
  onLoadSelectedOpening,
  courseOpeningIds,
}: ExplorerViewProps) {
  if (!selectedNodeId) {
    return (
      <div className="feature-grid feature-grid--single">
        <SectionCard title="Explorador de posiciones">
          <EmptyStatePanel
            title="Todavia no hay una posicion activa"
            description="El explorador navega por posicion, asi que primero necesitamos cargar una apertura o volver a la linea seleccionada."
            tips={[
              'Abre una apertura desde el catalogo para hidratar su bucket.',
              'Luego podras recorrer ramas y transposiciones por teclado o con clic.',
            ]}
            actions={[
              { label: 'Ir al catalogo', onClick: onOpenCatalog },
              ...(onLoadSelectedOpening
                ? [{ label: 'Recargar apertura activa', onClick: onLoadSelectedOpening, variant: 'secondary' as const }]
                : []),
            ]}
          />
        </SectionCard>
      </div>
    );
  }

  const node = graph.nodes[selectedNodeId];
  const labels = getNodeLabels(graph, selectedNodeId);
  const chess = new Chess(node.fen);
  const legalMoves = chess.moves({ verbose: true });

  return (
    <div className="feature-grid feature-grid--single">
      <SectionCard title="Explorador de posiciones" eyebrow={`Nodo ${node.id}`}>
        <div className="detail-meta">
          <p>
            <strong>EPD:</strong> {node.epd}
          </p>
          <p>
            <strong>Turno:</strong> {node.sideToMove === 'w' ? 'Blancas' : 'Negras'}
          </p>
          <p>
            <strong>Breadcrumbs:</strong> {explorerPath.join(' ') || 'Posicion inicial'}
          </p>
          <p>
            <strong>Clasificaciones:</strong> {labels.canonicalNames.join(' / ') || 'Sin nombre'}
          </p>
        </div>

        <div className="chip-row">
          {labels.aliases.map((alias) => (
            <span key={alias} className="chip chip--muted">
              {alias}
            </span>
          ))}
        </div>

        <div className="move-grid">
          {legalMoves.map((move) => {
            const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
            const graphEdge = node.childEdges.find((edge) => edge.uci === uci);
            const inCourse = courseOpeningIds
              ? graphEdge && graph.nodes[graphEdge.toNodeId]?.openingIds.some((id) => courseOpeningIds.has(id))
              : undefined;
            const courseClass = inCourse === true
              ? 'move-chip--in-course'
              : inCourse === false
                ? 'move-chip--out-of-course'
                : '';

            return (
              <button
                key={uci}
                type="button"
                className={`move-chip ${graphEdge ? 'move-chip--in-graph' : ''} ${courseClass}`}
                disabled={!graphEdge}
                onClick={() => graphEdge && onPlayMove(graphEdge.uci)}
              >
                <strong>{move.san}</strong>
                <span>{graphEdge ? 'Dentro del grafo' : 'Legal fuera del grafo'}</span>
              </button>
            );
          })}
        </div>

        <button type="button" className="secondary-button" onClick={onReset}>
          Volver a la linea seleccionada
        </button>
      </SectionCard>
    </div>
  );
}
