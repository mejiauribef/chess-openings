# Roadmap

## Estado actual

- `Fase 1` completada.
- `Fase 2` completada con dataset full y repertorios locales.
- `Fase 2.5` completada con optimizacion de arranque, catalogo compacto y carga incremental por bucket.
- `Fase 3` completada con modos Learn, Recall, Case Training, Mixed Review y metricas basicas.
- `Fase 4` completada con Nomenclature Quiz, Transposition Quiz, editor de teoria y metricas avanzadas.
- `Fase 5` completada con pulido UX, bootstrap inicial, optimizacion del entrenamiento y E2E finales.

## Fase 1

- [x] Scaffold React + TypeScript + Vite
- [x] Estructura modular por features, domain, data y workers
- [x] Datos sample generados y adaptador local
- [x] Catalogo inicial con busqueda por nombre/ECO/UCI
- [x] Explorador basico por posicion
- [x] Tablero funcional con `react-chessboard`
- [x] Tests de parsing, transposicion y scheduler
- [x] Instalacion real de dependencias y verificacion de lint, build y tests en esta maquina

## Fase 2

- [x] Grafo persistido en `data/generated/openings.graph.json`
- [x] Importacion real desde `lichess-org/chess-openings` con dataset full en disco
- [x] Importacion de transiciones desde `eco.json` con dataset full en disco
- [x] Repertorios editables y exportables
- [x] Detalle de apertura enriquecido por posicion y repertorio

## Fase 2.5

- [x] `openings.manifest.json` para versionado de assets runtime
- [x] Catalogo inicial en formato compacto
- [x] Slices `graph-*` y `openings-*` por bucket ECO
- [x] Cache de catalogo y slices en IndexedDB
- [x] Merge incremental del grafo sin reindexado global
- [x] Busqueda diferida y render acotado del catalogo full

## Fase 3

- [x] Learn con hints y explicacion corta por nodo
- [x] Recall con entrada SAN/UCI y feedback inmediato
- [x] Case training para responder a la jugada rival
- [x] Mixed Review adaptivo sobre tarjetas nuevas y vencidas
- [x] Scheduler persistido en IndexedDB
- [x] Metricas basicas y heatmap inicial

## Fase 4

- [x] Nomenclature quiz
- [x] Transposition quiz
- [x] Editor local de teoria
- [x] Enlaces entre posiciones y etiquetas
- [x] Metricas avanzadas

## Fase 5

- [x] Pulido UX
- [x] Estados vacios enriquecidos
- [x] Overview del workspace y shortcuts de teclado
- [x] Bootstrap inicial para una linea usable desde el primer render
- [x] Optimizacion de entrenamiento y eliminacion de calculos duplicados
- [x] E2E completos con Playwright
- [x] Documentacion final y limites del sistema
