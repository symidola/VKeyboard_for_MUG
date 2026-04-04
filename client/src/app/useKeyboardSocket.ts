import React from 'react';
import type {
  ClientRole,
  KeyboardKey,
  KeyboardLayout,
  KeyEventMessage,
  KeyStateMessage,
  ServerToClientMessage,
} from '@vkeyboard/shared';
import { createClientSocket, type WsStatus } from '../ws';

type UseKeyboardSocketParams = {
  mode: ClientRole;
  layout: KeyboardLayout;
};

type UseKeyboardSocketResult = {
  wsStatus: WsStatus;
  clientsCount: number;
  recvLog: string[];
  clearRecvLog: () => void;
  sendKey: (action: KeyEventMessage['action'], key: KeyboardKey) => void;
};

export function useKeyboardSocket(params: UseKeyboardSocketParams): UseKeyboardSocketResult {
  const { mode, layout } = params;

  const [wsStatus, setWsStatus] = React.useState<WsStatus>('disconnected');
  const [clientsCount, setClientsCount] = React.useState(0);
  const [recvLog, setRecvLog] = React.useState<string[]>([]);

  const socketRef = React.useRef<ReturnType<typeof createClientSocket> | null>(null);
  const pressedKeyIdsRef = React.useRef<Set<string>>(new Set());
  const keySeqRef = React.useRef<Map<string, number>>(new Map());
  const keyMetaRef = React.useRef<Map<string, { label: string; code?: string }>>(new Map());

  React.useEffect(() => {
    socketRef.current?.close();
    socketRef.current = createClientSocket({
      role: mode,
      deviceName: navigator.userAgent,
      onStatus: setWsStatus,
      onMessage: (msg: ServerToClientMessage) => {
        if (msg.type === 'state') {
          setClientsCount(msg.clients.length);
          return;
        }

        if (msg.type === 'key' && mode === 'receiver') {
          const line = `${new Date(msg.ts).toLocaleTimeString()}  ${msg.action}  ${msg.label} (${msg.keyId})`;
          setRecvLog((prev) => [line, ...prev].slice(0, 50));
          return;
        }

        if (msg.type === 'key_state' && mode === 'receiver') {
          if (msg.source !== 'edge') return;
          const pressed = msg.keys.filter((k) => k.pressed).map((k) => k.label).join(', ') || '-';
          const line = `${new Date(msg.ts).toLocaleTimeString()}  state  [${pressed}]`;
          setRecvLog((prev) => [line, ...prev].slice(0, 50));
        }
      },
    });

    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [mode]);

  const sendKeyState = React.useCallback(
    (source: KeyStateMessage['source']) => {
      const keys = layout.rows.flatMap((r) => r.keys).map((k) => {
        keyMetaRef.current.set(k.id, { label: k.label, code: k.code });
        return {
          keyId: k.id,
          label: k.label,
          code: k.code,
          pressed: pressedKeyIdsRef.current.has(k.id),
          seq: keySeqRef.current.get(k.id) ?? 0,
        };
      });

      // Keep old keys in state snapshots so receiver can release orphaned presses after layout edits.
      for (const [keyId, meta] of keyMetaRef.current.entries()) {
        if (keys.some((k) => k.keyId === keyId)) continue;
        keys.push({
          keyId,
          label: meta.label,
          code: meta.code,
          pressed: pressedKeyIdsRef.current.has(keyId),
          seq: keySeqRef.current.get(keyId) ?? 0,
        });
      }

      const msg: KeyStateMessage = {
        type: 'key_state',
        ts: Date.now(),
        keys,
        source,
      };

      const ok = socketRef.current?.send(msg) ?? false;
      if (!ok && source === 'edge') {
        (window as any).__VKDBG__?.log?.('ws:drop-state', { wsStatus });
      }
    },
    [layout, wsStatus],
  );

  React.useEffect(() => {
    if (mode !== 'keyboard') return;
    const id = window.setInterval(() => {
      sendKeyState('heartbeat');
    }, 45);
    return () => window.clearInterval(id);
  }, [mode, sendKeyState]);

  const sendKey = React.useCallback(
    (action: KeyEventMessage['action'], key: KeyboardKey) => {
      if (key.id === '__guard__') return;

      keyMetaRef.current.set(key.id, { label: key.label, code: key.code });

      const nextSeq = (keySeqRef.current.get(key.id) ?? 0) + 1;
      keySeqRef.current.set(key.id, nextSeq);

      if (action === 'down') {
        pressedKeyIdsRef.current.add(key.id);
      } else if (action === 'up' || action === 'tap') {
        pressedKeyIdsRef.current.delete(key.id);
      }

      const msg: KeyEventMessage = {
        type: 'key',
        action,
        keyId: key.id,
        label: key.label,
        code: key.code,
        ts: Date.now(),
      };

      const ok = socketRef.current?.send(msg) ?? false;
      (window as any).__VKDBG__?.log?.(ok ? 'ws:send' : 'ws:drop', {
        action,
        keyId: key.id,
        label: key.label,
        wsStatus,
      });

      sendKeyState('edge');
    },
    [sendKeyState, wsStatus],
  );

  const clearRecvLog = React.useCallback(() => {
    setRecvLog([]);
  }, []);

  return {
    wsStatus,
    clientsCount,
    recvLog,
    clearRecvLog,
    sendKey,
  };
}
