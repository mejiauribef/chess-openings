import fs from 'node:fs/promises';
import path from 'node:path';
import sampleJson from '../data/generated/openings.base.json';
import { generatedOpeningsSchema } from '../src/domain/opening';
import { parseLichessOpeningFiles } from '../src/data/mappers/lichessOpenings';

function getArg(name: string): string | undefined {
  const entry = process.argv.find((value) => value.startsWith(`--${name}=`));
  return entry?.split('=').at(1);
}

async function main() {
  const mode = getArg('mode') ?? 'sample';
  const targetPath = path.resolve('data/generated/openings.base.json');

  if (mode === 'sample') {
    const parsed = generatedOpeningsSchema.parse(sampleJson);
    await fs.writeFile(targetPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    console.log(`Wrote sample openings dataset to ${targetPath}`);
    return;
  }

  const sourceDir = path.resolve(getArg('input') ?? 'data/sources/lichess-org/chess-openings');
  const candidates = [
    ...(await fs.readdir(sourceDir, { withFileTypes: true })).filter((entry) => entry.isFile()),
    ...(await fs
      .readdir(path.join(sourceDir, 'dist'), { withFileTypes: true })
      .catch(() => []))
      .filter((entry) => entry.isFile())
      .map((entry) => ({ ...entry, parentPath: path.join(sourceDir, 'dist') })),
  ];

  const tsvFiles = await Promise.all(
    candidates
      .filter((entry) => entry.name.toLowerCase().endsWith('.tsv'))
      .map(async (entry) => {
        const basePath = 'parentPath' in entry ? entry.parentPath : sourceDir;
        const fullPath = path.join(basePath, entry.name);
        return {
          name: entry.name,
          content: await fs.readFile(fullPath, 'utf8'),
        };
      }),
  );

  if (tsvFiles.length === 0) {
    throw new Error(`No .tsv files found under ${sourceDir}`);
  }

  const openings = parseLichessOpeningFiles(tsvFiles);

  const payload = generatedOpeningsSchema.parse({
    mode: 'full',
    generatedAt: new Date().toISOString(),
    openings,
  });

  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Imported ${payload.openings.length} openings from ${sourceDir}`);
}

void main();
