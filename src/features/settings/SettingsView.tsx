import type { TrainingSettings } from '@/domain/training';
import { SectionCard } from '@/components/SectionCard';

interface SettingsViewProps {
  settings: TrainingSettings;
  onChange: (partial: Partial<TrainingSettings>) => void;
}

export function SettingsView({ settings, onChange }: SettingsViewProps) {
  return (
    <SectionCard title="Configuracion local">
      <div className="settings-grid">
        <article className="info-panel">
          <h3>Presets utiles</h3>
          <div className="button-row">
            <button
              type="button"
              onClick={() =>
                onChange({
                  maximumDepth: 10,
                  includeSidelines: true,
                  catalogScope: 'catalog',
                  hintsEnabled: true,
                  opponentDelay: 800,
                  autoRetryDelay: 2000,
                })
              }
            >
              Aprendizaje guiado
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                onChange({
                  maximumDepth: 14,
                  includeSidelines: false,
                  catalogScope: 'repertoire',
                  hintsEnabled: false,
                  opponentDelay: 300,
                  autoRetryDelay: 800,
                })
              }
            >
              Drill rapido
            </button>
          </div>
        </article>

        <label className="field">
          <span>Profundidad maxima</span>
          <input
            type="number"
            min={1}
            max={32}
            value={settings.maximumDepth}
            onChange={(event) => { const v = Number(event.target.value); if (Number.isFinite(v)) { onChange({ maximumDepth: v }); } }}
          />
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.includeSidelines}
            onChange={(event) => onChange({ includeSidelines: event.target.checked })}
          />
          <span>Incluir sidelines</span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.hintsEnabled}
            onChange={(event) => onChange({ hintsEnabled: event.target.checked })}
          />
          <span>Hints activados</span>
        </label>

        <label className="field">
          <span>Alcance del entrenamiento</span>
          <select
            value={settings.catalogScope}
            onChange={(event) =>
              onChange({ catalogScope: event.target.value as TrainingSettings['catalogScope'] })
            }
          >
            <option value="catalog">Catalogo completo cargado</option>
            <option value="repertoire">Solo repertorio habilitado</option>
          </select>
        </label>

        <label className="field">
          <span>Color a entrenar</span>
          <select
            value={settings.trainingColor}
            onChange={(event) =>
              onChange({ trainingColor: event.target.value as TrainingSettings['trainingColor'] })
            }
          >
            <option value="both">Ambos</option>
            <option value="white">Solo blancas</option>
            <option value="black">Solo negras</option>
          </select>
        </label>

        <label className="field">
          <span>Delay del oponente (ms)</span>
          <input
            type="number"
            min={200}
            max={2000}
            step={100}
            value={settings.opponentDelay}
            onChange={(event) => { const v = Number(event.target.value); if (Number.isFinite(v)) { onChange({ opponentDelay: v }); } }}
          />
        </label>

        <label className="field">
          <span>Delay de reintento (ms)</span>
          <input
            type="number"
            min={500}
            max={3000}
            step={100}
            value={settings.autoRetryDelay}
            onChange={(event) => { const v = Number(event.target.value); if (Number.isFinite(v)) { onChange({ autoRetryDelay: v }); } }}
          />
        </label>
      </div>
    </SectionCard>
  );
}
