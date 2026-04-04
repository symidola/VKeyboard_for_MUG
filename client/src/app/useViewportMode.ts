import React from 'react';

type ViewportMode = {
  isPhone: boolean;
  isPortrait: boolean;
};

function detectPhone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(max-width: 820px) and (pointer: coarse)').matches ?? false;
}

function detectPortrait(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth;
}

export function useViewportMode(): ViewportMode {
  const [isPhone, setIsPhone] = React.useState<boolean>(detectPhone);
  const [isPortrait, setIsPortrait] = React.useState<boolean>(detectPortrait);

  React.useEffect(() => {
    // Keep orientation and coarse-pointer detection in one place.
    const update = () => {
      setIsPortrait(detectPortrait());
      setIsPhone(detectPhone());
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update as EventListener);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update as EventListener);
    };
  }, []);

  return { isPhone, isPortrait };
}
