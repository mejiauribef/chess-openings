# Fuentes locales para modo full

La pipeline full ya esta implementada. Para ejecutarla solo faltan los datasets en disco, sin depender de red en runtime.

## Opcion A: `lichess-org/chess-openings`

Coloca el checkout o una copia exportada en:

```text
data/sources/lichess-org/chess-openings/
```

Formatos soportados por el importador:

- TSV en la raiz con columnas `eco`, `name`, `pgn`
- TSV en `dist/` con columnas `eco`, `name`, `pgn`, `uci`, `epd`

El script fusiona ambos layouts y, si faltan `uci` o `epd`, los deriva desde `pgn`.

## Opcion B: `eco.json`

Coloca los archivos en:

```text
data/sources/eco-json/
```

Formatos soportados:

- `eco.json` o `eco*.json`
- `fromTo.json` opcional para transiciones explicitas

Cada `eco*.json` debe mapear `FEN/EPD -> { eco, name, moves, aliases? }`.

## Comandos

```bash
corepack pnpm data:full
```

Eso ejecuta:

1. importacion base desde Lichess
2. mezcla de aliases y transiciones desde `eco.json`
3. construccion del grafo persistido en `data/generated/openings.graph.json`

## Artefactos generados

- `data/generated/openings.base.json`
- `data/generated/openings.aliases.json`
- `data/generated/openings.transitions.json`
- `data/generated/openings.graph.json`

