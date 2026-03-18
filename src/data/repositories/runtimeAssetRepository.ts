import { getRecord, putRecord } from './browserDb';

interface StoredRuntimeAsset<T> {
  id: string;
  version: string;
  value: T;
}

export class RuntimeAssetRepository {
  async load<T>(id: string, version: string): Promise<T | undefined> {
    const record = await getRecord<StoredRuntimeAsset<T>>('runtimeAssets', id);
    return record?.version === version ? record.value : undefined;
  }

  async save<T>(id: string, version: string, value: T): Promise<void> {
    await putRecord<StoredRuntimeAsset<T>>('runtimeAssets', {
      id,
      version,
      value,
    });
  }
}
