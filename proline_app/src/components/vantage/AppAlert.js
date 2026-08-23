import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

// Imperative, themed replacement for the OS-default Alert.alert — same
// fire-and-forget API as showToast, but renders a centered popup that matches
// the app theme. Used for calm informational messages (NOT errors).

let queue = [];
let listeners = new Set();

export function showAppAlert({ title, message, confirmText = 'OK', onConfirm } = {}) {
  queue.push({ id: Date.now() + Math.random(), title, message, confirmText, onConfirm });
  listeners.forEach((fn) => fn());
}

export default function AppAlertHost() {
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const tick = () => {
      if (!current && queue.length) setCurrent(queue.shift());
    };
    listeners.add(tick);
    tick(); // drain anything queued before this host mounted
    return () => listeners.delete(tick);
  }, [current]);

  const close = () => {
    const cb = current?.onConfirm;
    setCurrent(null);
    if (typeof cb === 'function') cb();
  };

  return (
    <Modal
      visible={!!current}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {current?.title ? <Text style={styles.title}>{current.title}</Text> : null}
          {current?.message ? <Text style={styles.message}>{current.message}</Text> : null}
          <Pressable
            onPress={close}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={styles.btnTxt}>{current?.confirmText || 'OK'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: vantage.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: vantage.border,
    padding: space.xl,
  },
  title: {
    color: vantage.textPrimary,
    fontFamily,
    fontSize: sizes.h2,
    fontWeight: weights.heavy,
    marginBottom: space.sm,
  },
  message: {
    color: vantage.textSecondary,
    fontFamily,
    fontSize: sizes.body,
    lineHeight: 20,
    marginBottom: space.lg,
  },
  btn: {
    backgroundColor: vantage.accent,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  btnTxt: {
    color: vantage.textInverse,
    fontFamily,
    fontSize: sizes.body,
    fontWeight: weights.heavy,
  },
});
