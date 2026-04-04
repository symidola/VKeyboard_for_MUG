import type { KeyboardKey, KeyboardLayout } from '@vkeyboard/shared';
import type { AbsBounds, AbsKeyRect } from './types';

export type KeyboardRuntimeFlags = {
  debugTouch: boolean;
  debugTouchMove: boolean;
  logToServer: boolean;
  touchPrimary: boolean;
  simulateAlwaysTouch: boolean;
  touchPointerFallback: boolean;
  touchKeepAlivePress: boolean;
  strictTouchLock: boolean;
  suppressSyntheticClick: boolean;
  touchGapBridgeMs: number;
};

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

// 读取布局中的单位像素，非法值时回退默认值。
export function getUnitPx(layout: KeyboardLayout): number {
  return typeof layout.unitPx === 'number' && layout.unitPx > 10 ? layout.unitPx : 52;
}

// 读取布局中的按键间距，非法值时回退默认值。
export function getGapPx(layout: KeyboardLayout): number {
  return typeof layout.gapPx === 'number' && layout.gapPx >= 0 ? layout.gapPx : 8;
}

// URL 参数解析需容错，避免极端环境下抛错影响输入链路。
export function safeSearchParams(): URLSearchParams {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

// 把事件目标压缩成可读摘要，便于调试日志查看。
export function describeTarget(t: EventTarget | null): {
  tag?: string;
  id?: string;
  cls?: string;
  text?: string;
} {
  const el = t as HTMLElement | null;
  if (!el || typeof (el as any).tagName !== 'string') return {};
  const tag = el.tagName;
  const id = el.id || undefined;
  const cls = typeof el.className === 'string' ? el.className : undefined;
  const text = (el.textContent || '').trim().slice(0, 40) || undefined;
  return { tag, id, cls, text };
}

// 统一读取 URL 开关与外部强制参数，减少组件内分散判断。
export function readKeyboardRuntimeFlags(qs: URLSearchParams, forceAlwaysTouch?: boolean): KeyboardRuntimeFlags {
  const debugTouch = qs.has('debugTouch');
  const debugTouchMove = qs.has('debugTouchMove');
  const logToServer = qs.has('logToServer');
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/i.test(ua);

  const touchPrimary = qs.has('touchPrimaryOff') ? false : true;

  const simulateAlwaysTouch = forceAlwaysTouch
    ? true
    : qs.has('noAlwaysTouch')
      ? false
      : qs.has('alwaysTouch');

  const touchPointerFallback = qs.has('touchPointerFallback')
    ? true
    : qs.has('noTouchPointerFallback')
      ? false
      : isIOS;

  const touchKeepAlivePress = qs.has('touchKeepAlivePress')
    ? true
    : qs.has('noTouchKeepAlivePress')
      ? false
      : false;

  const strictTouchLock = qs.has('strictTouchLock')
    ? true
    : qs.has('noStrictTouchLock')
      ? false
      : isIOS;

  const suppressSyntheticClick = qs.has('suppressSyntheticClick')
    ? true
    : qs.has('noSuppressSyntheticClick')
      ? false
      : false;

  const touchGapBridgeMs = (() => {
    const raw = qs.get('touchGapBridgeMs');
    if (raw != null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) return clampInt(n, 0, 400);
    }
    if (qs.has('touchGapBridge')) return 140;
    if (qs.has('noTouchGapBridge')) return 0;
    return 0;
  })();

  return {
    debugTouch,
    debugTouchMove,
    logToServer,
    touchPrimary,
    simulateAlwaysTouch,
    touchPointerFallback,
    touchKeepAlivePress,
    strictTouchLock,
    suppressSyntheticClick,
    touchGapBridgeMs,
  };
}

// 调试日志上报地址：支持 URL 覆盖，默认回退到同主机 8080 端口。
export function makeDebugLogUrl(qs: URLSearchParams): string {
  const override = qs.get('logUrl');
  if (override && /^https?:\/\//i.test(override)) return override;
  const isSecure = window.location.protocol === 'https:';
  const host = window.location.hostname;
  const proto = isSecure ? 'https' : 'http';
  return `${proto}://${host}:8080/debug/log`;
}

// 计算绝对布局的包围盒，供缩放和命中计算复用。
export function computeAbsBounds(
  allKeys: KeyboardKey[],
  hasAbsolute: boolean,
  gapPx: number,
  pitch: number,
  unitPx: number,
): AbsBounds | null {
  if (!hasAbsolute) return null;
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;

  for (const k of allKeys) {
    const x = typeof k.x === 'number' ? k.x : 0;
    const y = typeof k.y === 'number' ? k.y : 0;
    const w = Math.max(0.25, k.width);
    const h = Math.max(0.25, k.height);

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  const pad = gapPx;
  const width = (maxX - minX) * pitch - gapPx + pad * 2;
  const height = (maxY - minY) * pitch - gapPx + pad * 2;
  return {
    minX,
    minY,
    width: Math.max(200, Math.ceil(width)),
    height: Math.max(unitPx, Math.ceil(height)),
    pad,
  };
}

// 预计算每个按键的绝对像素矩形，降低运行时命中计算成本。
export function computeAbsKeyRects(
  allKeys: KeyboardKey[],
  hasAbsolute: boolean,
  absBounds: AbsBounds | null,
  unitPx: number,
  gapPx: number,
  pitch: number,
): AbsKeyRect[] | null {
  if (!hasAbsolute || !absBounds) return null;
  return allKeys.map((k) => {
    const w = Math.max(0.25, k.width);
    const h = Math.max(0.25, k.height);
    const x = typeof k.x === 'number' ? k.x : 0;
    const y = typeof k.y === 'number' ? k.y : 0;
    const keyWidthPx = unitPx * w + gapPx * (w - 1);
    const keyHeightPx = unitPx * h;
    return {
      key: k,
      left: absBounds.pad + (x - absBounds.minX) * pitch,
      top: absBounds.pad + (y - absBounds.minY) * pitch,
      width: keyWidthPx,
      height: keyHeightPx,
    };
  });
}
