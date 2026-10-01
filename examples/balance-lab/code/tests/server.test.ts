import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server/app.ts';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'balance-test-'));
  const dist = join(directory, 'dist');
  await mkdir(dist);
  await writeFile(join(dist, 'index.html'), '<html>local balance test</html>');
  const server = createServer(join(directory, 'data'), dist);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  return {
    directory,
    server,
    base: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await rm(directory, { recursive: true, force: true });
    },
  };
}
function post(base: string, path: string, body: unknown, headers = {}) {
  return fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
test('create, concurrent mutations, export, finish and reload persist coherent records', async () => {
  const f = await fixture();
  try {
    assert.equal((await fetch(f.base + '/api/health')).status, 200);
    const creates = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        post(f.base, '/api/sessions', { label: `测试${i}`, source: 'demo' }).then((r) =>
          r.json(),
        ),
      ),
    );
    assert.equal(new Set(creates.map((s) => s.id)).size, 12);
    const id = creates[0].id;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        post(f.base, `/api/sessions/${id}/actions`, { type: 'check' }),
      ),
    );
    const saved = await (await fetch(f.base + `/api/sessions/${id}`)).json();
    assert.equal(saved.score, 10);
    assert.equal(saved.events.length, 8);
    const download = await fetch(f.base + `/api/sessions/${id}/export`);
    assert.match(download.headers.get('content-disposition')!, /attachment/);
    assert.deepEqual(await download.json(), saved);
    await post(f.base, `/api/sessions/${id}/finish`, {});
    assert.equal(
      (await post(f.base, `/api/sessions/${id}/actions`, { type: 'check' })).status,
      400,
    );
    const stored = JSON.parse(
      await readFile(join(f.directory, 'data', 'sessions.json'), 'utf8'),
    );
    assert.equal(stored.length, 12);
    assert.equal(stored.find((s: { id: string }) => s.id === id).status, 'finished');
    const restarted = createServer(
      join(f.directory, 'data'),
      join(f.directory, 'dist'),
    );
    await new Promise<void>((resolve) => restarted.listen(0, '127.0.0.1', resolve));
    try {
      const port = (restarted.address() as { port: number }).port;
      assert.equal(
        (await (await fetch(`http://127.0.0.1:${port}/api/sessions`)).json()).length,
        12,
      );
    } finally {
      await new Promise<void>((resolve) => restarted.close(() => resolve()));
    }
  } finally {
    await f.close();
  }
});
test('request validation, foreign origins and secure static access', async () => {
  const f = await fixture();
  try {
    assert.equal((await fetch(f.base + '/')).status, 200);
    assert.equal(
      (await post(f.base, '/api/sessions', {}, { Origin: 'https://example.com' }))
        .status,
      403,
    );
    assert.equal(
      (await post(f.base, '/api/sessions', { label: 'x'.repeat(81) })).status,
      400,
    );
    assert.equal(
      (await post(f.base, '/api/sessions', { label: 'x'.repeat(17000) })).status,
      413,
    );
    assert.equal(
      (
        await fetch(f.base + '/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{bad',
        })
      ).status,
      400,
    );
    assert.equal((await fetch(f.base + '/api/sessions/missing')).status, 404);
    assert.equal((await fetch(f.base + '/%2e%2e%5csecret.txt')).status, 400);
    assert.equal((await fetch(f.base + '/missing.js')).status, 404);
  } finally {
    await f.close();
  }
});
test('corrupt saved data is preserved and cannot be overwritten by new sessions', async () => {
  const f = await fixture();
  try {
    await mkdir(join(f.directory, 'data'));
    const file = join(f.directory, 'data', 'sessions.json');
    await writeFile(file, '{corrupted');
    assert.equal((await fetch(f.base + '/api/health')).status, 500);
    assert.equal((await post(f.base, '/api/sessions', {})).status, 500);
    assert.equal(await readFile(file, 'utf8'), '{corrupted');
  } finally {
    await f.close();
  }
});

test('array-valued enum inputs cannot corrupt persisted sessions', async () => {
  const f = await fixture();
  try {
    assert.equal((await post(f.base, '/api/sessions', { source: ['demo'] })).status, 400);
    const s = await (await post(f.base, '/api/sessions', {})).json();
    for (const action of [
      { type: ['check'] },
      { type: 'object', side: ['left'] },
      { type: 'tool', value: ['hand'] },
      { type: 'addWeight', mass: 200, side: ['right'] },
    ]) {
      assert.equal((await post(f.base, `/api/sessions/${s.id}/actions`, action)).status, 400);
    }
    assert.equal((await fetch(f.base + '/api/health')).status, 200);
    const unchanged = await (await fetch(f.base + `/api/sessions/${s.id}`)).json();
    assert.deepEqual(unchanged, s);
  } finally { await f.close(); }
});
