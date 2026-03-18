import { z } from 'zod';

export const uciMoveSchema = z.string().regex(/^[a-h][1-8][a-h][1-8][nbrq]?$/i);
export const epdSchema = z.string().min(8);
export const fenSchema = z.string().min(8);
export const sideToMoveSchema = z.enum(['w', 'b']);

export type SideToMove = z.infer<typeof sideToMoveSchema>;

export function normalizeFenToEpd(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

export function epdToFen(epd: string, halfmove = 0, fullmove = 1): string {
  return `${epd} ${halfmove} ${fullmove}`;
}

export function splitUciLine(line: string): string[] {
  return line
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function samePosition(leftFen: string, rightFen: string): boolean {
  return normalizeFenToEpd(leftFen) === normalizeFenToEpd(rightFen);
}

