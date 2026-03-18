import { Chess } from 'chess.js';
import type { TheoryNote } from '@/domain/opening';
import type { RepertoireLine } from '@/domain/repertoire';
import { normalizeFenToEpd } from '@/domain/notation';
import { toNodeIdFromEpd } from './openingGraph';

const PGN_RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

function stripHeaders(pgn: string): string {
  return pgn
    .split('\n')
    .filter((line) => !line.trim().startsWith('['))
    .join(' ');
}

function stripVariations(input: string): string {
  let depth = 0;
  let output = '';

  for (const character of input) {
    if (character === '(') {
      depth += 1;
      continue;
    }

    if (character === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0) {
      output += character;
    }
  }

  return output;
}

function tokenizeMovetext(input: string): string[] {
  return input.match(/\{[^}]*\}|[^\s]+/g) ?? [];
}

function isMoveNumber(token: string): boolean {
  return /^\d+\.(\.\.)?$/.test(token);
}

export interface ImportedPgnPayload {
  repertoireLine: RepertoireLine;
  theoryNotes: TheoryNote[];
  sanMoves: string[];
}

export function importPgnRepertoire(
  pgn: string,
  options: {
    color: RepertoireLine['color'];
    rootOpeningId?: string;
    id?: string;
  },
): ImportedPgnPayload {
  const movetext = stripVariations(stripHeaders(pgn));
  const tokens = tokenizeMovetext(movetext);
  const chess = new Chess();
  const theoryNotes: TheoryNote[] = [];
  const sanMoves: string[] = [];
  const uciMoves: string[] = [];
  let lastNodeId: string | null = null;

  for (const token of tokens) {
    if (token.startsWith('{') && token.endsWith('}')) {
      const summary = token.slice(1, -1).trim();
      if (summary && lastNodeId) {
        theoryNotes.push({
          id: `${lastNodeId}-pgn-note-${theoryNotes.length + 1}`,
          nodeId: lastNodeId,
          title: 'PGN import note',
          summary,
          markdown: summary,
          keyIdeasWhite: [],
          keyIdeasBlack: [],
          plans: [],
          traps: [],
          motifs: [],
          pawnStructures: [],
          tags: ['plan'],
          linkedNodeIds: [],
          references: [],
          provenance: 'pgn-comment',
          license: 'user',
        });
      }
      continue;
    }

    if (isMoveNumber(token) || PGN_RESULT_TOKENS.has(token) || token.startsWith('$')) {
      continue;
    }

    const move = chess.move(token, { strict: false });
    if (!move) {
      throw new Error(`Could not parse SAN token "${token}"`);
    }

    sanMoves.push(move.san);
    uciMoves.push(`${move.from}${move.to}${move.promotion ?? ''}`);
    lastNodeId = toNodeIdFromEpd(normalizeFenToEpd(chess.fen()));
  }

  return {
    repertoireLine: {
      id: options.id ?? `repertoire-${Date.now()}`,
      color: options.color,
      rootOpeningId: options.rootOpeningId ?? 'user-import',
      movePath: uciMoves,
      tags: ['imported-pgn'],
      priority: 1,
      enabled: true,
    },
    theoryNotes,
    sanMoves,
  };
}

export function exportRepertoireAsJson(lines: RepertoireLine[]): string {
  return JSON.stringify(
    lines
      .filter((line) => line.enabled)
      .map((line) => ({
        ...line,
        exportedAt: new Date().toISOString(),
      })),
    null,
    2,
  );
}

export function exportRepertoireAsPgn(lines: RepertoireLine[]): string {
  return lines
    .filter((line) => line.enabled)
    .map((line, index) => {
      const chess = new Chess();
      const sanTokens: string[] = [];

      line.movePath.forEach((uci, moveIndex) => {
        const move = chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: (uci[4] as 'n' | 'b' | 'r' | 'q' | undefined) ?? undefined,
        });
        if (!move) {
          throw new Error(`Illegal UCI move "${uci}" while exporting repertoire`);
        }

        if (moveIndex % 2 === 0) {
          sanTokens.push(`${Math.floor(moveIndex / 2) + 1}. ${move.san}`);
        } else {
          sanTokens.push(move.san);
        }
      });

      return `[Event "Repertoire Export ${index + 1}"]\n[Result "*"]\n\n${sanTokens.join(' ')} *`;
    })
    .join('\n\n');
}
