import type { ClientRole, ClientToServerMessage, ServerToClientMessage } from '@vkeyboard/shared';

export type WsStatus = 'disconnected' | 'connecting' | 'connected';

function isValidWsUrl(raw: string | null): raw is string {
  if (!raw) return false;
  return /^wss?:\/\//i.test(raw);
}

function readWsOverride(): string | null {
  try {
    const qs = new URLSearchParams(window.location.search);
    const fromQuery = qs.get('ws');
    if (isValidWsUrl(fromQuery)) {
      localStorage.setItem('vk_ws_url', fromQuery);
      return fromQuery;
    }

    const fromStorage = localStorage.getItem('vk_ws_url');
    if (isValidWsUrl(fromStorage)) return fromStorage;
  } catch {
    // ignore
  }

  const fromEnv = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  if (isValidWsUrl(fromEnv ?? null)) return fromEnv ?? null;
  return null;
}

export function makeWsUrl(): string {
  const override = readWsOverride();
  if (override) return override;

  const isSecure = window.location.protocol === 'https:';
  const host = window.location.hostname;
  const proto = isSecure ? 'wss' : 'ws';
  return `${proto}://${host}:8080/ws`;
}

export function createClientSocket(params: {
  role: ClientRole;
  deviceName?: string;
  onMessage: (msg: ServerToClientMessage) => void;
  onStatus: (s: WsStatus) => void;
}): { send: (msg: ClientToServerMessage) => boolean; close: () => void } {
  params.onStatus('connecting');

  const ws = new WebSocket(makeWsUrl());

  ws.addEventListener('open', () => {
    params.onStatus('connected');
    const hello: ClientToServerMessage = {
      type: 'hello',
      role: params.role,
      deviceName: params.deviceName,
    };
    ws.send(JSON.stringify(hello));
  });

  ws.addEventListener('close', () => params.onStatus('disconnected'));
  ws.addEventListener('error', () => params.onStatus('disconnected'));

  ws.addEventListener('message', (ev) => {
    if (typeof ev.data !== 'string') return;
    try {
      const msg = JSON.parse(ev.data) as ServerToClientMessage;
      if (!msg || typeof msg !== 'object' || typeof (msg as any).type !== 'string') return;
      params.onMessage(msg);
    } catch {
      // ignore
    }
  });

  return {
    send(msg) {
      if (ws.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(msg));
      return true;
    },
    close() {
      ws.close();
    },
  };
}
