import { theoryNoteSchema, type TheoryNote } from '@/domain/opening';
import { deleteRecord, getAllRecords, putRecord } from './browserDb';

interface StoredTheoryNote {
  id: string;
  note: TheoryNote;
}

function toId(note: TheoryNote): string {
  return (note.id ?? `${note.nodeId}::${note.title}::${note.summary}`).slice(0, 240);
}

function normalizeTheoryNote(note: TheoryNote): TheoryNote {
  return theoryNoteSchema.parse({
    ...note,
    id: toId(note),
    markdown: note.markdown || note.summary,
  });
}

export class TheoryNotesRepository {
  async loadAll(): Promise<TheoryNote[]> {
    const rows = await getAllRecords<StoredTheoryNote>('theoryNotes');
    return rows.map((row) => normalizeTheoryNote(row.note));
  }

  async saveMany(notes: TheoryNote[]): Promise<void> {
    await Promise.all(
      notes.map((note) =>
        putRecord<StoredTheoryNote>('theoryNotes', {
          id: toId(note),
          note: normalizeTheoryNote(note),
        }),
      ),
    );
  }

  async save(note: TheoryNote): Promise<TheoryNote> {
    const normalized = normalizeTheoryNote(note);
    await putRecord<StoredTheoryNote>('theoryNotes', {
      id: normalized.id ?? toId(normalized),
      note: normalized,
    });
    return normalized;
  }

  async delete(noteId: string): Promise<void> {
    await deleteRecord('theoryNotes', noteId);
  }
}
