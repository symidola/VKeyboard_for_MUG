import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import type {
  ClientRole,
  ClientToServerMessage,
  ServerToClientMessage,
} from '@vkeyboard/shared';

type ClientInfo = {
  id: string;
  role: ClientRole;
  deviceName?: string;
};

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isClientToServerMessage(value: unknown): value is ClientToServerMessage {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  if (typeof v.type !== 'string') return false;
  if (v.type === 'hello') {
    return v.role === 'keyboard' || v.role === 'receiver';
  }
  if (v.type === 'key') {
    return (
      (v.action === 'down' || v.action === 'up' || v.action === 'tap') &&
      typeof v.keyId === 'string' &&
      typeof v.label === 'string' &&
      typeof v.ts === 'number'
    );
  }
  if (v.type === 'key_state') {
    return (
      typeof v.ts === 'number' &&
      Array.isArray(v.keys) &&
      v.keys.every(
        (k: any) =>
          k &&
          typeof k === 'object' &&
          typeof k.keyId === 'string' &&
          typeof k.label === 'string' &&
          typeof k.pressed === 'boolean' &&
          typeof k.seq === 'number',
      )
    );
  }
  return false;
}

const PORT = Number(process.env.PORT ?? 8080);

const app = express();
app.use(express.json({ limit: '256kb' }));
const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: '/ws',
  perMessageDeflate: false,
  maxPayload: 64 * 1024,
  pingInterval: 15000,
  pingTimeout: 5000,
});

const clients = new Map<any, ClientInfo>();

function broadcastState(): void {
  const payload: ServerToClientMessage = {
    type: 'state',
    clients: Array.from(clients.values()).map(({ id, role, deviceName }) => ({
      id,
      role,
      deviceName,
    })),
  };
  const text = JSON.stringify(payload);
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(text);
  }
}

function forwardToReceivers(fromWs: any, msg: ServerToClientMessage): void {
  const text = JSON.stringify(msg);
  for (const [ws, info] of clients.entries()) {
    if (ws === fromWs) continue;
    if (info.role !== 'receiver') continue;
    if (ws.readyState === WebSocket.OPEN) ws.send(text);
  }
}

wss.on('connection', (ws, req) => {
  const id = randomUUID();
  clients.set(ws, { id, role: 'receiver' });

  console.log(`[ws] client connected id=${id}`);

  // TCP 低延迟：禁用 Nagle
  // ws 的 socket 是私有字段，但在 Node 场景下很常用
  (ws as any)._socket?.setNoDelay?.(true);

  ws.on('message', (data) => {
    const text = typeof data === 'string' ? data : data.toString('utf8');
    const raw = safeJsonParse(text);
    if (!isClientToServerMessage(raw)) {
      if (raw != null) console.warn('[ws] dropped invalid message', id);
      return;
    }

    if (raw.type === 'hello') {
      const current = clients.get(ws);
      if (!current) return;
      current.role = raw.role;
      current.deviceName = raw.deviceName;
      broadcastState();
      return;
    }

    if (raw.type === 'key' || raw.type === 'key_state') {
      forwardToReceivers(ws, raw);
      return;
    }
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    console.log(`[ws] client disconnected id=${info?.id ?? '?'} role=${info?.role ?? '?'}`);
    clients.delete(ws);
    broadcastState();
  });

  ws.on('error', (err) => {
    const info = clients.get(ws);
    console.error(`[ws] client error id=${info?.id ?? '?'} role=${info?.role ?? '?'}`, err.message);
  });

  // 基础握手信息
  const ua = req.headers['user-agent'];
  clients.get(ws)!.deviceName = typeof ua === 'string' ? ua : undefined;
  broadcastState();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

function setCors(res: express.Response): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

app.options('/debug/log', (_req, res) => {
  setCors(res);
  res.status(204).end();
});

app.get('/debug/log/status', async (_req, res) => {
  setCors(res);
  const logDir = path.join(repoRoot, 'logs');
  const logFile = path.join(logDir, 'vkeyboard-debug.log');
  try {
    const st = await fs.stat(logFile);
    res.json({ ok: true, logFile, exists: true, size: st.size, mtimeMs: st.mtimeMs });
  } catch {
    res.json({ ok: true, logFile, exists: false });
  }
});

app.get('/debug/log/download', async (_req, res) => {
  setCors(res);
  const logDir = path.join(repoRoot, 'logs');
  const logFile = path.join(logDir, 'vkeyboard-debug.log');
  try {
    const text = await fs.readFile(logFile, 'utf8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } catch (e) {
    res.status(404).json({ ok: false, error: e instanceof Error ? e.message : 'not found' });
  }
});

app.post('/debug/log', async (req, res) => {
  setCors(res);

  const body = req.body as any;
  const lines: unknown = body?.lines;

  if (!Array.isArray(lines)) {
    res.status(400).json({ ok: false, error: 'lines must be an array' });
    return;
  }

  const maxLines = 400;
  const maxLen = 800;

  const cleaned: string[] = [];
  for (const l of lines.slice(0, maxLines)) {
    if (typeof l !== 'string') continue;
    cleaned.push(l.replace(/\r?\n/g, ' ').slice(0, maxLen));
  }

  if (cleaned.length === 0) {
    res.json({ ok: true, written: 0 });
    return;
  }

  const logDir = path.join(repoRoot, 'logs');
  const logFile = path.join(logDir, 'vkeyboard-debug.log');
  try {
    await fs.mkdir(logDir, { recursive: true });
    const prefix = `${new Date().toISOString()} `;
    const text = cleaned.map((l) => prefix + l).join('\n') + '\n';
    await fs.appendFile(logFile, text, { encoding: 'utf8' });
    res.json({ ok: true, written: cleaned.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : 'write failed' });
  }
});

// 生产：如果 client 已 build，则由 server 托管静态文件
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  // 如果没有 build 出 dist，就让它 404（开发时用 Vite）
  const indexHtml = path.join(clientDist, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) next();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] listening on http://0.0.0.0:${PORT}`);
});
