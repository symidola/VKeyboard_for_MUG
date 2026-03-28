import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
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
  return false;
}

const PORT = Number(process.env.PORT ?? 8080);

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: '/ws',
  perMessageDeflate: false,
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

  // TCP 低延迟：禁用 Nagle
  // ws 的 socket 是私有字段，但在 Node 场景下很常用
  (ws as any)._socket?.setNoDelay?.(true);

  ws.on('message', (data) => {
    const text = typeof data === 'string' ? data : data.toString('utf8');
    const raw = safeJsonParse(text);
    if (!isClientToServerMessage(raw)) return;

    if (raw.type === 'hello') {
      const current = clients.get(ws);
      if (!current) return;
      current.role = raw.role;
      current.deviceName = raw.deviceName;
      broadcastState();
      return;
    }

    if (raw.type === 'key') {
      forwardToReceivers(ws, raw);
      return;
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcastState();
  });

  ws.on('error', () => {
    clients.delete(ws);
    broadcastState();
  });

  // 基础握手信息
  const ua = req.headers['user-agent'];
  clients.get(ws)!.deviceName = typeof ua === 'string' ? ua : undefined;
  broadcastState();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// 生产：如果 client 已 build，则由 server 托管静态文件
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
