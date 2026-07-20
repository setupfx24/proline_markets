'use client';

import { useEffect, useState } from 'react';

/**
 * True when the page is running as the installed app rather than a browser tab.
 *
 * Always false on the first render so the server and client markup agree; the
 * real value lands in the effect. Anything gated on this must therefore be safe
 * to show for one frame.
 */
export function useStandalone() {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    // iOS Safari never reports the display-mode media query for home-screen
    // apps and exposes this non-standard flag instead.
    const read = () =>
      setStandalone(mq.matches || (window.navigator as { standalone?: boolean }).standalone === true);

    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);

  return standalone;
}
