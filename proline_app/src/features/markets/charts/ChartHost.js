import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View } from 'react-native';
import NativeChart from './NativeChart';
import { vantage } from '../../../theme/vantageTheme';

/**
 * Persistent chart host — ONE NativeChart WebView, mounted once for the whole
 * app session and positioned over whichever chart screen is active. This is why
 * the chart loads fast: the 26 MB charting library is parsed ONCE (first open),
 * then every later chart open just re-positions the SAME WebView and swaps the
 * symbol (injected, no reload) instead of remounting a fresh 26 MB WebView.
 *
 * A screen calls show({ symbol, interval, theme, accountId, rect }) on focus and
 * hide() on blur. `rect` is the on-screen rectangle (from measureInWindow) of
 * the screen's chart placeholder. When hidden, the WebView is parked off-screen
 * (still mounted → library stays warm).
 */
const ChartHostContext = createContext(null);

export function useChartHost() {
  return useContext(ChartHostContext) || { show: () => {}, hide: () => {} };
}

const OFFSCREEN = { position: 'absolute', left: -100000, top: 0, width: 320, height: 320 };

export function ChartHostProvider({ children }) {
  // cfg: { symbol, interval, theme, accountId, rect:{x,y,width,height}, visible }
  const [cfg, setCfg] = useState(null);
  const everShown = useRef(false);
  if (cfg) everShown.current = true; // once shown, keep the WebView mounted forever

  const show = useCallback((c) => {
    setCfg((prev) => {
      const next = { ...(prev || {}), ...c, visible: true };
      // De-dupe: if nothing meaningful changed, return the SAME object so the
      // host doesn't re-render/reposition. The account poll (every 2.5s) was
      // calling show() with identical values → the chart blinked/flickered.
      const r1 = prev && prev.rect, r2 = next.rect;
      const rectSame = (!r1 && !r2) || (r1 && r2
        && Math.round(r1.x) === Math.round(r2.x)
        && Math.round(r1.y) === Math.round(r2.y)
        && Math.round(r1.width) === Math.round(r2.width)
        && Math.round(r1.height) === Math.round(r2.height));
      if (prev && prev.visible === next.visible && prev.symbol === next.symbol
        && prev.interval === next.interval && prev.theme === next.theme
        && prev.accountId === next.accountId && rectSame) {
        return prev;
      }
      return next;
    });
  }, []);
  const hide = useCallback(() => {
    setCfg((prev) => (prev ? { ...prev, visible: false } : prev));
  }, []);

  const positioned = cfg && cfg.visible && cfg.rect && cfg.rect.width > 0;
  const style = positioned
    ? { position: 'absolute', left: cfg.rect.x, top: cfg.rect.y, width: cfg.rect.width, height: cfg.rect.height, zIndex: 30, backgroundColor: vantage.bg }
    : OFFSCREEN;

  return (
    <ChartHostContext.Provider value={{ show, hide }}>
      {children}
      {everShown.current ? (
        <View pointerEvents={positioned ? 'box-none' : 'none'} style={style}>
          <NativeChart
            symbol={cfg?.symbol || 'EURUSD'}
            interval={cfg?.interval || '60'}
            theme={cfg?.theme}
            accountId={cfg?.accountId}
          />
        </View>
      ) : null}
    </ChartHostContext.Provider>
  );
}
