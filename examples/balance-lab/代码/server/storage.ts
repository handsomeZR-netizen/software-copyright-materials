import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { STEP_POINTS, WEIGHTS } from '../shared/types.ts';
import type { Session } from '../shared/types.ts';

function validSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const s = value as Session;
  return (
    typeof s.id === 'string' &&
    typeof s.label === 'string' &&
    ['practice', 'demo'].includes(s.source) &&
    ['active', 'finished'].includes(s.status) &&
    typeof s.createdAt === 'string' &&
    typeof s.updatedAt === 'string' &&
    (s.finishedAt === null || typeof s.finishedAt === 'string') &&
    typeof s.checked === 'boolean' &&
    typeof s.calibrated === 'boolean' &&
    Number.isInteger(s.rider) &&
    s.rider >= 0 &&
    s.rider <= 50 &&
    Number.isInteger(s.nut) &&
    s.nut >= -5 &&
    s.nut <= 5 &&
    s.objectMass === 374 &&
    ['box', 'left', 'right'].includes(s.objectSide) &&
    ['tweezers', 'hand'].includes(s.tool) &&
    Array.isArray(s.weights) &&
    s.weights.length <= WEIGHTS.length &&
    new Set(s.weights.map((w) => w?.mass)).size === s.weights.length &&
    s.weights.every(
      (w) => w && WEIGHTS.includes(w.mass) && ['left', 'right'].includes(w.side),
    ) &&
    Array.isArray(s.steps) &&
    s.steps.length === 8 &&
    s.steps.every(
      (step, i) =>
        step &&
        typeof step.name === 'string' &&
        typeof step.passed === 'boolean' &&
        step.max === STEP_POINTS[i] &&
        step.score === (step.passed ? step.max : 0),
    ) &&
    s.score === s.steps.reduce((total, step) => total + step.score, 0) &&
    Array.isArray(s.events) &&
    s.events.every(
      (e) =>
        e &&
        typeof e.at === 'string' &&
        typeof e.action === 'string' &&
        typeof e.message === 'string' &&
        typeof e.violation === 'boolean',
    ) &&
    (s.reading === null || Number.isInteger(s.reading)) &&
    typeof s.feedback === 'string' &&
    typeof s.balanced === 'boolean' &&
    Number.isInteger(s.difference)
  );
}

export class Store {
  private queue: Promise<unknown> = Promise.resolve();
  private file: string;
  private directory: string;
  constructor(directory: string) {
    this.directory = directory;
    this.file = join(directory, 'sessions.json');
  }
  private async read(): Promise<Session[]> {
    let raw: string;
    try {
      raw = await readFile(this.file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const sessions: unknown = JSON.parse(raw);
    if (
      !Array.isArray(sessions) ||
      !sessions.every(validSession) ||
      new Set(sessions.map((s) => s.id)).size !== sessions.length
    ) {
      throw new Error('记录文件损坏；请保留原文件并从备份恢复。');
    }
    return sessions as Session[];
  }
  async list(): Promise<Session[]> {
    await this.queue;
    return this.read();
  }
  mutate<T>(change: (sessions: Session[]) => T): Promise<T> {
    const operation = this.queue.then(async () => {
      const sessions = await this.read();
      const result = change(sessions);
      await mkdir(this.directory, { recursive: true });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(sessions, null, 2), {
        encoding: 'utf8',
        flag: 'wx',
      });
      await rename(temporary, this.file);
      return result;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
