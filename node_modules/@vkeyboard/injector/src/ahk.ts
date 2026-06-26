import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type AhkRunner = {
  sendLine: (line: string) => void;
  stop: () => void;
  exited: boolean;
};

function exists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function findAutoHotkeyExe(): string {
  return 'AutoHotkey64.exe';
}

export function resolveAutoHotkeyExe(custom?: string): string {
  if (custom) return custom;

  const programFiles = process.env['ProgramFiles'];
  const programFilesX86 = process.env['ProgramFiles(x86)'];
  const localAppData = process.env['LocalAppData'];

  const guesses: string[] = [];
  if (programFiles) guesses.push(path.join(programFiles, 'AutoHotkey', 'v2', 'AutoHotkey64.exe'));
  if (programFilesX86) guesses.push(path.join(programFilesX86, 'AutoHotkey', 'v2', 'AutoHotkey32.exe'));
  if (localAppData) guesses.push(path.join(localAppData, 'Programs', 'AutoHotkey', 'v2', 'AutoHotkey64.exe'));

  for (const g of guesses) {
    if (exists(g)) return g;
  }

  return findAutoHotkeyExe();
}

export function startAhk(params: {
  autoHotkeyExe?: string;
  scriptPath: string;
  verbose?: boolean;
  onExit?: (code: number | null) => void;
}): AhkRunner {
  const exe = resolveAutoHotkeyExe(params.autoHotkeyExe);

  const child: ChildProcessWithoutNullStreams = spawn(exe, [params.scriptPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: false,
  });

  child.stdout.on('data', (d) => {
    if (params.verbose) process.stdout.write(`[ahk] ${d.toString('utf8')}`);
  });
  child.stderr.on('data', (d) => {
    process.stderr.write(`[ahk-err] ${d.toString('utf8')}`);
  });

  let stopped = false;
  let exited = false;

  const handleExit = (code: number | null) => {
    if (stopped) return;
    stopped = true;
    exited = true;
    if (params.verbose) console.error(`[ahk] process exited code=${code}`);
    params.onExit?.(code);
  };

  child.on('exit', handleExit);
  child.on('error', (err) => {
    if (stopped) return;
    console.error(`[ahk] process error: ${err.message}`);
    handleExit(null);
  });

  return {
    exited: false,
    sendLine(line: string) {
      if (stopped || exited) return;
      try {
        child.stdin.write(line.replace(/\r?\n/g, '') + '\n');
      } catch (err: any) {
        if (err?.code === 'EPIPE' || err?.code === 'ERR_STREAM_DESTROYED') {
          console.error('[ahk] stdin write failed, process appears dead');
          handleExit(null);
        } else {
          throw err;
        }
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        child.stdin.end();
      } catch {
        // ignore
      }
      child.kill();
    },
  };
}
