import fs from 'node:fs/promises';
import path from 'node:path';
import { importPgnRepertoire } from '../src/lib/chess/pgn';

function getArg(name: string): string | undefined {
  const entry = process.argv.find((value) => value.startsWith(`--${name}=`));
  return entry?.split('=').at(1);
}

async function main() {
  const file = getArg('file');
  const color = getArg('color') === 'black' ? 'black' : 'white';

  if (!file) {
    throw new Error('Usage: tsx scripts/import-pgn.ts --file=path/to/file.pgn --color=white');
  }

  const sourcePath = path.resolve(file);
  const pgn = await fs.readFile(sourcePath, 'utf8');
  const imported = importPgnRepertoire(pgn, { color });
  const outputPath = sourcePath.replace(/\.pgn$/i, '.repertoire.json');

  await fs.writeFile(outputPath, `${JSON.stringify(imported, null, 2)}\n`, 'utf8');
  console.log(`Imported PGN into ${outputPath}`);
}

void main();

