interface WorkspaceOverviewProps {
  loadedOpenings: number;
  enabledRepertoireLines: number;
  theoryNotes: number;
  dueCards: number;
}

const SHORTCUTS = ['Alt+1 Catalogo', 'Alt+2 Explorador', 'Alt+3 Entrenamiento', '/ Buscar'];

export function WorkspaceOverview({
  loadedOpenings,
  enabledRepertoireLines,
  theoryNotes,
  dueCards,
}: WorkspaceOverviewProps) {
  return (
    <section className="workspace-overview" aria-label="Estado del workspace">
      <article className="workspace-overview__card">
        <span>Catalogo</span>
        <strong>{loadedOpenings}</strong>
        <small>aperturas cargadas</small>
      </article>

      <article className="workspace-overview__card">
        <span>Repertorio</span>
        <strong>{enabledRepertoireLines}</strong>
        <small>lineas activas</small>
      </article>

      <article className="workspace-overview__card">
        <span>Teoria</span>
        <strong>{theoryNotes}</strong>
        <small>notas locales</small>
      </article>

      <article className="workspace-overview__card">
        <span>Review</span>
        <strong>{dueCards}</strong>
        <small>tarjetas vencidas</small>
      </article>

      <article className="workspace-overview__card workspace-overview__card--wide">
        <span>Atajos</span>
        <strong>Teclado listo</strong>
        <small>{SHORTCUTS.join(' | ')}</small>
      </article>
    </section>
  );
}
