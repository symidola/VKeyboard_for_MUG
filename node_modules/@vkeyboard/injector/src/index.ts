import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import type { ClientToServerMessage, KeyEventMessage, ServerToClientMessage } from '@vkeyboard/shared';
import { startAhk } from './ahk';

type Args = {
  server: string;
  autoHotkeyExe?: string;
  verbose: boolean;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    server: 'ws://127.0.0.1:8080/ws',
    verbose: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--server' && argv[i + 1]) {
      args.server = argv[++i];
      continue;
    }
    if (a === '--ahk' && argv[i + 1]) {
      args.autoHotkeyExe = argv[++i];
      continue;
    }
    if (a === '--verbose') {
      args.verbose = true;
      continue;
    }
    if (a === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (a === '--help' || a === '-h') {
      printHelpAndExit();
    }
  }

  return args;
}

function printHelpAndExit(): never {
  console.log(`vkeyboard-injector

Usage:
  npm -w injector run dev -- --server ws://<PC-IP>:8080/ws
  npm -w injector run start -- --server ws://127.0.0.1:8080/ws

Options:
  --server <wsUrl>   WebSocket server url (default: ws://127.0.0.1:8080/ws)
  --ahk <path>       AutoHotkey v2 executable path (optional)
  --dry-run          Print events but do not inject
  --verbose          Verbose logs
`);
  process.exit(0);
}

function toAhkKey(code?: string, label?: string): string | null {
  if (!code && !label) return null;

  // Prefer code mapping.
  const c = code ?? '';

  const vkDirect: Record<string, number> = {
    Enter: 0x0d,
    NumpadEnter: 0x0d,
    Backspace: 0x08,
    Tab: 0x09,
    Escape: 0x1b,
    Space: 0x20,
    ArrowLeft: 0x25,
    ArrowUp: 0x26,
    ArrowRight: 0x27,
    ArrowDown: 0x28,
    Home: 0x24,
    End: 0x23,
    PageUp: 0x21,
    PageDown: 0x22,
    Insert: 0x2d,
    Delete: 0x2e,
    CapsLock: 0x14,
    ShiftLeft: 0xa0,
    ShiftRight: 0xa1,
    ControlLeft: 0xa2,
    ControlRight: 0xa3,
    AltLeft: 0xa4,
    AltRight: 0xa5,
    Semicolon: 0xba,
    Equal: 0xbb,
    Comma: 0xbc,
    Minus: 0xbd,
    Period: 0xbe,
    Slash: 0xbf,
    Backquote: 0xc0,
    BracketLeft: 0xdb,
    Backslash: 0xdc,
    BracketRight: 0xdd,
    Quote: 0xde,
  };

  if (vkDirect[c] != null) {
    return `vk${vkDirect[c].toString(16).toUpperCase().padStart(2, '0')}`;
  }

  // KeyA..KeyZ
  const mKey = /^Key([A-Z])$/.exec(c);
  if (mKey) {
    const vk = 0x41 + (mKey[1].charCodeAt(0) - 65);
    return `vk${vk.toString(16).toUpperCase()}`;
  }

  // Digit0..Digit9
  const mDigit = /^Digit([0-9])$/.exec(c);
  if (mDigit) {
    const vk = 0x30 + Number(mDigit[1]);
    return `vk${vk.toString(16).toUpperCase()}`;
  }

  // F1..F24
  const mF = /^F([1-9]|1[0-9]|2[0-4])$/.exec(c);
  if (mF) {
    const n = Number(mF[1]);
    const vk = 0x70 + (n - 1);
    return `vk${vk.toString(16).toUpperCase()}`;
  }

  // Fallback: if label is a single char, try its ASCII VK (best-effort)
  if (label && label.length === 1) {
    const ch = label.charCodeAt(0);
    if (ch >= 0x20 && ch <= 0x7e) {
      return `vk${ch.toString(16).toUpperCase()}`;
    }
  }

  return null;
}

function toAhkLine(msg: KeyEventMessage): string | null {
  const key = toAhkKey(msg.code, msg.label);
  if (!key) return null;

  // Protocol: <action>\t<key>
  // action: down|up|tap
  return `${msg.action}\t${key}`;
}

const args = parseArgs(process.argv.slice(2));

if (process.platform !== 'win32') {
  console.error('[injector] This injector is Windows-only (uses AutoHotkey).');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ahkScriptPath = path.resolve(__dirname, '../ahk/VKeyboardInject.ahk');

const ahk = args.dryRun
  ? null
  : startAhk({
      autoHotkeyExe: args.autoHotkeyExe,
      scriptPath: ahkScriptPath,
      verbose: args.verbose,
    });

console.log(`[injector] connecting: ${args.server}`);
console.log(`[injector] dryRun=${args.dryRun}`);

const ws = new WebSocket(args.server, {
  perMessageDeflate: false,
});

ws.on('open', () => {
  const hello: ClientToServerMessage = {
    type: 'hello',
    role: 'receiver',
    deviceName: 'windows-injector',
  };
  ws.send(JSON.stringify(hello));
  console.log('[injector] connected');
});

ws.on('message', (data) => {
  const text = typeof data === 'string' ? data : data.toString('utf8');
  let msg: ServerToClientMessage;
  try {
    msg = JSON.parse(text) as ServerToClientMessage;
  } catch {
    return;
  }

  if (msg.type !== 'key') return;

  const line = toAhkLine(msg);
  if (!line) return;

  if (args.dryRun) {
    console.log(`[injector] ${line}`);
    return;
  }

  ahk?.sendLine(line);
});

ws.on('close', () => {
  console.log('[injector] disconnected');
  ahk?.stop();
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('[injector] ws error', err);
  ahk?.stop();
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n[injector] stopping...');
  try {
    ws.close();
  } catch {
    // ignore
  }
  ahk?.stop();
  process.exit(0);
});
