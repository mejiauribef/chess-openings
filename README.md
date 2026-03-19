# Chess Openings Local First

Aplicacion local-first para aprender aperturas de ajedrez con catalogo, explorador por posicion, entrenamiento y pipeline reproducible de datos.

La UX principal ahora esta centrada en una sola pantalla de estudio:

- eliges una apertura o familia,
- el sistema arma un curso con sus subvariantes utiles,
- practicas desde el mismo workspace,
- y dejas repertorio, teoria y ajustes avanzados en paneles expandibles.

## Stack

- React + TypeScript + Vite
- `react-chessboard`
- `chess.js`
- Zustand
- IndexedDB
- Zod
- Vitest
- Playwright

## Estado del repo

Este repo ya incluye:

- scaffold modular,
- datos sample y full pipeline operativa,
- pipeline reproducible en `scripts/`,
- grafo persistido en `data/generated/openings.graph.json`,
- manifest runtime y slices por bucket en `data/generated/openings.manifest.json` y `data/generated/slices/`,
- repertorios editables/importables/exportables en local,
- cache local de assets runtime en IndexedDB para relanzamientos mas rapidos,
- entrenamiento local con `Learn`, `Recall`, `Case Training` y `Mixed Review`,
- `Nomenclature Quiz` y `Transposition Quiz`,
- editor local de teoria con markdown, tags y enlaces entre posiciones,
- metricas de progreso con cobertura, errores, retention, estabilidad y heatmap,
- bootstrap inicial con `openings.bootstrap.json` para abrir una linea entrenable desde el primer render,
- workspace principal de estudio enfocado en una apertura/familia a la vez,
- estados vacios guiados para evitar mazos triviales o cursos sin carga suficiente,
- tests de transposiciones, PGN, importadores y entrenamiento,
- flujos criticos E2E para shell, entrenamiento, teoria y persistencia tras reload,
- documentacion de arquitectura y roadmap.

## Instalacion

La maquina actual no tiene `npm` utilizable, asi que el flujo recomendado es con `pnpm` via `corepack`.

```bash
corepack enable
corepack prepare pnpm@10.20.0 --activate
corepack pnpm install
```

## Desarrollo

```bash
corepack pnpm dev
```

## Build

```bash
corepack pnpm build
corepack pnpm preview
```

## Tests

```bash
corepack pnpm test
corepack pnpm test:e2e
```

## Regeneracion de datasets

Modo sample:

```bash
corepack pnpm data:sample
```

Modo full:

```bash
corepack pnpm data:full
```

Auditoria del dataset actual:

```bash
corepack pnpm data:audit
```

La pipeline full genera:

- `openings.catalog.json` en formato compacto para arranque rapido,
- `openings.bootstrap.json` con una linea inicial util para primer render offline,
- `openings.manifest.json` para versionar assets y cache local,
- `openings.audit.json` con resumen reproducible de cobertura por familia, profundidad y fuentes,
- `slices/graph-*.json` y `slices/openings-*.json` para carga por bucket ECO.

Los layouts exactos esperados por la pipeline full estan documentados en [data/sources/README.md](data/sources/README.md).

El runtime no consulta servicios remotos.

## Limites actuales

- El dataset full sigue siendo grande, aunque el runtime ya arranca con catalogo compacto, bootstrap inicial, cache local y slices por bucket.
- La validacion profunda de assets se mantiene en la pipeline; el runtime usa chequeos ligeros para no bloquear el hilo principal con slices grandes.
- La teoria textual sigue siendo una estructura abierta con seeds y notas locales; no se inventa corpus masivo.
- No hay backend ni sync remota en v1: toda la persistencia depende de assets locales e IndexedDB.
