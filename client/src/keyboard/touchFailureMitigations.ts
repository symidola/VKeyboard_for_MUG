export type TouchFailureMitigationConfig = {
  // Historic workaround flags (temporarily disabled).
  simulateAlwaysTouch: boolean;
  touchPointerFallback: boolean;
  touchKeepAlivePress: boolean;
  strictTouchLock: boolean;
  suppressSyntheticClick: boolean;
  touchGapBridgeMs: number;

  // Historic timing knobs used by touch reconciliation.
  releaseMissThreshold: number;
  vanishedGraceMs: number;
  touchSessionGraceMs: number;
  touchNearestTolerancePx: number;
};

// Keep all touch-failure mitigation logic disabled for now.
export const TOUCH_FAILURE_MITIGATION_DISABLED: TouchFailureMitigationConfig = {
  simulateAlwaysTouch: false,
  touchPointerFallback: false,
  touchKeepAlivePress: false,
  strictTouchLock: false,
  suppressSyntheticClick: false,
  touchGapBridgeMs: 0,
  releaseMissThreshold: 1,
  vanishedGraceMs: 0,
  touchSessionGraceMs: 0,
  touchNearestTolerancePx: 42,
};

// Archive parser for previous experiments. It is intentionally not wired now.
export function readTouchFailureMitigationsArchive(
  qs: URLSearchParams,
  forceAlwaysTouch?: boolean,
): TouchFailureMitigationConfig {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/i.test(ua);

  const clampInt = (n: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, Math.trunc(n)));
  };

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
    simulateAlwaysTouch,
    touchPointerFallback,
    touchKeepAlivePress,
    strictTouchLock,
    suppressSyntheticClick,
    touchGapBridgeMs,
    releaseMissThreshold: 3,
    vanishedGraceMs: 22,
    touchSessionGraceMs: 96,
    touchNearestTolerancePx: 42,
  };
}
