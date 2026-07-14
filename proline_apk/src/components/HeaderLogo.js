import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

// Small ProlineMarkets logo for screen headers, with a fade + scale entrance.
export default function HeaderLogo({ size = 36 }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <Animated.Image
      source={require("../../assets/logo.png")}
      style={[
        styles.logo,
        { width: size, height: size, opacity: anim, transform: [{ scale }] },
      ]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: { borderRadius: 8 },
});
