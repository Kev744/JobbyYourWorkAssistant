import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { LocationOption } from '@/types';

interface LocationOptions {
  cities: LocationOption[];
  departments: LocationOption[];
  regions: LocationOption[];
}

let cachedOptions: LocationOptions | null = null;
const LOCATION_ASSETS_DIRECTORY = join(process.cwd(), 'src', 'assets');

export function getLocationOptions(): LocationOptions {
  if (cachedOptions) {
    return cachedOptions;
  }

  const departments = parseCsv(readAssetCsv('departements-france.csv')).map((row) => ({
    code: row.code_departement ?? '',
    name: row.nom_departement ?? '',
    regionCode: row.code_region,
    regionName: row.nom_region,
  })).filter((item) => item.code && item.name);
  const regionMap = new Map<string, LocationOption>();

  for (const department of departments) {
    if (department.regionCode && department.regionName) {
      regionMap.set(department.regionCode, {
        code: department.regionCode,
        name: department.regionName,
      });
    }
  }

  const cities = parseCsv(readAssetCsv('communes-france-2025.csv'))
    .filter((row) => row.typecom === 'COM')
    .map((row) => ({
      code: row.code_insee ?? '',
      name: row.nom_standard ?? '',
      departmentCode: row.dep_code,
      departmentName: row.dep_nom,
      regionCode: row.reg_code,
      regionName: row.reg_nom,
      postalCode: row.code_postal,
    }))
    .filter((item) => item.code && item.name)
    .sort((left, right) => left.name.localeCompare(right.name, 'fr'));

  cachedOptions = {
    cities,
    departments,
    regions: Array.from(regionMap.values()).sort((left, right) =>
      left.name.localeCompare(right.name, 'fr'),
    ),
  };

  return cachedOptions;
}

export function findLocationByCode(
  options: LocationOption[],
  code: string | null | undefined,
): LocationOption | null {
  if (!code) {
    return null;
  }

  return options.find((option) => option.code === code) ?? null;
}

function readAssetCsv(fileName: string): string {
  return readFileSync(join(LOCATION_ASSETS_DIRECTORY, fileName), 'utf8');
}

function parseCsv(content: string): Array<Record<string, string>> {
  const [headerLine, ...lines] = content.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(headerLine).map((header) => header.trim());

  return lines.map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    return row;
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}
