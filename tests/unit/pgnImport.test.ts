import { exportRepertoireAsJson, importPgnRepertoire } from '@/lib/chess/pgn';

describe('pgn import/export', () => {
  it('preserves comments as theory notes', () => {
    const imported = importPgnRepertoire(
      '[Event "Example"]\n\n1. e4 {Fight for the center} c6 2. d4 d5 *',
      {
        color: 'white',
        id: 'line-1',
      },
    );

    expect(imported.theoryNotes).toHaveLength(1);
    expect(imported.theoryNotes[0]?.summary).toContain('Fight for the center');
    expect(imported.theoryNotes[0]?.markdown).toContain('Fight for the center');
    expect(imported.theoryNotes[0]?.tags).toContain('plan');
  });

  it('exports enabled repertoire branches without losing them', () => {
    const output = exportRepertoireAsJson([
      {
        id: 'enabled-line',
        color: 'white',
        rootOpeningId: 'caro-kann',
        movePath: ['e2e4', 'c7c6', 'd2d4', 'd7d5'],
        tags: ['main-line'],
        priority: 1,
        enabled: true,
      },
      {
        id: 'disabled-line',
        color: 'white',
        rootOpeningId: 'caro-kann',
        movePath: ['e2e4', 'c7c6'],
        tags: ['sideline'],
        priority: 2,
        enabled: false,
      },
    ]);

    expect(output).toContain('enabled-line');
    expect(output).not.toContain('disabled-line');
  });
});
