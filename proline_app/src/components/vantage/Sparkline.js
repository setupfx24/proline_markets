import React, { memo, useMemo, useId } from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { vantage } from '../../theme/vantageTheme';

function Sparkline({
  data = [],
  width = 80,
  height = 28,
  strokeWidth = 1.5,
  color,
  fill = false,
}) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { path, areaPath, autoColor } = useMemo(() => {
    if (!Array.isArray(data) || data.length < 2) {
      return { path: '', areaPath: '', autoColor: vantage.textMuted };
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);

    let d = '';
    data.forEach((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
    });
    d = d.trim();
    // Close the area down to the baseline and back for an optional gradient fill.
    const area = `${d} L ${width.toFixed(2)} ${height.toFixed(2)} L 0 ${height.toFixed(2)} Z`;
    const up = data[data.length - 1] >= data[0];
    return { path: d, areaPath: area, autoColor: up ? vantage.up : vantage.down };
  }, [data, width, height]);

  const stroke = color || autoColor;

  if (!path) return <View style={{ width, height }} />;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {fill ? (
          <>
            <Defs>
              <LinearGradient id={`spark${gid}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={stroke} stopOpacity="0.28" />
                <Stop offset="1" stopColor={stroke} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path d={areaPath} fill={`url(#spark${gid})`} stroke="none" />
          </>
        ) : null}
        <Path
          d={path}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

// Memoized: rows re-render on every price tick — the SVG path must only be
// recomputed when this row's own data actually changes.
export default memo(Sparkline);
