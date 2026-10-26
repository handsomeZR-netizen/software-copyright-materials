import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './app.ts';
import { SOFTWARE_NAME, VERSION } from '../shared/types.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 3187);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT 必须为 1 至 65535 的整数。');
const server = createServer(
  resolve(root, process.env.DATA_DIR || 'data'),
  resolve(root, 'dist'),
);
server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `端口 ${port} 已被占用，请关闭旧服务或修改 PORT 后重试。`
      : error.message,
  );
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () =>
  console.log(`${SOFTWARE_NAME} ${VERSION}\n本机访问：http://127.0.0.1:${port}`),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => server.close(() => process.exit(0)));
