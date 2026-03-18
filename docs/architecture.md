# Arquitectura

## Objetivo

Aplicacion local-first para estudiar aperturas de ajedrez con unidad de verdad basada en posicion, no en secuencia lineal. El runtime no depende de backend en v1 y prioriza:

- modelo de datos correcto,
- transposiciones reales,
- persistencia offline,
- importacion reproducible,
- separacion estricta entre dominio, datos y UI.

## Capas

### Dominio

- `OpeningEntry`: apertura nombrada o rama importada.
- `PositionNode`: nodo canonico indexado por `epd`.
- `MoveEdge`: arista entre posiciones con metadatos de origen.
- `TheoryNote`: teoria asociada a posicion.
- `RepertoireLine`: linea entrenable del usuario.
- `TrainingCard` y `ReviewState`: capa de entrenamiento y repeticion espaciada.

### Datos

- `scripts/`: pipeline reproducible de importacion y normalizacion.
- `data/generated/`: artefactos runtime listos para servir offline.
- `src/data/adapters/`: carga de JSON generado + semillas locales.
- `src/data/repositories/`: acceso a IndexedDB con contratos estables.
- `src/data/mappers/`: transformaciones entre persistencia y dominio.

### Aplicacion

- `src/features/openings-catalog`: busqueda, filtros y detalle inicial.
- `src/features/opening-explorer`: navegacion por posicion y transposiciones.
- `src/features/training`: tarjetas, feedback y scheduler local.
- `src/features/repertoire`: import/export y gestion de lineas del usuario.
- `src/features/theory`: notas por posicion.
- `src/features/settings`: controles de configuracion local.

### UI

- `react-chessboard` para tablero.
- Layout responsive y navegable por teclado.
- Estados vacios utiles con datos seed.

## Flujo de datos

1. `scripts/import-lichess-openings.ts` normaliza nombres, ECO, PGN, UCI y posiciones finales.
2. `scripts/import-eco-json.ts` incorpora variaciones, aliases y transposiciones.
3. `scripts/build-opening-graph.ts` colapsa secuencias a nodos por `epd`.
4. La pipeline emite `openings.manifest.json`, un catalogo compacto y slices por bucket ECO.
5. La pipeline emite tambien `openings.bootstrap.json` para dejar una linea inicial entrenable sin esperar el bucket completo.
6. El runtime carga primero `openings.manifest.json`, `openings.catalog.json` y el bootstrap.
7. `generatedOpeningsAdapter` mantiene validacion fuerte para assets pequenos y chequeos ligeros para slices grandes.
8. `OpeningRepository` cachea catalogo y slices en IndexedDB por version del dataset.
9. El store de Zustand expone catalogo, grafo, settings y progreso.
10. Los repositorios persistentes guardan settings, repertorios, teoria, review state y cache runtime en IndexedDB.

## Estructura

```text
/src
  /app
  /features
    /openings-catalog
    /opening-explorer
    /training
    /repertoire
    /theory
    /settings
  /domain
    opening.ts
    position.ts
    notation.ts
    training.ts
    repertoire.ts
  /data
    /adapters
    /repositories
    /mappers
  /components
  /lib
    /chess
    /search
    /training
  /workers
/scripts
/data/generated
/docs
/tests
```

## Decisiones de arquitectura

- La identidad canonica de una posicion es `epd`, no `fen` completo.
- El grafo runtime se puede regenerar desde `openings.base.json` en modo sample o full.
- Los comentarios PGN se transforman en `TheoryNote` con `provenance`.
- El store no conoce detalles de IndexedDB; consume repositorios.
- Las reglas de entrenamiento se expresan como funciones puras para testearlas fuera de React.
- La sesion de entrenamiento deriva mazos por modo (`Learn`, `Recall`, `Case`, `Nomenclature`, `Transposition`, `Mixed`) desde el mismo grafo.
- El scheduler y las metricas se calculan con funciones puras sobre `TrainingCard` y `ReviewState`.
- La teoria se asocia a posicion y puede extenderse luego a movimiento sin romper el modelo.
- Las notas teoricas soportan markdown, tags y enlaces directos a otros nodos del grafo.
- El catalogo inicial usa un formato compacto y el detalle completo se hidrata bajo demanda por bucket.
- La carga incremental del grafo evita reindexaciones globales en cada bucket nuevo.
- El arranque usa un bootstrap slice pequeno para que catalogo, teoria y entrenamiento tengan una posicion real desde el primer render.
- El entrenamiento precomputa indices de distracciones/notacion/transposicion una sola vez por grafo para mantener la UI interactiva con dataset full.
- `App` y `TrainingView` comparten el snapshot base de tarjetas/metricas para no duplicar calculo pesado.

## Limitaciones conscientes

- El repo soporta sample y full mode; el sample sigue siendo el modo mas rapido para iterar durante desarrollo.
- La teoria textual masiva no se inventa; se dejan seeds y estructura abierta.
- No hay backend ni sincronizacion remota en v1; toda resiliencia offline depende de assets locales y IndexedDB.
