import { createServer as httpServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { SOFTWARE_NAME, VERSION } from '../shared/types.ts';
import {
  applyAction,
  createSession,
  finishSession,
  InputError,
  validateAction,
} from './engine.ts';
import { Store } from './storage.ts';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(value));
}
async function body(req: IncomingMessage): Promise<unknown> {
  if (!(req.headers['content-type'] || '').startsWith('application/json'))
    throw new HttpError(415, '请使用 application/json 请求。');
  let length = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 16384) throw new HttpError(413, '请求体过大。');
    chunks.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, '请求 JSON 格式错误。');
  }
}
export function createServer(dataDir: string, distDir: string) {
  const store = new Store(dataDir);
  const root = resolve(distDir);
  return httpServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const address = req.socket.localPort;
      const allowed = [`127.0.0.1:${address}`, `localhost:${address}`];
      if (!allowed.includes(req.headers.host || ''))
        throw new HttpError(403, '仅允许本机访问。');
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        if (
          req.headers.origin &&
          !allowed.map((host) => `http://${host}`).includes(req.headers.origin)
        )
          throw new HttpError(403, '不允许其他网站修改本机实验记录。');
        if (req.headers['sec-fetch-site'] === 'cross-site')
          throw new HttpError(403, '拒绝跨站请求。');
      }
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const path = url.pathname;
      if (path === '/api/health' && req.method === 'GET') {
        await store.list();
        return json(res, 200, { name: SOFTWARE_NAME, version: VERSION, status: 'ok' });
      }
      if (path === '/api/sessions' && req.method === 'GET')
        return json(res, 200, (await store.list()).reverse());
      if (path === '/api/sessions' && req.method === 'POST') {
        const input = (await body(req)) as { label?: unknown; source?: unknown };
        if (
          !input ||
          typeof input !== 'object' ||
          (input.label !== undefined &&
            (typeof input.label !== 'string' || input.label.trim().length > 80)) ||
          (input.source !== undefined &&
            (typeof input.source !== 'string' || !['practice', 'demo'].includes(input.source)))
        )
          throw new HttpError(400, '实验名称最多 80 字，来源须为 practice 或 demo。');
        const created = await store.mutate((sessions) => {
          const s = createSession(
            typeof input.label === 'string' && input.label.trim()
              ? input.label.trim()
              : undefined,
            input.source as 'practice' | 'demo' | undefined,
          );
          sessions.push(s);
          return s;
        });
        return json(res, 201, created);
      }
      const match = path.match(
        /^\/api\/sessions\/([\w-]+)(?:\/(actions|finish|export))?$/,
      );
      if (match) {
        const [, id, operation] = match;
        if (req.method === 'GET' && (!operation || operation === 'export')) {
          const session = (await store.list()).find((s) => s.id === id);
          if (!session) throw new HttpError(404, '实验记录不存在。');
          if (operation === 'export')
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="experiment-${id}.json"`,
            );
          return json(res, 200, session);
        }
        if (req.method === 'POST' && ['actions', 'finish'].includes(operation)) {
          const input = await body(req);
          if (operation === 'actions') validateAction(input);
          const session = await store.mutate((sessions) => {
            const index = sessions.findIndex((s) => s.id === id);
            if (index === -1) throw new HttpError(404, '实验记录不存在。');
            if (operation === 'actions') {
              validateAction(input);
              sessions[index] = applyAction(sessions[index], input);
            } else sessions[index] = finishSession(sessions[index]);
            return sessions[index];
          });
          return json(res, 200, session);
        }
        throw new HttpError(405, '不支持此请求方法。');
      }
      if (path.startsWith('/api/')) throw new HttpError(404, '接口不存在。');
      if (!['GET', 'HEAD'].includes(req.method || ''))
        throw new HttpError(405, '不支持此请求方法。');
      let decoded: string;
      try {
        decoded = decodeURIComponent(path);
      } catch {
        throw new HttpError(400, '路径编码无效。');
      }
      if (decoded.includes('\0') || decoded.includes('\\'))
        throw new HttpError(400, '路径无效。');
      let file = resolve(root, `.${decoded}`);
      if (file !== root && !file.startsWith(root + sep))
        throw new HttpError(403, '禁止访问此路径。');
      if (decoded === '/' || !extname(decoded)) file = resolve(root, 'index.html');
      let content: Buffer;
      try {
        content = await readFile(file);
      } catch {
        throw new HttpError(404, '页面不存在，请先运行构建脚本。');
      }
      const mime: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.ico': 'image/x-icon',
      };
      res.writeHead(200, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof InputError
            ? 400
            : 500;
      if (status === 500) console.error('实验数据服务异常：', error);
      if (!res.headersSent)
        json(res, status, {
          error:
            status === 500
              ? '读取或保存记录失败；原文件已保留，请检查数据目录或恢复备份。'
              : (error as Error).message,
        });
      else res.end();
    }
  });
}
