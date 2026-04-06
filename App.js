import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import htmlContent from './htmlContent';

const { width, height } = Dimensions.get('window');

// ─── Splash Screen ───────────────────────────────────────────────────────────
function SplashScreen({ onFinish }) {
  // Animations
  const bgOpacity     = useRef(new Animated.Value(1)).current;
  const logoScale     = useRef(new Animated.Value(0.55)).current;
  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const glowScale     = useRef(new Animated.Value(0.4)).current;
  const glowOpacity   = useRef(new Animated.Value(0)).current;
  const titleY        = useRef(new Animated.Value(18)).current;
  const titleOpacity  = useRef(new Animated.Value(0)).current;
  const tagY          = useRef(new Animated.Value(12)).current;
  const tagOpacity    = useRef(new Animated.Value(0)).current;
  const dotsOpacity   = useRef(new Animated.Value(0)).current;
  const ring1Scale    = useRef(new Animated.Value(0.6)).current;
  const ring1Opacity  = useRef(new Animated.Value(0)).current;
  const ring2Scale    = useRef(new Animated.Value(0.5)).current;
  const ring2Opacity  = useRef(new Animated.Value(0)).current;
  const slideY        = useRef(new Animated.Value(0)).current;
  const exitOpacity   = useRef(new Animated.Value(1)).current;

  // Dot pulse loop
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const spring = (val, toValue, delay = 0, tension = 80, friction = 9) =>
      Animated.spring(val, { toValue, tension, friction, delay, useNativeDriver: true });

    const ease = (val, toValue, duration = 420, delay = 0, easing = Easing.out(Easing.cubic)) =>
      Animated.timing(val, { toValue, duration, delay, easing, useNativeDriver: true });

    // Phase 1 — Glow + logo burst in
    Animated.sequence([
      Animated.parallel([
        ease(glowOpacity,  0.55, 600, 0),
        spring(glowScale,  1.15, 0,   40, 12),
        ease(logoOpacity,  1,    400, 80),
        spring(logoScale,  1,    80,  90, 10),
        ease(ring1Opacity, 0.22, 500, 120),
        spring(ring1Scale, 1.4,  120, 30, 14),
        ease(ring2Opacity, 0.12, 600, 200),
        spring(ring2Scale, 1.9,  200, 25, 16),
      ]),

      // Phase 2 — Title slides up
      Animated.parallel([
        ease(titleOpacity, 1,    320, 0),
        spring(titleY,     0,    0,   90, 11),
        ease(tagOpacity,   1,    320, 100),
        spring(tagY,       0,    100, 90, 11),
        ease(dotsOpacity,  1,    280, 180),
      ]),

      // Phase 3 — Hold
      Animated.delay(900),

      // Phase 4 — Exit: slide up + fade out
      Animated.parallel([
        ease(slideY,      -height * 0.06, 480, 0, Easing.inOut(Easing.cubic)),
        ease(exitOpacity, 0,              400, 80, Easing.in(Easing.cubic)),
      ]),
    ]).start(() => onFinish());

    // Dot pulse loop
    const pulseDot = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1,   duration: 340, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 340, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

    setTimeout(() => {
      pulseDot(dot1, 0);
      pulseDot(dot2, 180);
      pulseDot(dot3, 360);
    }, 1200);
  }, []);

  return (
    <Animated.View
      style={[
        styles.splash,
        { opacity: exitOpacity, transform: [{ translateY: slideY }] },
      ]}
    >
      {/* Ambient background orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <View style={styles.orb3} />

      {/* Pulsing rings */}
      <Animated.View
        style={[
          styles.ring,
          { width: 240, height: 240, borderRadius: 120,
            opacity: ring1Opacity, transform: [{ scale: ring1Scale }] },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          { width: 340, height: 340, borderRadius: 170,
            opacity: ring2Opacity, transform: [{ scale: ring2Scale }] },
        ]}
      />

      {/* Glow behind logo */}
      <Animated.View
        style={[
          styles.glow,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoWrap,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Text style={styles.logoEmoji}>🏆</Text>
      </Animated.View>

      {/* Title */}
      <Animated.Text
        style={[
          styles.splashTitle,
          { opacity: titleOpacity, transform: [{ translateY: titleY }] },
        ]}
      >
        BetTracker Pro
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text
        style={[
          styles.splashTag,
          { opacity: tagOpacity, transform: [{ translateY: tagY }] },
        ]}
      >
        Smart · Fast · Disciplined
      </Animated.Text>

      {/* Loading dots */}
      <Animated.View style={[styles.dotsRow, { opacity: dotsOpacity }]}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { opacity: dot }]}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

// ─── WebView wrapper with fade-in ────────────────────────────────────────────
function AppWebView({ splashDone }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const loaded = useRef(false);

  const tryFadeIn = () => {
    if (loaded.current && splashDone) {
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  };

  const handleLoad = () => {
    loaded.current = true;
    tryFadeIn();
  };

  // When splash finishes, fade in if WebView already loaded
  useEffect(() => {
    if (splashDone) tryFadeIn();
  }, [splashDone]);

  return (
    <Animated.View style={[{ flex: 1 }, { opacity: fadeIn }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: 'https://localhost' }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        allowsInlineMediaPlayback
        allowsBackForwardNavigationGestures
        onLoadEnd={handleLoad}
        style={{ flex: 1, backgroundColor: '#000' }}
      />
    </Animated.View>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.webContainer}>
        <View style={styles.webCard}>
          <Text style={styles.title}>BetTracker Pro</Text>
          <Text style={styles.subtitle}>
            Web preview ke liye GitHub Pages wali docs/index.html use karo.
          </Text>
        </View>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Main app — always mounted so WebView loads in background */}
      <SafeAreaView style={styles.container}>
        <AppWebView splashDone={splashDone} />
      </SafeAreaView>

      {/* Splash overlays on top until animation done */}
      {!splashDone && (
        <SplashScreen onFinish={() => setSplashDone(true)} />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const BLUE  = '#0a84ff';
const GREEN = '#30d158';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ── Splash ──
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  orb1: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(10,132,255,0.12)',
  },
  orb2: {
    position: 'absolute',
    bottom: 80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(48,209,88,0.08)',
  },
  orb3: {
    position: 'absolute',
    top: height * 0.55,
    left: '20%',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(191,90,242,0.06)',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(10,132,255,0.35)',
  },
  glow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(10,132,255,0.18)',
  },
  logoWrap: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 20,
  },
  logoEmoji: {
    fontSize: 52,
  },
  splashTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  splashTag: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.42)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 52,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    bottom: 72,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BLUE,
  },

  // ── Web fallback ──
  webContainer: {
    flex: 1,
    backgroundColor: '#050816',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  webCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24,
  },
});
