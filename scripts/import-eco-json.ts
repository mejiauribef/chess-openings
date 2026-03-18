import fs from 'node:fs/promises';
import path from 'node:path';
import { generatedOpeningsSchema } from '../src/domain/opening';
import { parseEcoJsonFiles } from '../src/data/mappers/ecoJson';

function getArg(name: string): string | undefined {
  const entry = process.argv.find((value) => value.startsWith(`--${name}=`));
  return entry?.split('=').at(1);
}

async function main() {
  const mode = getArg('mode') ?? 'sample';
  const basePath = path.resolve('data/generated/openings.base.json');
  const aliasesPath = path.resolve('data/generated/openings.aliases.json');
  const transitionsPath = path.resolve('data/generated/openings.transitions.json');

  const base = generatedOpeningsSchema.parse(JSON.parse(await fs.readFile(basePath, 'utf8')));

  if (mode === 'sample') {
    const aliases = Object.fromEntries(base.openings.map((opening) => [opening.id, opening.aliases]));
    await fs.writeFile(aliasesPath, `${JSON.stringify(aliases, null, 2)}\n`, 'utf8');
    await fs.writeFile(transitionsPath, `${JSON.stringify([], null, 2)}\n`, 'utf8');
    console.log(`Wrote sample aliases to ${aliasesPath}`);
    return;
  }

  const sourceDir = path.resolve(getArg('input') ?? 'data/sources/eco-json');
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const ecoFiles = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .filter((entry) => /^eco.*\.json$/i.test(entry.name))
      .map(async (entry) => ({
        name: entry.name,
        content: await fs.readFile(path.join(sourceDir, entry.name), 'utf8'),
      })),
  );

  if (ecoFiles.length === 0) {
    throw new Error(`No eco*.json files found under ${sourceDir}`);
  }

  const fromToPath = path.join(sourceDir, 'fromTo.json');
  const fromToContent = await fs.readFile(fromToPath, 'utf8').catch(() => undefined);
  const ecoData = parseEcoJsonFiles(ecoFiles, fromToContent);
  const deduped = new Map<string, (typeof base.openings)[number]>();

  [...base.openings, ...ecoData.openings].forEach((opening) => {
    const key = `${opening.eco}|${opening.canonicalName}|${opening.epd}`;
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, opening);
      return;
    }

    deduped.set(key, {
      ...existing,
      aliases: [...new Set([...existing.aliases, ...opening.aliases])],
      source: existing.source === 'lichess-org/chess-openings' ? existing.source : opening.source,
      sourceLicense: existing.sourceLicense,
    });
  });

  const mergedPayload = generatedOpeningsSchema.parse({
    mode: 'full',
    generatedAt: new Date().toISOString(),
    openings: [...deduped.values()],
  });

  const aliases = mergedPayload.openings.reduce<Record<string, string[]>>((accumulator, opening) => {
    accumulator[opening.id] = [
      ...new Set([...(opening.aliases ?? []), ...(ecoData.aliasesByName[opening.canonicalName] ?? [])]),
    ];
    return accumulator;
  }, {});

  await fs.writeFile(basePath, `${JSON.stringify(mergedPayload, null, 2)}\n`, 'utf8');
  await fs.writeFile(aliasesPath, `${JSON.stringify(aliases, null, 2)}\n`, 'utf8');
  await fs.writeFile(transitionsPath, `${JSON.stringify(ecoData.transitions, null, 2)}\n`, 'utf8');
  console.log(`Merged ${ecoData.openings.length} eco openings from ${sourceDir}`);
}

void main();
