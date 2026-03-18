import { parseEcoJsonFiles } from '@/data/mappers/ecoJson';
import { parseLichessOpeningFiles } from '@/data/mappers/lichessOpenings';
import { buildOpeningGraph, mergeRepertoireLinesIntoGraph, resolveNodeIdFromUciLine } from '@/lib/chess/openingGraph';
import { sampleOpenings } from '../fixtures/sampleOpenings';

describe('phase 2 importers and graph extension', () => {
  it('merges lichess TSV roots with dist fields', () => {
    const openings = parseLichessOpeningFiles([
      {
        name: 'a.tsv',
        content: ['eco\tname\tpgn', 'C60\tRuy Lopez\t1. e4 e5 2. Nf3 Nc6 3. Bb5'].join('\n'),
      },
      {
        name: 'dist/a.tsv',
        content: [
          'eco\tname\tpgn\tuci\tepd',
          'C60\tRuy Lopez\t1. e4 e5 2. Nf3 Nc6 3. Bb5\te2e4 e7e5 g1f3 b8c6 f1b5\tr1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -',
        ].join('\n'),
      },
    ]);

    expect(openings).toHaveLength(1);
    expect(openings[0]?.uciMoves).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5']);
    expect(openings[0]?.epd).toContain('r1bqkbnr');
  });

  it('parses eco json aliases and from-to transitions', () => {
    const eco = parseEcoJsonFiles(
      [
        {
          name: 'ecoA.json',
          content: JSON.stringify({
            'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -': {
              eco: 'C60',
              name: 'Ruy Lopez',
              moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5',
              aliases: {
                short: 'Spanish Opening',
              },
              isEcoRoot: true,
            },
          }),
        },
      ],
      JSON.stringify([
        [
          'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -',
          'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -',
          'from',
          'to',
        ],
      ]),
    );

    expect(eco.openings[0]?.canonicalName).toBe('Ruy Lopez');
    expect(eco.aliasesByName['Ruy Lopez']).toContain('Spanish Opening');
    expect(eco.transitions[0]?.fromSource).toBe('from');
  });

  it('extends the graph with enabled repertoire lines', () => {
    const baseGraph = buildOpeningGraph(sampleOpenings);
    const graph = mergeRepertoireLinesIntoGraph(baseGraph, [
      {
        id: 'rep-1',
        color: 'white',
        rootOpeningId: 'caro-kann',
        movePath: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3'],
        tags: ['main-line'],
        priority: 2,
        enabled: true,
      },
    ]);

    const nodeId = resolveNodeIdFromUciLine(graph, ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3']);
    const node = graph.nodes[nodeId];
    const parent = graph.nodes[node.parentIds[0] ?? graph.rootNodeId];

    expect(node).toBeDefined();
    expect(parent.childEdges.some((edge) => edge.tags.includes('repertoire'))).toBe(true);
  });
});
