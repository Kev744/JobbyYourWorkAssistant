/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '@/lib/db/prisma';
import { getLocalStorageDir } from '@/lib/env';

type QueryData = Record<string, unknown>;
type QueryOperation = 'select' | 'insert' | 'update' | 'upsert' | 'delete';
type ResultMode = 'many' | 'single' | 'maybeSingle';

export interface LocalDbError {
  message: string;
  code?: string;
}

export interface LocalDbResult<T = any> {
  data: T | null;
  error: LocalDbError | null;
  count?: number | null;
}

export interface LocalDatabaseClient {
  from(tableName: string): LocalQueryBuilder;
  storage: LocalStorageClient;
}

interface SelectOptions {
  count?: 'exact';
  head?: boolean;
}

interface OrderOptions {
  ascending?: boolean;
}

interface DeleteOptions {
  count?: 'exact';
}

interface UpsertOptions {
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

interface Filter {
  column: string;
  operator: 'eq' | 'gt' | 'is' | 'in' | 'or';
  value: unknown;
}

interface OrderBy {
  column: string;
  ascending: boolean;
}

const TABLE_DELEGATES: Record<string, string> = {
  user_credentials: 'userCredential',
  resume_files: 'resumeFile',
  resume_versions: 'resumeVersion',
  candidate_profiles: 'candidateProfile',
  profile_requirements: 'profileRequirement',
  job_offer_sources: 'jobOfferSource',
  job_offers: 'jobOffer',
  job_search_queries: 'jobSearchQuery',
  job_offer_search_results: 'jobOfferSearchResult',
  scored_offers: 'scoredOffer',
  generated_resumes: 'generatedResume',
  applications: 'application',
  application_status_events: 'applicationStatusEvent',
  resume_section_extractions: 'resumeSectionExtraction',
};

export function createLocalDatabaseClient(): LocalDatabaseClient {
  return {
    from(tableName: string) {
      return new LocalQueryBuilder(tableName);
    },
    storage: new LocalStorageClient(),
  };
}

export class LocalQueryBuilder implements PromiseLike<LocalDbResult<any[]>> {
  private operation: QueryOperation = 'select';
  private selectColumns = '*';
  private returnColumns: string | null = null;
  private selectOptions: SelectOptions = {};
  private mutationPayload: QueryData | QueryData[] | null = null;
  private filters: Filter[] = [];
  private orders: OrderBy[] = [];
  private rowLimit: number | null = null;
  private resultMode: ResultMode = 'many';
  private deleteOptions: DeleteOptions = {};
  private upsertOptions: UpsertOptions = {};

  constructor(private readonly tableName: string) {}

  select(columns = '*', options: SelectOptions = {}) {
    if (this.operation === 'insert' || this.operation === 'update' || this.operation === 'upsert') {
      this.returnColumns = columns;
    } else {
      this.operation = 'select';
      this.selectColumns = columns;
      this.selectOptions = options;
    }

    return this;
  }

  insert(payload: QueryData | QueryData[]) {
    this.operation = 'insert';
    this.mutationPayload = payload;
    return this;
  }

  update(payload: QueryData) {
    this.operation = 'update';
    this.mutationPayload = payload;
    return this;
  }

  upsert(payload: QueryData | QueryData[], options: UpsertOptions = {}) {
    this.operation = 'upsert';
    this.mutationPayload = payload;
    this.upsertOptions = options;
    return this;
  }

  delete(options: DeleteOptions = {}) {
    this.operation = 'delete';
    this.deleteOptions = options;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ column, operator: 'gt', value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, operator: 'is', value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ column, operator: 'in', value: values });
    return this;
  }

  or(expression: string) {
    this.filters.push({ column: '', operator: 'or', value: expression });
    return this;
  }

  order(column: string, options: OrderOptions = {}) {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.rowLimit = count;
    return this;
  }

  single(): Promise<LocalDbResult<any>> {
    this.resultMode = 'single';
    return this.execute();
  }

  maybeSingle(): Promise<LocalDbResult<any>> {
    this.resultMode = 'maybeSingle';
    return this.execute();
  }

  then<TResult1 = LocalDbResult<any[]>, TResult2 = never>(
    onfulfilled?: ((value: LocalDbResult<any[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(
      onfulfilled as
        | ((value: LocalDbResult<any[]>) => TResult1 | PromiseLike<TResult1>)
        | null
        | undefined,
      onrejected,
    );
  }

  private async execute(): Promise<LocalDbResult<any[] | any>> {
    try {
      const { rows, count } = await this.runPrismaOperation();
      const data = this.toResultData(rows.map(normalizePrismaValue));

      return {
        data,
        error: null,
        count,
      };
    } catch (error) {
      return {
        data: null,
        error: toDbError(error),
        count: null,
      };
    }
  }

  private async runPrismaOperation(): Promise<{ rows: unknown[]; count: number | null }> {
    if (this.operation === 'select') {
      return this.runSelect();
    }

    if (this.operation === 'insert') {
      return this.runInsert();
    }

    if (this.operation === 'update') {
      return this.runUpdate();
    }

    if (this.operation === 'upsert') {
      return this.runUpsert();
    }

    return this.runDelete();
  }

  private async runSelect() {
    const delegate = this.getDelegate();
    const where = this.buildWhere();

    if (this.selectOptions.head) {
      const count = await delegate.count({ where });
      return { rows: [], count };
    }

    const args = pruneUndefined({
      where,
      orderBy: this.buildOrderBy(),
      take: this.rowLimit ?? undefined,
      ...buildPrismaSelection(this.selectColumns),
    });
    const rows = await delegate.findMany(args);
    const count = this.selectOptions.count === 'exact' ? await delegate.count({ where }) : null;

    return { rows, count };
  }

  private async runInsert() {
    const delegate = this.getDelegate();
    const rows = normalizeRows(this.mutationPayload).map(pruneUndefined);

    if (this.returnColumns) {
      const selection = buildPrismaSelection(this.returnColumns);
      const inserted = await Promise.all(rows.map((row) => delegate.create({ data: row, ...selection })));
      return { rows: inserted, count: null };
    }

    if (rows.length === 1) {
      await delegate.create({ data: rows[0] });
    } else if (rows.length > 1) {
      await delegate.createMany({ data: rows });
    }

    return { rows: [], count: null };
  }

  private async runUpdate() {
    const delegate = this.getDelegate();
    const where = this.buildWhere();
    const data = pruneUndefined(normalizeRows(this.mutationPayload)[0] ?? {});

    if (Object.keys(data).length === 0) {
      throw new Error('Update payload is empty.');
    }

    if (!this.returnColumns) {
      await delegate.updateMany({ where, data });
      return { rows: [], count: null };
    }

    // PostgreSQL supports UPDATE ... RETURNING through Prisma. This avoids the
    // follow-up SELECT previously required to return the updated row.
    const rows = await delegate.updateManyAndReturn({
      where,
      data,
      ...buildPrismaSelection(this.returnColumns),
    });

    return { rows, count: null };
  }

  private async runUpsert() {
    const delegate = this.getDelegate();
    const rows = normalizeRows(this.mutationPayload).map(pruneUndefined);
    const conflictColumns = this.getConflictColumns();

    if (this.upsertOptions.ignoreDuplicates) {
      await delegate.createMany({ data: rows, skipDuplicates: true });
      return { rows: [], count: null };
    }

    const selection = this.returnColumns ? buildPrismaSelection(this.returnColumns) : {};
    const upserted = await Promise.all(
      rows.map((row) => {
        const where = buildUniqueWhere(row, conflictColumns);
        const update = removeColumns(row, conflictColumns);

        return delegate.upsert({
          where,
          create: row,
          update,
          ...selection,
        });
      }),
    );

    return { rows: this.returnColumns ? upserted : [], count: null };
  }

  private async runDelete() {
    const delegate = this.getDelegate();
    const result = await delegate.deleteMany({ where: this.buildWhere() });

    return {
      rows: [],
      count: this.deleteOptions.count === 'exact' ? result.count : null,
    };
  }

  private toResultData(rows: unknown[]) {
    if (this.selectOptions.head) {
      return null;
    }

    if (this.resultMode === 'single') {
      if (rows.length !== 1) {
        throw new Error(rows.length === 0 ? 'No rows returned.' : 'Multiple rows returned.');
      }
      return rows[0] ?? null;
    }

    if (this.resultMode === 'maybeSingle') {
      if (rows.length > 1) {
        throw new Error('Multiple rows returned.');
      }
      return rows[0] ?? null;
    }

    return rows;
  }

  private buildWhere() {
    if (this.filters.length === 0) {
      return undefined;
    }

    const andFilters = this.filters.map(buildFilterWhere);

    if (andFilters.length === 1) {
      return andFilters[0];
    }

    return { AND: andFilters };
  }

  private buildOrderBy() {
    if (this.orders.length === 0) {
      return undefined;
    }

    return this.orders.map((order) => ({ [order.column]: order.ascending ? 'asc' : 'desc' }));
  }

  private getConflictColumns() {
    return (this.upsertOptions.onConflict ?? 'id')
      .split(',')
      .map((column) => column.trim())
      .filter(Boolean);
  }

  private getDelegate() {
    const delegateName = TABLE_DELEGATES[this.tableName];

    if (!delegateName) {
      throw new Error(`Unsupported table ${this.tableName}.`);
    }

    const delegate = (prisma as any)[delegateName];

    if (!delegate) {
      throw new Error(`Prisma delegate ${delegateName} is not available.`);
    }

    return delegate;
  }
}

export class LocalStorageClient {
  from(bucket: string) {
    return new LocalStorageBucket(bucket);
  }
}

class LocalStorageBucket {
  constructor(private readonly bucket: string) {}

  async upload(
    storagePath: string,
    body: Buffer | Blob | ArrayBuffer | Uint8Array,
    options: { contentType?: string; upsert?: boolean } = {},
  ) {
    try {
      const filePath = getStorageFilePath(this.bucket, storagePath);
      const exists = await pathExists(filePath);

      if (exists && !options.upsert) {
        return { data: null, error: { message: 'File already exists.', code: '23505' } };
      }

      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, await toBuffer(body));
      await writeFile(`${filePath}.meta.json`, JSON.stringify({ contentType: options.contentType ?? 'application/octet-stream' }));

      return { data: { path: storagePath }, error: null };
    } catch (error) {
      return { data: null, error: toDbError(error) };
    }
  }

  async download(storagePath: string) {
    try {
      const filePath = getStorageFilePath(this.bucket, storagePath);
      const bytes = await readFile(filePath);
      const metadata = await readStorageMetadata(filePath);

      return {
        data: new Blob([new Uint8Array(bytes)], { type: metadata.contentType }),
        error: null,
      };
    } catch (error) {
      return { data: null, error: toDbError(error) };
    }
  }

  async remove(paths: string[]) {
    try {
      await Promise.all(
        paths.map(async (storagePath) => {
          const filePath = getStorageFilePath(this.bucket, storagePath);
          await rm(filePath, { force: true });
          await rm(`${filePath}.meta.json`, { force: true });
        }),
      );

      return { data: paths.map((name) => ({ name })), error: null };
    } catch (error) {
      return { data: null, error: toDbError(error) };
    }
  }

  async createSignedUrl(storagePath: string, _expiresIn: number) {
    void _expiresIn;

    try {
      const filePath = getStorageFilePath(this.bucket, storagePath);
      const bytes = await readFile(filePath);
      const metadata = await readStorageMetadata(filePath);
      const signedUrl = `data:${metadata.contentType};base64,${bytes.toString('base64')}`;

      return { data: { signedUrl }, error: null };
    } catch (error) {
      return { data: null, error: toDbError(error) };
    }
  }
}

function buildFilterWhere(filter: Filter): QueryData {
  if (filter.operator === 'or') {
    const expression = String(filter.value);
    const OR = expression.split(',').map((part) => {
      const [column, operator, ...rawValue] = part.split('.');

      if (operator !== 'eq') {
        throw new Error(`Unsupported OR operator ${operator}`);
      }

      return { [column]: unescapeFilterValue(rawValue.join('.')) };
    });

    return { OR };
  }

  if (filter.operator === 'eq') {
    return { [filter.column]: filter.value };
  }

  if (filter.operator === 'gt') {
    return { [filter.column]: { gt: filter.value } };
  }

  if (filter.operator === 'is') {
    return { [filter.column]: filter.value };
  }

  const values = Array.isArray(filter.value) ? filter.value : [];
  return { [filter.column]: { in: values } };
}

function buildPrismaSelection(rawSelect: string | null) {
  if (!rawSelect || rawSelect.trim() === '*') {
    return {};
  }

  return { select: buildSelectObject(rawSelect) };
}

function buildSelectObject(rawSelect: string) {
  const select: QueryData = {};

  for (const item of splitTopLevel(rawSelect)) {
    const nested = /^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/.exec(item);

    if (nested) {
      const [, relation, nestedColumns] = nested;
      select[relation] = { select: buildSelectObject(nestedColumns) };
      continue;
    }

    select[item] = true;
  }

  return select;
}

function splitTopLevel(value: string) {
  const items: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      items.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

function normalizeRows(payload: QueryData | QueryData[] | null): QueryData[] {
  if (!payload) {
    return [];
  }

  return Array.isArray(payload) ? payload : [payload];
}

function buildUniqueWhere(row: QueryData, conflictColumns: string[]) {
  if (conflictColumns.length === 1) {
    const column = conflictColumns[0];
    return { [column]: row[column] };
  }

  return {
    [conflictColumns.join('_')]: Object.fromEntries(
      conflictColumns.map((column) => [column, row[column]]),
    ),
  };
}

function removeColumns(row: QueryData, columns: string[]) {
  const skipped = new Set(columns);

  return Object.fromEntries(Object.entries(row).filter(([column]) => !skipped.has(column)));
}

function pruneUndefined<T extends QueryData>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function normalizePrismaValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizePrismaValue);
  }

  if (value && typeof value === 'object') {
    const maybeDecimal = value as { toNumber?: () => number; toFixed?: () => string };

    if (typeof maybeDecimal.toNumber === 'function' && typeof maybeDecimal.toFixed === 'function') {
      return maybeDecimal.toNumber();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizePrismaValue(item)]),
    );
  }

  return value;
}

function unescapeFilterValue(value: string) {
  return value.replace(/\\"/g, '"');
}

function toDbError(error: unknown): LocalDbError {
  const message = error instanceof Error ? error.message : String(error);
  const maybe = error as { code?: string; meta?: unknown };

  if (maybe.code === 'P2002') {
    return { message, code: '23505' };
  }

  return { message, code: maybe.code };
}

function getStorageFilePath(bucket: string, storagePath: string) {
  const normalizedPath = path.normalize(storagePath);
  if (path.isAbsolute(normalizedPath) || normalizedPath.startsWith('..')) {
    throw new Error('Invalid storage path.');
  }

  return path.join(getLocalStorageDir(), bucket, normalizedPath);
}

async function toBuffer(body: Buffer | Blob | ArrayBuffer | Uint8Array) {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Blob) {
    return Buffer.from(await body.arrayBuffer());
  }

  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }

  return Buffer.from(body);
}

async function pathExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readStorageMetadata(filePath: string) {
  try {
    const raw = await readFile(`${filePath}.meta.json`, 'utf8');
    const parsed = JSON.parse(raw) as { contentType?: string };
    return { contentType: parsed.contentType || 'application/octet-stream' };
  } catch {
    return { contentType: 'application/octet-stream' };
  }
}
