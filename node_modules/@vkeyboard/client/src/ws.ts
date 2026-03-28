import type { ClientRole, ClientToServerMessage, ServerToClientMessage } from '@vkeyboard/shared';

export type WsStatus = 'disconnected' | 'connecting' | 'connected';

export function makeWsUrl(): string {
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
}): { send: (msg: ClientToServerMessage) => void; close: () => void } {
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
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify(msg));
    },
    close() {
      ws.close();
    },
  };
}
