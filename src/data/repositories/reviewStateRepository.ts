import type { ReviewState } from '@/domain/training';
import { getAllRecords, putRecord } from './browserDb';

export class ReviewStateRepository {
  async loadAll(): Promise<Record<string, ReviewState>> {
    const rows = await getAllRecords<ReviewState>('reviewState');
    return Object.fromEntries(rows.map((row) => [row.cardId, row]));
  }

  async save(reviewState: ReviewState): Promise<void> {
    await putRecord('reviewState', reviewState);
  }
}

