import type { TrainingSettings } from '@/domain/training';
import { defaultTrainingSettings, trainingSettingsSchema } from '@/domain/training';
import { getRecord, putRecord } from './browserDb';

const SETTINGS_KEY = 'training-settings';

export class SettingsRepository {
  async load(): Promise<TrainingSettings> {
    const record = await getRecord<{ key: string; value: TrainingSettings }>('settings', SETTINGS_KEY);
    return trainingSettingsSchema.parse({
      ...defaultTrainingSettings,
      ...(record?.value ?? {}),
    });
  }

  async save(settings: TrainingSettings): Promise<void> {
    await putRecord('settings', { key: SETTINGS_KEY, value: settings });
  }
}
