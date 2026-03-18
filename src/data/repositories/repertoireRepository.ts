import type { RepertoireLine } from '@/domain/repertoire';
import { getAllRecords, putRecord } from './browserDb';

export class RepertoireRepository {
  async loadAll(): Promise<RepertoireLine[]> {
    return getAllRecords<RepertoireLine>('repertoires');
  }

  async save(line: RepertoireLine): Promise<void> {
    await putRecord('repertoires', line);
  }
}
