import React, { useEffect, useRef } from 'react';
import LottieView from 'lottie-react-native';

// Lottie tab icon — plays its animation whenever the tab becomes active.
// Inactive tabs sit on the first frame (static).
export default function AnimatedTabIcon({ source, active, size = 26 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (active && ref.current) {
      ref.current.reset?.();
      ref.current.play?.();
    }
  }, [active]);

  return (
    <LottieView
      ref={ref}
      source={source}
      autoPlay={active}
      loop={false}
      style={{ width: size, height: size }}
    />
  );
}
