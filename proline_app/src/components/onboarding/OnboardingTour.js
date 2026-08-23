/**
 * Dependency-free coach-mark tour (TradingView/Binance-style).
 *
 * Features:
 *  - dimmed backdrop with an animated SPOTLIGHT cutout that glides between
 *    targets (four dark rects + accent ring, no SVG masks)
 *  - tooltip card with icon, title, description, progress dots and
 *    Back / Next / Skip / Finish controls; card content cross-fades on step
 *    change and auto-positions above/below the target (centred when the step
 *    has no target)
 *  - responsive: card is width-capped and the spotlight math is
 *    window-relative, so tablets/landscape work unchanged
 *  - extensible: steps are plain data `{ key, icon, title, text, target }`;
 *    an optional async `step.prepare()` hook runs before a step is shown
 *    (reserved for future scroll-into-view of off-screen targets)
 *
 * Steps: [{ key, icon, title, text, target: {x,y,width,height}|null, prepare? }]
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet, Animated, Easing, useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

const DIM = 'rgba(0,0,0,0.80)';
const SPOT_PAD = 6;      // breathing room around the highlighted element
const CARD_GAP = 14;     // gap between spotlight and the card
const ANIM_MS = 260;
const POINTER_SIZE = 36; // the bouncing "tap here" hand
const POINTER_GAP = 46;  // space reserved between spotlight and card for it
const ANCHORED_CARD_W = 310;

/** Bouncing tap-hand that hovers over the spotlighted element. */
function TapPointer({ x, y }) {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 8, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - POINTER_SIZE / 2,
        top: y,
        transform: [{ translateY: bounce }],
      }}
    >
      <MaterialCommunityIcons
        name="gesture-tap"
        size={POINTER_SIZE}
        color="#fff"
        style={{ textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } }}
      />
    </Animated.View>
  );
}

export default function OnboardingTour({ visible, steps = [], onDone }) {
  const [index, setIndex] = useState(0);
  const { width: winW, height: winH } = useWindowDimensions();

  // Animated spotlight rect + card opacity. The spotlight GLIDES from the
  // previous target to the next; the card cross-fades.
  const spotX = useRef(new Animated.Value(0)).current;
  const spotY = useRef(new Animated.Value(0)).current;
  const spotW = useRef(new Animated.Value(0)).current;
  const spotH = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const hasSpotRef = useRef(false);

  const step = steps[Math.min(index, Math.max(0, steps.length - 1))] || null;
  const isLast = index >= steps.length - 1;

  const spotRectFor = useCallback((s) => {
    if (!s?.target) return null;
    const t = s.target;
    return {
      x: Math.max(0, t.x - SPOT_PAD),
      y: Math.max(0, t.y - SPOT_PAD),
      w: Math.min(winW, t.width + SPOT_PAD * 2),
      h: t.height + SPOT_PAD * 2,
    };
  }, [winW]);

  // Drive the animation whenever the step changes.
  useEffect(() => {
    if (!visible || !step) return;
    let cancelled = false;
    (async () => {
      try { await step.prepare?.(); } catch { /* prepare is best-effort */ }
      if (cancelled) return;
      const rect = spotRectFor(step);
      const anims = [];
      if (rect) {
        const move = (v, to) => Animated.timing(v, {
          toValue: to, duration: ANIM_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false,
        });
        if (!hasSpotRef.current) {
          // First spotlight: appear in place (no glide from 0,0).
          spotX.setValue(rect.x); spotY.setValue(rect.y);
          spotW.setValue(rect.w); spotH.setValue(rect.h);
        } else {
          anims.push(move(spotX, rect.x), move(spotY, rect.y), move(spotW, rect.w), move(spotH, rect.h));
        }
        hasSpotRef.current = true;
      } else {
        hasSpotRef.current = false;
      }
      cardOpacity.setValue(0);
      anims.push(Animated.timing(cardOpacity, {
        toValue: 1, duration: ANIM_MS, easing: Easing.out(Easing.quad), useNativeDriver: false,
      }));
      Animated.parallel(anims).start();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, index, steps]);

  if (!visible || !step) return null;

  const finish = () => { setIndex(0); hasSpotRef.current = false; onDone?.(); };
  const next = () => (isLast ? finish() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const rect = spotRectFor(step);
  // Card above the target when the target sits in the lower half.
  const cardAbove = rect ? rect.y + rect.h / 2 > winH / 2 : false;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={finish}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {rect ? (
          <>
            {/* Animated dim rects around the gliding spotlight. */}
            <Animated.View style={[styles.dim, { top: 0, left: 0, right: 0, height: spotY }]} />
            <Animated.View style={[styles.dim, { top: spotY, left: 0, width: spotX, height: spotH }]} />
            <Animated.View
              style={[styles.dim, {
                top: spotY, height: spotH, right: 0,
                left: Animated.add(spotX, spotW),
              }]}
            />
            <Animated.View style={[styles.dim, { top: Animated.add(spotY, spotH), left: 0, right: 0, bottom: 0 }]} />
            <Animated.View
              pointerEvents="none"
              style={[styles.ring, { top: spotY, left: spotX, width: spotW, height: spotH }]}
            />
          </>
        ) : (
          <View style={[styles.dim, StyleSheet.absoluteFill]} />
        )}

        {/* Bouncing "tap here" hand over the spotlighted element. */}
        {rect ? (
          <TapPointer
            x={rect.x + rect.w / 2}
            y={cardAbove ? rect.y - POINTER_GAP + 4 : rect.y + rect.h + 8}
          />
        ) : null}

        {/* Tooltip card. Anchored steps get a COMPACT card horizontally
            centred on the target (clamped to the screen) with room for the
            pointer between them; targetless steps get a centred card. */}
        <View
          style={[
            styles.cardWrap,
            rect
              ? {
                  alignItems: 'flex-start',
                  paddingHorizontal: 0,
                  left: Math.min(
                    Math.max(space.md, rect.x + rect.w / 2 - ANCHORED_CARD_W / 2),
                    Math.max(space.md, winW - ANCHORED_CARD_W - space.md),
                  ),
                  right: undefined,
                  width: Math.min(ANCHORED_CARD_W, winW - space.md * 2),
                  ...(cardAbove
                    ? { bottom: winH - rect.y + CARD_GAP + POINTER_GAP - 8 }
                    : { top: rect.y + rect.h + CARD_GAP + POINTER_GAP }),
                }
              : { top: 0, bottom: 0, justifyContent: 'center' },
          ]}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.card, { opacity: cardOpacity }]}>
            <View style={styles.titleRow}>
              {step.icon ? (
                <View style={styles.iconBadge}>
                  <Ionicons name={step.icon} size={18} color={vantage.accent} />
                </View>
              ) : null}
              <Text style={styles.title}>{step.title}</Text>
            </View>
            <Text style={styles.text}>{step.text}</Text>

            <View style={styles.footer}>
              <View style={styles.dots}>
                {steps.map((s, i) => (
                  <View key={s.key || i} style={[styles.dot, i === index && styles.dotActive]} />
                ))}
              </View>
              <View style={styles.btnRow}>
                {!isLast && (
                  <Pressable onPress={finish} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip tour">
                    <Text style={styles.skip}>Skip</Text>
                  </Pressable>
                )}
                {index > 0 && (
                  <Pressable onPress={back} style={styles.backBtn} hitSlop={4} accessibilityRole="button" accessibilityLabel="Previous tip">
                    <Ionicons name="chevron-back" size={16} color={vantage.textSecondary} />
                    <Text style={styles.backTxt}>Back</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={next}
                  style={styles.nextBtn}
                  accessibilityRole="button"
                  accessibilityLabel={isLast ? 'Finish tour' : 'Next tip'}
                >
                  <Text style={styles.nextTxt}>{isLast ? 'Finish' : 'Next'}</Text>
                  {!isLast && <Ionicons name="chevron-forward" size={14} color="#fff" />}
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: DIM },
  ring: {
    position: 'absolute',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: vantage.accent,
    shadowColor: vantage.accent,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  cardWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.xl },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: vantage.bgElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: vantage.border,
    padding: space.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  iconBadge: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: vantage.accentMuted || 'rgba(242,106,31,0.14)',
  },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, flexShrink: 1 },
  text: { color: vantage.textSecondary, fontFamily, fontSize: sizes.body, marginTop: space.sm, lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, gap: space.md },
  dots: { flexDirection: 'row', gap: 4, flexShrink: 1, flexWrap: 'wrap', maxWidth: 120 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: vantage.border },
  dotActive: { backgroundColor: vantage.accent, width: 16 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  skip: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: space.xs },
  backTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: vantage.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  nextTxt: { color: '#fff', fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
});
