import React from 'react';
import { Modal, View, Pressable, StyleSheet, Text, Keyboard, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function Sheet({ visible, onClose, title, children, height }) {
  // Lift the bottom-anchored sheet above the on-screen keyboard so inputs
  // (e.g. the Set SL / TP fields) stay visible while typing. We track the
  // keyboard height and translate the sheet up by that amount rather than
  // relying on KeyboardAvoidingView, which is unreliable inside a
  // statusBarTranslucent Modal on Android.
  const [kbHeight, setKbHeight] = React.useState(0);
  React.useEffect(() => {
    if (!visible) {
      setKbHeight(0);
      return undefined;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => setKbHeight(e?.endCoordinates?.height ?? 0));
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView
        edges={kbHeight > 0 ? [] : ['bottom']}
        style={[styles.sheet, height ? { height } : null, kbHeight > 0 ? { marginBottom: kbHeight } : null]}
      >
        <View style={styles.handle} />
        {title ? (
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={vantage.textPrimary} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.body}>{children}</View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: vantage.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    maxHeight: '85%',
  },
  handle: { width: 36, height: 4, backgroundColor: vantage.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  body: {},
});
