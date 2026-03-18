import { Chess } from 'chess.js';
import type { OpeningEntry } from '@/domain/opening';
import { normalizeFenToEpd } from '@/domain/notation';

interface ParsedTsvFile {
  header: string[];
  rows: string[][];
}

interface LichessInputFile {
  name: string;
  content: string;
}

interface MergedOpeningSeed {
  eco: string;
  name: string;
  pgn: string;
  uci?: string;
  epd?: string;
}

function sanitizeCell(value: string): string {
  return value.replace(/^"|"$/g, '').trim();
}

export function parseTsvFile(content: string): ParsedTsvFile {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { header: [], rows: [] };
  }

  const [headerLine, ...rowLines] = lines;
  const header = headerLine.split('\t').map((cell) => sanitizeCell(cell).toLowerCase());
  const rows = rowLines.map((line) => line.split('\t').map((cell) => sanitizeCell(cell)));

  return { header, rows };
}

function tokenizePgnMoves(pgn: string): string[] {
  return pgn
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\d+\.(\.\.)?/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !['1-0', '0-1', '1/2-1/2', '*'].includes(token));
}

function pgnToUciMoves(pgn: string): { uciMoves: string[]; fen: string; epd: string } {
  const chess = new Chess();
  const uciMoves: string[] = [];

  for (const san of tokenizePgnMoves(pgn)) {
    const move = chess.move(san, { strict: false });
    if (!move) {
      throw new Error(`No se pudo convertir SAN a UCI: ${san}`);
    }

    uciMoves.push(`${move.from}${move.to}${move.promotion ?? ''}`);
  }

  return {
    uciMoves,
    fen: chess.fen(),
    epd: normalizeFenToEpd(chess.fen()),
  };
}

function buildId(base: string, index: number): string {
  return `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${index}`;
}

function deriveFamilyAndSubvariation(name: string): { family: string; subvariation: string } {
  const [family, ...rest] = name.split(':');
  return {
    family: family?.trim() || name,
    subvariation: rest.join(':').trim() || 'Main line',
  };
}

export function parseLichessOpeningFiles(files: LichessInputFile[]): OpeningEntry[] {
  const merged = new Map<string, MergedOpeningSeed>();

  for (const file of files) {
    const parsed = parseTsvFile(file.content);
    if (parsed.header.length === 0) {
      continue;
    }

    for (const row of parsed.rows) {
      const entry = Object.fromEntries(parsed.header.map((column, index) => [column, row[index] ?? '']));
      if (!entry.eco || !entry.name || !entry.pgn) {
        continue;
      }

      const key = `${entry.eco}|${entry.name}|${entry.pgn}`;
      const current = merged.get(key) ?? {
        eco: entry.eco,
        name: entry.name,
        pgn: entry.pgn,
      };

      if (entry.uci) {
        current.uci = entry.uci;
      }

      if (entry.epd) {
        current.epd = entry.epd;
      }

      merged.set(key, current);
    }
  }

  return [...merged.values()].map((entry, index) => {
    const derived = entry.uci
      ? (() => {
          const uciSequence = entry.uci.split(/\s+/).filter(Boolean);
          const chess = new Chess();
          for (const uci of uciSequence) {
            const move = chess.move({
              from: uci.slice(0, 2),
              to: uci.slice(2, 4),
              promotion: (uci[4] as 'n' | 'b' | 'r' | 'q' | undefined) ?? undefined,
            });
            if (!move) {
              throw new Error(`Movimiento UCI invalido en dataset: ${uci}`);
            }
          }

          return {
            uciMoves: uciSequence,
            fen: chess.fen(),
            epd: normalizeFenToEpd(chess.fen()),
          };
        })()
      : pgnToUciMoves(entry.pgn);

    const familyInfo = deriveFamilyAndSubvariation(entry.name);

    return {
      id: buildId(`${entry.eco}-${entry.name}`, index),
      eco: entry.eco,
      canonicalName: entry.name,
      aliases: [],
      pgn: entry.pgn,
      uciMoves: derived.uciMoves,
      epd: entry.epd ? normalizeFenToEpd(entry.epd) : derived.epd,
      fen: derived.fen,
      family: familyInfo.family,
      subvariation: familyInfo.subvariation,
      source: 'lichess-org/chess-openings',
      sourceLicense: 'CC0-1.0',
      depth: derived.uciMoves.length,
      isInterpolated: false,
    } satisfies OpeningEntry;
  });
}
