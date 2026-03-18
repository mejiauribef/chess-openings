import { Chess } from 'chess.js';
import type { OpeningEntry } from '@/domain/opening';
import { normalizeFenToEpd } from '@/domain/notation';

interface EcoRecord {
  eco: string;
  moves?: string;
  name: string;
  aliases?: Record<string, string> | string[];
  src?: string;
  isEcoRoot?: boolean;
}

export interface EcoImportResult {
  openings: OpeningEntry[];
  aliasesByName: Record<string, string[]>;
  transitions: Array<{
    fromEpd: string;
    toEpd: string;
    fromSource: string;
    toSource: string;
  }>;
}

function tokenizeSanSequence(sequence: string): string[] {
  return sequence
    .replace(/\d+\.(\.\.)?/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !['1-0', '0-1', '1/2-1/2', '*'].includes(token));
}

function sanSequenceToDerivedFields(sequence: string): { uciMoves: string[]; fen: string; epd: string } {
  const chess = new Chess();
  const uciMoves: string[] = [];

  for (const san of tokenizeSanSequence(sequence)) {
    const move = chess.move(san, { strict: false });
    if (!move) {
      throw new Error(`No se pudo interpretar la jugada SAN "${san}" desde eco.json`);
    }
    uciMoves.push(`${move.from}${move.to}${move.promotion ?? ''}`);
  }

  return {
    uciMoves,
    fen: chess.fen(),
    epd: normalizeFenToEpd(chess.fen()),
  };
}

function toAliasList(aliases: EcoRecord['aliases']): string[] {
  if (!aliases) {
    return [];
  }

  if (Array.isArray(aliases)) {
    return aliases.filter(Boolean);
  }

  return Object.values(aliases).filter(Boolean);
}

function deriveFamilyAndSubvariation(name: string): { family: string; subvariation: string } {
  const [family, ...rest] = name.split(':');
  return {
    family: family?.trim() || name,
    subvariation: rest.join(':').trim() || 'Main line',
  };
}

export function parseEcoJsonFiles(
  ecoFiles: Array<{ name: string; content: string }>,
  fromToContent?: string,
): EcoImportResult {
  const openings: OpeningEntry[] = [];
  const aliasesByName: Record<string, string[]> = {};

  ecoFiles.forEach((file, fileIndex) => {
    const parsed = JSON.parse(file.content) as Record<string, EcoRecord>;

    Object.entries(parsed).forEach(([fenKey, record], recordIndex) => {
      if (!record.name || !record.eco || !record.moves) {
        return;
      }

      const derived = sanSequenceToDerivedFields(record.moves);
      const aliases = toAliasList(record.aliases);
      aliasesByName[record.name] = [...new Set([...(aliasesByName[record.name] ?? []), ...aliases])];
      const familyInfo = deriveFamilyAndSubvariation(record.name);

      openings.push({
        id: `eco-${fileIndex}-${recordIndex}`,
        eco: record.eco,
        canonicalName: record.name,
        aliases,
        pgn: record.moves,
        uciMoves: derived.uciMoves,
        epd: normalizeFenToEpd(fenKey),
        fen: derived.fen,
        family: familyInfo.family,
        subvariation: familyInfo.subvariation,
        source: 'eco-json',
        sourceLicense: 'See upstream eco.json license',
        depth: derived.uciMoves.length,
        isInterpolated: !record.isEcoRoot,
      });
    });
  });

  const transitions = fromToContent
    ? (JSON.parse(fromToContent) as [string, string, string, string][])
        .filter((entry) => entry.length >= 4)
        .map(([fromFen, toFen, fromSource, toSource]) => ({
          fromEpd: normalizeFenToEpd(fromFen),
          toEpd: normalizeFenToEpd(toFen),
          fromSource,
          toSource,
        }))
    : [];

  return {
    openings,
    aliasesByName,
    transitions,
  };
}
