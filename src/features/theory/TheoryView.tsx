import { useMemo, useState } from 'react';
import type { TheoryNote } from '@/domain/opening';
import type { OpeningGraph } from '@/domain/position';
import { findPathToNode, getNodeLabels } from '@/lib/chess/openingGraph';
import { renderMarkdown } from '@/lib/markdown/renderMarkdown';
import { BoardPanel } from '@/components/BoardPanel';
import { EmptyStatePanel } from '@/components/EmptyStatePanel';
import { SectionCard } from '@/components/SectionCard';

const THEORY_TAGS = ['plan', 'trap', 'tactic', 'pawn-structure', 'endgame-transition'] as const;

interface TheoryViewProps {
  graph: OpeningGraph;
  selectedNodeId?: string;
  theoryNotes: TheoryNote[];
  onSelectNode: (nodeId: string) => void;
  onSaveNote: (note: TheoryNote) => Promise<TheoryNote>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onOpenCatalog: () => void;
}

interface TheoryFormState {
  id?: string;
  title: string;
  summary: string;
  markdown: string;
  tags: string[];
  linkedNodeIds: string[];
  plans: string;
  traps: string;
  motifs: string;
  pawnStructures: string;
  keyIdeasWhite: string;
  keyIdeasBlack: string;
  references: string;
}

function splitList(value: string): string[] {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinList(values: string[]): string {
  return values.join('\n');
}

function createEmptyForm(nodeId?: string): TheoryFormState {
  void nodeId;

  return {
    title: '',
    summary: '',
    markdown: '',
    tags: [],
    linkedNodeIds: [],
    plans: '',
    traps: '',
    motifs: '',
    pawnStructures: '',
    keyIdeasWhite: '',
    keyIdeasBlack: '',
    references: '',
  };
}

function toFormState(note: TheoryNote): TheoryFormState {
  return {
    id: note.id,
    title: note.title,
    summary: note.summary,
    markdown: note.markdown,
    tags: note.tags,
    linkedNodeIds: note.linkedNodeIds,
    plans: joinList(note.plans),
    traps: joinList(note.traps),
    motifs: joinList(note.motifs),
    pawnStructures: joinList(note.pawnStructures),
    keyIdeasWhite: joinList(note.keyIdeasWhite),
    keyIdeasBlack: joinList(note.keyIdeasBlack),
    references: joinList(note.references),
  };
}

export function TheoryView({
  graph,
  selectedNodeId,
  theoryNotes,
  onSelectNode,
  onSaveNote,
  onDeleteNote,
  onOpenCatalog,
}: TheoryViewProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string>();
  const [draft, setDraft] = useState<{ key: string; form: TheoryFormState }>({
    key: 'initial',
    form: createEmptyForm(),
  });
  const nodeNotes = useMemo(
    () => theoryNotes.filter((note) => note.nodeId === selectedNodeId),
    [selectedNodeId, theoryNotes],
  );
  const resolvedSelectedNoteId =
    nodeNotes.find((note) => note.id === selectedNoteId)?.id ?? nodeNotes[0]?.id;
  const activeNote = nodeNotes.find((note) => note.id === resolvedSelectedNoteId) ?? nodeNotes[0];
  const formKey = `${selectedNodeId ?? 'none'}::${resolvedSelectedNoteId ?? 'new'}`;
  const form =
    draft.key === formKey
      ? draft.form
      : activeNote
        ? toFormState(activeNote)
        : createEmptyForm(selectedNodeId);

  function replaceForm(nextForm: TheoryFormState, nextSelectedNoteId = resolvedSelectedNoteId): void {
    const nextKey = `${selectedNodeId ?? 'none'}::${nextSelectedNoteId ?? 'new'}`;
    setDraft({
      key: nextKey,
      form: nextForm,
    });
  }

  function updateForm(updater: (current: TheoryFormState) => TheoryFormState): void {
    replaceForm(updater(form));
  }

  if (!selectedNodeId || !graph.nodes[selectedNodeId]) {
    return (
      <SectionCard title="Teoria local">
        <EmptyStatePanel
          title="No hay posicion activa para documentar"
          description="Las notas teoricas viven en nodos del grafo. Primero necesitamos abrir una apertura o navegar una posicion desde el explorador."
          tips={[
            'Selecciona una apertura en Catalogo para cargar su linea base.',
            'Desde Explorador puedes avanzar a cualquier rama y luego abrir Teoria.',
          ]}
          actions={[
            { label: 'Ir al catalogo', onClick: onOpenCatalog },
          ]}
        />
      </SectionCard>
    );
  }

  const currentNodeId = selectedNodeId;
  const node = graph.nodes[currentNodeId];
  const path = findPathToNode(graph, currentNodeId) ?? { uciMoves: [], sanMoves: [] };
  const labels = getNodeLabels(graph, currentNodeId);
  const suggestedLinks = [
    ...node.parentIds,
    ...node.childEdges.map((edge) => edge.toNodeId),
    ...Object.keys(graph.nodes).filter(
      (candidate) => candidate !== currentNodeId && graph.nodes[candidate]?.transpositionGroupId === node.transpositionGroupId,
    ),
  ]
    .filter((candidate, index, values) => values.indexOf(candidate) === index)
    .slice(0, 8);

  async function handleSave() {
    const saved = await onSaveNote({
      id: form.id,
      nodeId: currentNodeId,
      title: form.title || 'Nota teorica',
      summary: form.summary || form.markdown.split('\n').find(Boolean) || 'Nota sin resumen',
      markdown: form.markdown || form.summary,
      keyIdeasWhite: splitList(form.keyIdeasWhite),
      keyIdeasBlack: splitList(form.keyIdeasBlack),
      plans: splitList(form.plans),
      traps: splitList(form.traps),
      motifs: splitList(form.motifs),
      pawnStructures: splitList(form.pawnStructures),
      tags: form.tags,
      linkedNodeIds: form.linkedNodeIds,
      references: splitList(form.references),
      provenance: activeNote?.provenance ?? 'manual',
      license: activeNote?.license ?? 'user',
    });

    setSelectedNoteId(saved.id ?? undefined);
    replaceForm(toFormState(saved), saved.id);
  }

  async function handleDelete() {
    if (!form.id) {
      replaceForm(createEmptyForm(currentNodeId), undefined);
      return;
    }

    await onDeleteNote(form.id);
    setSelectedNoteId(undefined);
    replaceForm(createEmptyForm(currentNodeId), undefined);
  }

  return (
    <div className="feature-grid">
      <SectionCard title="Teoria por posicion" eyebrow={`Nodo ${currentNodeId}`}>
        <div className="detail-meta">
          <p>
            <strong>Clasificaciones:</strong> {labels.canonicalNames.join(' / ') || 'Sin nombre'}
          </p>
          <p>
            <strong>Breadcrumbs:</strong> {path.sanMoves.join(' ') || 'Posicion inicial'}
          </p>
          <p>
            <strong>EPD:</strong> {node.epd}
          </p>
        </div>

        <BoardPanel title="Posicion seleccionada" uciMoves={path.uciMoves} />

        <div className="chip-row">
          {labels.aliases.map((alias) => (
            <span key={alias} className="chip chip--muted">
              {alias}
            </span>
          ))}
        </div>

        <article className="info-panel">
          <h3>Notas guardadas</h3>
          {nodeNotes.length > 0 ? (
            <div className="stack-list">
              {nodeNotes.map((note) => (
                <button
                  key={note.id ?? `${note.nodeId}-${note.title}`}
                  type="button"
                  className={`opening-list__item ${selectedNoteId === note.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setSelectedNoteId(note.id ?? undefined);
                    replaceForm(toFormState(note), note.id);
                  }}
                >
                  <strong>{note.title}</strong>
                  <span>{note.summary}</span>
                  <code>{note.tags.join(', ') || 'sin tags'}</code>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-state">Aun no hay notas para esta posicion. Puedes crear una abajo.</p>
          )}
        </article>
      </SectionCard>

      <SectionCard title="Editor de teoria" eyebrow={activeNote ? 'Editando nota' : 'Nueva nota'}>
        <label className="field">
          <span>Titulo</span>
          <input
            type="text"
            value={form.title}
            onChange={(event) => updateForm((state) => ({ ...state, title: event.target.value }))}
            placeholder="Ej: Plan tipico contra la Caro-Kann"
          />
        </label>

        <label className="field">
          <span>Resumen corto</span>
          <textarea
            value={form.summary}
            onChange={(event) => updateForm((state) => ({ ...state, summary: event.target.value }))}
            rows={3}
            placeholder="Resumen visible en catalogo y entrenamiento"
          />
        </label>

        <label className="field">
          <span>Markdown</span>
          <textarea
            value={form.markdown}
            onChange={(event) => updateForm((state) => ({ ...state, markdown: event.target.value }))}
            rows={10}
            placeholder={'# Idea clave\n- Plan principal\n- Trampa comun\n\nUsa **markdown** y `codigo` si hace falta.'}
          />
        </label>

        <div className="detail-grid">
          <label className="field">
            <span>Planes</span>
            <textarea
              value={form.plans}
              onChange={(event) => updateForm((state) => ({ ...state, plans: event.target.value }))}
              rows={4}
              placeholder="Una linea por plan"
            />
          </label>

          <label className="field">
            <span>Trampas</span>
            <textarea
              value={form.traps}
              onChange={(event) => updateForm((state) => ({ ...state, traps: event.target.value }))}
              rows={4}
              placeholder="Una linea por trampa"
            />
          </label>

          <label className="field">
            <span>Motivos</span>
            <textarea
              value={form.motifs}
              onChange={(event) => updateForm((state) => ({ ...state, motifs: event.target.value }))}
              rows={4}
              placeholder="Pins, forks, breaks..."
            />
          </label>

          <label className="field">
            <span>Estructuras de peones</span>
            <textarea
              value={form.pawnStructures}
              onChange={(event) => updateForm((state) => ({ ...state, pawnStructures: event.target.value }))}
              rows={4}
              placeholder="Una linea por estructura"
            />
          </label>

          <label className="field">
            <span>Ideas de blancas</span>
            <textarea
              value={form.keyIdeasWhite}
              onChange={(event) => updateForm((state) => ({ ...state, keyIdeasWhite: event.target.value }))}
              rows={4}
            />
          </label>

          <label className="field">
            <span>Ideas de negras</span>
            <textarea
              value={form.keyIdeasBlack}
              onChange={(event) => updateForm((state) => ({ ...state, keyIdeasBlack: event.target.value }))}
              rows={4}
            />
          </label>
        </div>

        <label className="field">
          <span>Referencias</span>
          <textarea
            value={form.references}
            onChange={(event) => updateForm((state) => ({ ...state, references: event.target.value }))}
            rows={3}
            placeholder="Una referencia por linea"
          />
        </label>

        <article className="info-panel">
          <h3>Etiquetas</h3>
          <div className="chip-row">
            {THEORY_TAGS.map((tag) => {
              const isActive = form.tags.includes(tag);

              return (
                <button
                  key={tag}
                  type="button"
                  className={`chip-button ${isActive ? 'is-active' : ''}`}
                  onClick={() =>
                    updateForm((state) => ({
                      ...state,
                      tags: isActive
                        ? state.tags.filter((candidate) => candidate !== tag)
                        : [...state.tags, tag],
                    }))
                  }
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </article>

        <article className="info-panel">
          <h3>Enlaces entre posiciones</h3>
          <div className="chip-row">
            {suggestedLinks.map((linkNodeId) => (
              <button
                key={linkNodeId}
                type="button"
                className={`chip-button ${form.linkedNodeIds.includes(linkNodeId) ? 'is-active' : ''}`}
                onClick={() =>
                  updateForm((state) => ({
                    ...state,
                    linkedNodeIds: state.linkedNodeIds.includes(linkNodeId)
                      ? state.linkedNodeIds.filter((candidate) => candidate !== linkNodeId)
                      : [...state.linkedNodeIds, linkNodeId],
                  }))
                }
              >
                {linkNodeId}
              </button>
            ))}
          </div>

          {form.linkedNodeIds.length > 0 ? (
            <div className="stack-list">
              {form.linkedNodeIds.map((linkNodeId) => (
                <button
                  key={`open-${linkNodeId}`}
                  type="button"
                  className="opening-list__item"
                  onClick={() => onSelectNode(linkNodeId)}
                >
                  <strong>{linkNodeId}</strong>
                  <span>Ir a la posicion enlazada</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-state">Sin enlaces aun. Usa los nodos sugeridos o navega a otra posicion y enlazala.</p>
          )}
        </article>

        <div className="button-row">
          <button type="button" onClick={() => void handleSave()}>
            Guardar nota
          </button>
          <button type="button" className="secondary-button" onClick={() => void handleDelete()}>
            {form.id ? 'Eliminar nota' : 'Limpiar formulario'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setSelectedNoteId(undefined);
              replaceForm(createEmptyForm(currentNodeId), undefined);
            }}
          >
            Nueva nota
          </button>
        </div>

        <article className="info-panel">
          <h3>Preview markdown</h3>
          <div
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(form.markdown || form.summary) }}
          />
        </article>
      </SectionCard>
    </div>
  );
}
