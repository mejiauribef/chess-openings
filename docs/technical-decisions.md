# Decisiones tecnicas

1. `React + TypeScript + Vite` como base por velocidad de iteracion y build estatico offline.
2. `chess.js` como fuente de verdad para SAN, UCI, FEN y legalidad.
3. `react-chessboard` para UI del tablero sin acoplar el dominio al componente.
4. `Zustand` para estado local ligero y facil de hidratar desde IndexedDB.
5. `IndexedDB` envuelta en repositorios para mantener la persistencia fuera del dominio.
6. `Zod` como barrera de entrada para datasets generados, PGN importado y settings.
7. Pipeline separada en `scripts/` para sample/full mode y regeneracion determinista.
8. `epd` como clave canonica de transposicion.
9. Tarjetas y scheduler implementados como funciones puras para que Vitest cubra la logica critica.
10. Sin backend en v1; toda colaboracion o sync futura debera entrar como modulo posterior.
11. Los assets runtime usan `manifest + catalogo compacto + slices por bucket` para reducir el costo de arranque.
12. El runtime cachea catalogo y slices versionados en IndexedDB para acelerar relanzamientos offline.
13. El listado de catalogo usa busqueda diferida y render paginado para no bloquear el hilo principal con el dataset full.
14. La Fase 3 usa un solo grafo como fuente para `Learn`, `Recall`, `Case Training` y `Mixed Review`, evitando duplicar estado.
15. El progreso se persiste solo como `ReviewState` local; las metricas se recalculan desde el grafo y las tarjetas para evitar deriva.
16. La Fase 4 agrega quizzes de nomenclatura y transposicion sin crear un segundo modelo: reutiliza `TrainingCard` con `prompt`, `payload` y `answerOptions`.
17. La teoria editable se persiste como notas por nodo con `markdown`, `tags` y `linkedNodeIds`, manteniendo navegacion directa entre posiciones relacionadas.
18. La Fase 5 agrega `openings.bootstrap.json` para que la app arranque con una linea real cargada antes de hidratar el bucket completo.
19. Los slices grandes del runtime usan chequeos estructurales ligeros en vez de `Zod.parse` profundo, porque la validacion fuerte ya ocurre en la pipeline reproducible.
20. La generacion de tarjetas precomputa opciones de nomenclatura, notacion y transposicion por grafo para evitar costos cuadraticos al entrar a entrenamiento.
21. `App` calcula el snapshot base de entrenamiento una sola vez y lo comparte con la vista de entrenamiento para evitar trabajo duplicado.
22. Los E2E se endurecen con helpers de navegacion e interaccion para validar shell, entrenamiento, teoria y persistencia local con dataset full.
