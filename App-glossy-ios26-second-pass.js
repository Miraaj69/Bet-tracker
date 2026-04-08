import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, Alert, Dimensions, Platform,
  StatusBar, FlatList, Share, Animated, Vibration, PanResponder, Easing
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Polygon, Line, Circle, Rect, Defs, LinearGradient, Stop, Path, Text as SvgText } from 'react-native-svg';

let BlurView = null;
try {
  BlurView = require('@react-native-community/blur').BlurView;
} catch {
  BlurView = null;
}

const { width: SW, height: SH } = Dimensions.get('window');

// ─── THEMES ──────────────────────────────────────────────────────────────────
const THEMES = {
  amoled: { bg:'#000', bg2:'#080808', card:'rgba(255,255,255,0.06)', cardB:'rgba(255,255,255,0.09)', text:'#fff', sub:'rgba(255,255,255,0.52)', muted:'rgba(255,255,255,0.28)', inp:'rgba(255,255,255,0.07)', inpB:'rgba(255,255,255,0.14)', nav:'rgba(0,0,0,0.97)', accent:'#0a84ff', tint:'#4f8cff', tint2:'#7c4dff' },
  dark:   { bg:'#0c0c1e', bg2:'#1a1a2e', card:'rgba(255,255,255,0.07)', cardB:'rgba(255,255,255,0.11)', text:'#fff', sub:'rgba(255,255,255,0.52)', muted:'rgba(255,255,255,0.3)', inp:'rgba(255,255,255,0.09)', inpB:'rgba(255,255,255,0.14)', nav:'rgba(8,8,20,0.97)', accent:'#5e5ce6', tint:'#7c78ff', tint2:'#26c2ff' },
  light:  { bg:'#eef2ff', bg2:'#fff', card:'rgba(255,255,255,0.82)', cardB:'rgba(0,0,0,0.07)', text:'#08081a', sub:'rgba(0,0,0,0.52)', muted:'rgba(0,0,0,0.33)', inp:'rgba(0,0,0,0.045)', inpB:'rgba(0,0,0,0.1)', nav:'rgba(232,238,255,0.97)', accent:'#0a84ff', tint:'#5aa8ff', tint2:'#7c5cff' },
  forest: { bg:'#0a1a0f', bg2:'#0f2318', card:'rgba(48,209,88,0.07)', cardB:'rgba(48,209,88,0.14)', text:'#e8ffe8', sub:'rgba(200,255,200,0.52)', muted:'rgba(150,210,150,0.35)', inp:'rgba(48,209,88,0.07)', inpB:'rgba(48,209,88,0.18)', nav:'rgba(8,22,12,0.97)', accent:'#30d158', tint:'#34d399', tint2:'#22c55e' },
};

const isLightTheme = t => t?.bg === THEMES.light.bg;
const getBlurType = t => (isLightTheme(t) ? 'light' : 'dark');

const getDepthStyle = (level='card', shadowColor='#000') => {
  const levels = {
    card:     { opacity:0.12, radius:12, y:5,  elevation:8 },
    floating: { opacity:0.18, radius:18, y:8,  elevation:14 },
    nav:      { opacity:0.24, radius:28, y:14, elevation:22 },
    modal:    { opacity:0.30, radius:34, y:18, elevation:28 },
    fab:      { opacity:0.36, radius:24, y:12, elevation:20 },
  };
  const d = levels[level] || levels.card;
  return {
    shadowColor,
    shadowOpacity: d.opacity,
    shadowRadius: d.radius,
    shadowOffset: { width:0, height:d.y },
    elevation: d.elevation,
  };
};

const getChipStyle = (t, active=false, color=t.accent, radius=20) => {
  const light = isLightTheme(t);
  return {
    backgroundColor: active ? (light ? color+'14' : color+'20') : t.inp,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: active ? (light ? color+'40' : color+'55') : t.inpB,
    shadowColor: active ? color : '#000',
    shadowOpacity: active ? (light ? 0.14 : 0.24) : 0.05,
    shadowRadius: active ? 12 : 6,
    shadowOffset: { width:0, height:active ? 6 : 3 },
    elevation: active ? 8 : 2,
  };
};

const getActionButtonStyle = ({ t, tone, variant='solid', enabled=true, radius=14 }) => {
  const light = isLightTheme(t);

  if (variant === 'muted') {
    return {
      backgroundColor: light ? 'rgba(255,255,255,0.72)' : t.inp,
      borderRadius: radius,
      borderWidth: 1,
      borderColor: light ? 'rgba(255,255,255,0.42)' : t.inpB,
      ...getDepthStyle('card', light ? 'rgba(15,23,42,0.18)' : '#000'),
    };
  }

  return {
    backgroundColor: enabled ? tone : 'rgba(255,255,255,0.08)',
    borderRadius: radius,
    borderWidth: 1,
    borderColor: enabled ? (light ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.14)') : t.inpB,
    ...getDepthStyle(enabled ? 'floating' : 'card', enabled ? tone : '#000'),
  };
};


const withAlpha = (color, alpha=1) => {
  if (!color) return `rgba(255,255,255,${alpha})`;
  if (color.startsWith('#')) {
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
    const int = parseInt(hex, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const [r, g, b] = match[1].split(',').map(v => v.trim());
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
};

const getSurfaceTint = (t, surface='card', tone) => {
  if (tone) return tone;
  if (surface === 'nav') return t.tint || t.accent;
  if (surface === 'modal') return t.tint2 || t.accent;
  if (surface === 'button') return t.tint || t.accent;
  return t.accent;
};

const getGlassOverlay = (t, surface='card') => {
  const light = isLightTheme(t);
  const overlays = {
    card: light ? 'rgba(255,255,255,0.42)' : t.bg === THEMES.forest.bg ? 'rgba(8,24,16,0.34)' : 'rgba(10,12,20,0.30)',
    nav: light ? 'rgba(255,255,255,0.58)' : t.bg === THEMES.forest.bg ? 'rgba(7,20,12,0.44)' : 'rgba(8,9,18,0.42)',
    modal: light ? 'rgba(255,255,255,0.74)' : t.bg === THEMES.forest.bg ? 'rgba(8,22,15,0.54)' : 'rgba(11,13,22,0.52)',
    button: light ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)',
  };
  return overlays[surface] || overlays.card;
};

const getGlassBlurAmount = (surface='card') => {
  const map = { card: 22, nav: 30, modal: 38, button: 18 };
  return map[surface] || map.card;
};

const getGlossyButtonPalette = ({ t, tone, variant='primary', disabled=false }) => {
  const light = isLightTheme(t);
  const actionTone = tone || t.accent;
  if (disabled) {
    return {
      base: light ? 'rgba(255,255,255,0.44)' : 'rgba(255,255,255,0.07)',
      border: light ? 'rgba(255,255,255,0.46)' : 'rgba(255,255,255,0.10)',
      text: t.muted,
      subText: t.muted,
      tintA: 'rgba(255,255,255,0.05)',
      tintB: 'rgba(255,255,255,0.02)',
      shadow: '#000',
      glow: 0.08,
    };
  }
  if (variant === 'muted') {
    return {
      base: light ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.08)',
      border: light ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.12)',
      text: light ? t.text : '#fff',
      subText: t.sub,
      tintA: withAlpha(actionTone, light ? 0.10 : 0.18),
      tintB: light ? 'rgba(255,255,255,0.02)' : withAlpha('#ffffff', 0.03),
      shadow: light ? 'rgba(15,23,42,1)' : '#000',
      glow: light ? 0.12 : 0.18,
    };
  }
  return {
    base: withAlpha(actionTone, light ? 0.92 : 0.68),
    border: light ? 'rgba(255,255,255,0.76)' : 'rgba(255,255,255,0.15)',
    text: '#fff',
    subText: 'rgba(255,255,255,0.82)',
    tintA: withAlpha('#ffffff', light ? 0.22 : 0.12),
    tintB: withAlpha(actionTone, light ? 0.24 : 0.42),
    shadow: actionTone,
    glow: light ? 0.22 : 0.34,
  };
};


const getGlossySecondaryPalette = ({ t, tone, active=false, destructive=false, variant='neutral', disabled=false }) => {
  const light = isLightTheme(t);
  const resolvedTone = destructive ? '#ff453a' : (tone || t.accent);

  if (disabled) {
    return {
      base: light ? 'rgba(255,255,255,0.46)' : 'rgba(255,255,255,0.06)',
      border: light ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.08)',
      text: t.muted,
      badgeBase: light ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.06)',
      badgeText: t.muted,
      tintA: 'rgba(255,255,255,0.05)',
      tintB: 'rgba(255,255,255,0.02)',
      shadow: '#000',
      glow: 0.04,
      topLine: light ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.14)',
    };
  }

  if (active) {
    return {
      base: withAlpha(resolvedTone, light ? 0.18 : 0.22),
      border: withAlpha(resolvedTone, light ? 0.34 : 0.52),
      text: resolvedTone,
      badgeBase: withAlpha(resolvedTone, light ? 0.14 : 0.18),
      badgeText: resolvedTone,
      tintA: withAlpha('#ffffff', light ? 0.22 : 0.11),
      tintB: withAlpha(resolvedTone, light ? 0.10 : 0.24),
      shadow: resolvedTone,
      glow: light ? 0.12 : 0.2,
      topLine: light ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.22)',
    };
  }

  if (variant === 'ghost') {
    return {
      base: light ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.05)',
      border: light ? 'rgba(255,255,255,0.54)' : 'rgba(255,255,255,0.09)',
      text: resolvedTone,
      badgeBase: light ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.06)',
      badgeText: resolvedTone,
      tintA: withAlpha('#ffffff', light ? 0.18 : 0.08),
      tintB: withAlpha(resolvedTone, light ? 0.06 : 0.14),
      shadow: resolvedTone,
      glow: light ? 0.08 : 0.12,
      topLine: light ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.18)',
    };
  }

  return {
    base: light ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.08)',
    border: light ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.12)',
    text: destructive ? '#ff453a' : resolvedTone,
    badgeBase: light ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)',
    badgeText: destructive ? '#ff453a' : resolvedTone,
    tintA: withAlpha('#ffffff', light ? 0.18 : 0.08),
    tintB: withAlpha(resolvedTone, light ? 0.06 : 0.14),
    shadow: destructive ? '#ff453a' : resolvedTone,
    glow: light ? 0.08 : 0.12,
    topLine: light ? 'rgba(255,255,255,0.48)' : 'rgba(255,255,255,0.16)',
  };
};

function GlassLayer({t, borderRadius=22, blurAmount, surface='card', tone}) {
  const light = isLightTheme(t);
  const tint = getSurfaceTint(t, surface, tone);
  const resolvedBlur = blurAmount || getGlassBlurAmount(surface);
  const overlayStyle = {
    ...StyleSheet.absoluteFillObject,
    borderRadius,
    borderWidth: 1,
    borderColor: surface === 'modal'
      ? (light ? 'rgba(255,255,255,0.76)' : 'rgba(255,255,255,0.12)')
      : surface === 'nav'
        ? (light ? 'rgba(255,255,255,0.64)' : 'rgba(255,255,255,0.10)')
        : t.cardB,
    backgroundColor: BlurView ? getGlassOverlay(t, surface) : t.card,
  };

  const reflectionBase = {
    ...StyleSheet.absoluteFillObject,
    borderRadius,
    backgroundColor: light ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)',
  };

  const topGlow = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: surface === 'nav' ? '58%' : surface === 'modal' ? '56%' : '50%',
    borderTopLeftRadius: borderRadius,
    borderTopRightRadius: borderRadius,
    backgroundColor: light
      ? (surface === 'modal' ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.18)')
      : (surface === 'modal' ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.08)'),
  };

  const sheen = {
    position: 'absolute',
    top: -18,
    left: surface === 'nav' ? '4%' : '8%',
    width: surface === 'nav' ? '92%' : '84%',
    height: surface === 'modal' ? '38%' : '42%',
    borderRadius: borderRadius * 0.9,
    backgroundColor: light ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
    transform: [{ rotate: surface === 'nav' ? '-4deg' : '-6deg' }],
    opacity: 0.92,
  };

  const edgeHighlight = {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: 1,
    borderRadius,
    backgroundColor: light ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.16)',
  };

  const bottomShade = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: surface === 'modal' ? '46%' : '40%',
    borderBottomLeftRadius: borderRadius,
    borderBottomRightRadius: borderRadius,
    backgroundColor: light ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.18)',
  };

  const gradId = `glass-grad-${surface}-${String(tint).replace(/[^a-zA-Z0-9]/g, '')}-${borderRadius}`;
  const tintLayer = (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject} width="100%" height="100%">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={withAlpha(tint, light ? 0.22 : 0.20)} />
          <Stop offset="45%" stopColor={withAlpha(tint, light ? 0.07 : 0.10)} />
          <Stop offset="75%" stopColor="rgba(255,255,255,0)" />
          <Stop offset="100%" stopColor={withAlpha(t.tint2 || tint, light ? 0.08 : 0.14)} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={borderRadius} ry={borderRadius} fill={`url(#${gradId})`} />
    </Svg>
  );

  if (!BlurView) {
    return (
      <>
        <View pointerEvents="none" style={overlayStyle}/>
        {tintLayer}
        <View pointerEvents="none" style={topGlow}/>
        <View pointerEvents="none" style={sheen}/>
        <View pointerEvents="none" style={edgeHighlight}/>
        <View pointerEvents="none" style={bottomShade}/>
      </>
    );
  }

  return (
    <>
      <BlurView
        style={StyleSheet.absoluteFillObject}
        blurType={getBlurType(t)}
        blurAmount={Platform.OS === 'android' ? Math.max(resolvedBlur, surface === 'modal' ? 34 : resolvedBlur + 4) : resolvedBlur}
        reducedTransparencyFallbackColor={t.bg2}
      />
      <View pointerEvents="none" style={overlayStyle}/>
      {tintLayer}
      <View pointerEvents="none" style={reflectionBase}/>
      <View pointerEvents="none" style={topGlow}/>
      <View pointerEvents="none" style={sheen}/>
      <View pointerEvents="none" style={edgeHighlight}/>
      <View pointerEvents="none" style={bottomShade}/>
    </>
  );
}

function AmbientBackground({t}) {
  const light = isLightTheme(t);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <View style={{position:'absolute',top:-80,left:-50,width:250,height:250,borderRadius:125,backgroundColor:t.accent,opacity:light?0.2:0.12}}/>
      <View style={{position:'absolute',top:SH*0.2,right:-90,width:280,height:280,borderRadius:140,backgroundColor:light?'#7c3aed':'#5e5ce6',opacity:light?0.14:0.11}}/>
      <View style={{position:'absolute',bottom:80,left:SW*0.18,width:220,height:220,borderRadius:110,backgroundColor:t.bg===THEMES.forest.bg?'#30d158':'#ff375f',opacity:light?0.1:0.08}}/>
      <View style={{...StyleSheet.absoluteFillObject,backgroundColor:t.bg,opacity:light?0.76:0.88}}/>
    </View>
  );
}


function GlossyButton({
  t,
  title,
  subtitle,
  icon,
  onPress,
  tone,
  variant='primary',
  disabled=false,
  radius=16,
  size='md',
  style,
  contentStyle,
  textStyle,
  subTextStyle,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(disabled ? 0.1 : 1)).current;
  const palette = getGlossyButtonPalette({ t, tone: tone || t.accent, variant, disabled });
  const light = isLightTheme(t);
  const padY = size === 'lg' ? 16 : size === 'sm' ? 10 : 13;
  const padX = size === 'lg' ? 18 : 14;
  const shineTranslate = sweep.interpolate({ inputRange: [0, 1], outputRange: [-220, 320] });
  const shineOpacity = sweep.interpolate({ inputRange: [0, 0.18, 0.78, 1], outputRange: [0, 0.95, 0.2, 0] });

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.972, useNativeDriver: true, speed: 38, bounciness: 0 }),
      Animated.timing(sweep, { toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1.15, duration: 180, useNativeDriver: false }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 7 }),
      Animated.timing(glow, { toValue: disabled ? 0.1 : 1, duration: 240, useNativeDriver: false }),
    ]).start(() => sweep.setValue(0));
  };

  const shadowOpacity = glow.interpolate({
    inputRange: [0.1, 1.15],
    outputRange: [palette.glow * 0.45, palette.glow],
  });

  const gradId = `glossy-btn-${String(tone || t.accent).replace(/[^a-zA-Z0-9]/g, '')}-${variant}-${radius}-${size}`;

  return (
    <Animated.View style={[
      {
        transform: [{ scale }],
        shadowColor: palette.shadow,
        shadowOpacity,
        shadowRadius: size === 'lg' ? 24 : 18,
        shadowOffset: { width: 0, height: size === 'lg' ? 10 : 7 },
        elevation: disabled ? 2 : size === 'lg' ? 10 : 8,
      },
      style,
    ]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={disabled}
      >
        <View style={{ borderRadius: radius, overflow: 'hidden', backgroundColor: palette.base, borderWidth: 1, borderColor: palette.border }}>
          <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject} width="100%" height="100%">
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={palette.tintA} />
                <Stop offset="48%" stopColor={palette.tintB} />
                <Stop offset="100%" stopColor={withAlpha(tone || t.accent, variant === 'muted' ? (light ? 0.05 : 0.08) : (light ? 0.14 : 0.22))} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${gradId})`} />
          </Svg>
          <View pointerEvents="none" style={{ position: 'absolute', top: 1, left: 10, right: 10, height: 1, borderRadius: 1, backgroundColor: light ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.24)' }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '54%', backgroundColor: light ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)' }} />
          <Animated.View pointerEvents="none" style={{
            position: 'absolute',
            top: -18,
            bottom: -18,
            width: '46%',
            backgroundColor: light ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.16)',
            opacity: shineOpacity,
            transform: [{ translateX: shineTranslate }, { skewX: '-20deg' }],
          }} />
          <View style={[{ paddingHorizontal: padX, paddingVertical: padY, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, contentStyle]}>
            {icon ? <Text style={{ fontSize: size === 'sm' ? 12 : 14 }}>{icon}</Text> : null}
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[{ color: palette.text, fontWeight: '900', fontSize: size === 'lg' ? 15 : 13.5, letterSpacing: -0.2 }, textStyle]}>{title}</Text>
              {subtitle ? <Text style={[{ color: palette.subText, fontWeight: '600', fontSize: 10, marginTop: 2 }, subTextStyle]}>{subtitle}</Text> : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function GlossyPill({
  t,
  label,
  onPress,
  tone,
  icon,
  badge,
  active=false,
  destructive=false,
  disabled=false,
  variant='neutral',
  size='sm',
  radius,
  style,
  textStyle,
  contentStyle,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const palette = getGlossySecondaryPalette({ t, tone, active, destructive, variant, disabled });
  const metrics = size === 'xs'
    ? { px: 8, py: 4.5, font: 9, gap: 4, icon: 10.5, badgeFont: 8, radius: 11 }
    : size === 'md'
      ? { px: 14, py: 8, font: 11, gap: 7, icon: 12.5, badgeFont: 9, radius: 18 }
      : { px: 12, py: 6.5, font: 10, gap: 6, icon: 11.5, badgeFont: 8.5, radius: 16 };
  const finalRadius = radius || metrics.radius;
  const shineTranslate = sweep.interpolate({ inputRange: [0, 1], outputRange: [-120, 180] });
  const shineOpacity = sweep.interpolate({ inputRange: [0, 0.18, 0.8, 1], outputRange: [0, 0.85, 0.14, 0] });
  const gradId = `glossy-pill-${String(tone || t.accent).replace(/[^a-zA-Z0-9]/g, '')}-${size}-${active ? 'active' : 'idle'}-${destructive ? 'danger' : 'safe'}-${variant}`;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, speed: 34, bounciness: 0 }),
      Animated.timing(sweep, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 7 }).start(() => sweep.setValue(0));
  };

  return (
    <Animated.View style={[
      {
        transform: [{ scale }],
        shadowColor: palette.shadow,
        shadowOpacity: active ? palette.glow : palette.glow * 0.78,
        shadowRadius: active ? 14 : 10,
        shadowOffset: { width: 0, height: active ? 7 : 5 },
        elevation: active ? 8 : 4,
      },
      style,
    ]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={disabled}
      >
        <View style={{ borderRadius: finalRadius, overflow: 'hidden', backgroundColor: palette.base, borderWidth: 1, borderColor: palette.border }}>
          <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject} width="100%" height="100%">
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={palette.tintA} />
                <Stop offset="52%" stopColor={palette.tintB} />
                <Stop offset="100%" stopColor={withAlpha(tone || t.accent, active ? 0.08 : 0.03)} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" rx={finalRadius} ry={finalRadius} fill={`url(#${gradId})`} />
          </Svg>
          <View pointerEvents="none" style={{ position:'absolute', top:1, left:8, right:8, height:1, borderRadius:1, backgroundColor: palette.topLine }} />
          <View pointerEvents="none" style={{ position:'absolute', top:0, left:0, right:0, height:'58%', backgroundColor: isLightTheme(t) ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)' }} />
          <Animated.View pointerEvents="none" style={{
            position:'absolute',
            top:-10,
            bottom:-10,
            width:'40%',
            backgroundColor: isLightTheme(t) ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.14)',
            opacity: shineOpacity,
            transform:[{ translateX: shineTranslate }, { skewX:'-18deg' }],
          }} />
          <View style={[
            {
              paddingHorizontal: metrics.px,
              paddingVertical: metrics.py,
              flexDirection:'row',
              alignItems:'center',
              justifyContent:'center',
              gap: metrics.gap,
            },
            contentStyle,
          ]}>
            {icon ? <Text style={{ fontSize: metrics.icon, lineHeight: metrics.icon + 2 }}>{icon}</Text> : null}
            {label ? <Text style={[{ color: palette.text, fontSize: metrics.font, fontWeight:'800', letterSpacing:0.1 }, textStyle]}>{label}</Text> : null}
            {badge !== undefined && badge !== null ? (
              <View style={{ backgroundColor: palette.badgeBase, borderRadius: 999, paddingHorizontal: size === 'xs' ? 5 : 6, paddingVertical: size === 'xs' ? 1 : 2, minWidth: size === 'xs' ? 16 : 18, alignItems:'center' }}>
                <Text style={{ color: palette.badgeText, fontSize: metrics.badgeFont, fontWeight:'900' }}>{badge}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SPORTS = {
  cricket:  { icon:'🏏', name:'Cricket',  color:'#30d158', markets:['Match Winner','Toss Winner','1st Innings Score','6 Over Score','10 Over Score','20 Over Score','Player Runs O/U','Fours O/U','Sixes O/U','Man of Match','Top Batsman','Top Bowler','Total Wickets O/U'], teams:['MI','CSK','RCB','KKR','DC','SRH','PBKS','RR','GT','LSG','India','Australia','England','Pakistan','New Zealand','South Africa','West Indies','Bangladesh'] },
  football: { icon:'⚽', name:'Football', color:'#0a84ff', markets:['Match Winner','BTTS','Total Goals O/U','Correct Score','First Goalscorer','Asian Handicap','Half Time Result','Clean Sheet','Double Chance','Draw No Bet','Anytime Goalscorer'], teams:['Man City','Arsenal','Liverpool','Chelsea','Man United','Real Madrid','Barcelona','Bayern Munich','PSG','Juventus','Inter Milan','AC Milan','Atletico','Dortmund','Ajax'] },
  tennis:   { icon:'🎾', name:'Tennis',   color:'#ffd60a', markets:['Match Winner','Set Betting','Total Games O/U','First Set Winner','Handicap Games','Aces O/U','Double Faults O/U','Tie Break in Match'], teams:['Djokovic','Alcaraz','Sinner','Medvedev','Zverev','Swiatek','Sabalenka','Gauff','Rybakina','Andreescu','Ruud','Tsitsipas'] },
  basketball:{ icon:'🏀', name:'Basketball', color:'#ff9f0a', markets:['Match Winner','Total Points O/U','Handicap','First Quarter Winner','Player Points O/U','BTTS 100+','Double Chance'], teams:['Lakers','Warriors','Celtics','Heat','Bucks','Nuggets','Suns','Nets','76ers','Raptors','Mavericks','Bulls'] },
  other:    { icon:'🎲', name:'Other',    color:'#bf5af2', markets:['Winner','Over/Under','Handicap','Both to Score','Correct Score','First Scorer'], teams:[] },
};
const RESULTS   = ['pending','won','lost','void','half-won','half-lost','push'];
const BET_TYPES = ['Single','Double','Treble','Accumulator','System','Each Way','Asian Handicap','Live Bet','Lay Bet','Value Bet','Arbitrage'];
const BOOKIES   = ['Betfair','Dream11','Parimatch','10Cric','Bet365','1xBet','Dafabet','Sportsbet.io','Stake','Unibet','MyBookie','Bovada'];
const TAGS_PRESET = ['Value','High Risk','Tipster','Research','Gut Feel','Arbitrage','Matched Bet','System','Comeback','Big Game'];
const TABS = [['🏠','Home'],['📊','Insights'],['➕','Add'],['📋','Bets'],['👤','Profile']];

// ─── NEW FEATURE CONSTANTS ────────────────────────────────────────────────────
const CURRENCIES = {
  INR: { symbol:'₹', name:'Indian Rupee',   rate:1 },
  USD: { symbol:'$', name:'US Dollar',      rate:0.012 },
  GBP: { symbol:'£', name:'British Pound',  rate:0.0095 },
  EUR: { symbol:'€', name:'Euro',           rate:0.011 },
};

const DEFAULT_TEMPLATES = [
  { id:'t1', name:'CSK Win', sport:'cricket',  match:'IPL Match', market:'Match Winner', selection:'CSK', odds:'1.80', stake:'500', betType:'Single', confidence:4, tags:['Value'] },
  { id:'t2', name:'Over 2.5', sport:'football', match:'EPL Match',  market:'Total Goals O/U', selection:'Over 2.5', odds:'1.90', stake:'300', betType:'Single', confidence:3, tags:[] },
  { id:'t3', name:'Djokovic', sport:'tennis',  match:'ATP Match',  market:'Match Winner', selection:'Djokovic', odds:'1.60', stake:'400', betType:'Single', confidence:4, tags:['Research'] },
];

// Achievements definitions
const ACHIEVEMENTS = [
  { id:'first_bet',   icon:'🎯', name:'First Bet',       desc:'Placed your first bet',           check: b => b.length >= 1 },
  { id:'ten_bets',    icon:'🔟', name:'Veteran',          desc:'Placed 10 bets',                  check: b => b.length >= 10 },
  { id:'fifty_bets',  icon:'💯', name:'Dedicated Punter', desc:'Placed 50 bets',                  check: b => b.length >= 50 },
  { id:'first_win',   icon:'🏆', name:'Winner!',          desc:'Won your first bet',              check: b => b.some(x=>x.result==='won') },
  { id:'win_streak3', icon:'🔥', name:'On Fire',          desc:'3+ win streak',                   check: b => getMaxStreak(b,'won') >= 3 },
  { id:'win_streak5', icon:'🌋', name:'Unstoppable',      desc:'5+ win streak',                   check: b => getMaxStreak(b,'won') >= 5 },
  { id:'profit_1k',   icon:'💰', name:'In the Money',     desc:'Total profit ₹1,000+',            check: b => b.reduce((s,x)=>s+(x.profit||0),0) >= 1000 },
  { id:'profit_10k',  icon:'💎', name:'Big Winner',       desc:'Total profit ₹10,000+',           check: b => b.reduce((s,x)=>s+(x.profit||0),0) >= 10000 },
  { id:'roi_20',      icon:'📈', name:'Sharp Bettor',     desc:'ROI above 20%',                   check: b => { const s=b.reduce((t,x)=>t+(x.stake||0),0); const p=b.reduce((t,x)=>t+(x.profit||0),0); return s>0 && (p/s)*100>=20; } },
  { id:'multi_sport', icon:'🌍', name:'All-Rounder',      desc:'Bet on 3+ sports',                check: b => new Set(b.map(x=>x.sport)).size >= 3 },
  { id:'high_odds',   icon:'🚀', name:'Moonshot',         desc:'Won a bet at 5.0+ odds',          check: b => b.some(x=>x.result==='won'&&x.odds>=5) },
  { id:'disciplined', icon:'🧘', name:'Disciplined',      desc:'100 bets with positive ROI',      check: b => b.length>=100 && b.reduce((s,x)=>s+(x.profit||0),0)>0 },
];

function getMaxStreak(bets, type) {
  const settled = [...bets].filter(b=>['won','lost'].includes(b.result)).sort((a,b)=>new Date(a.date)-new Date(b.date));
  let max=0, cur=0;
  settled.forEach(b=>{ if(b.result===type){cur++;max=Math.max(max,cur);}else cur=0; });
  return max;
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const store = {
  get: async (k, def) => { try { const v = await AsyncStorage.getItem('bt_'+k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: async (k, v) => { try { await AsyncStorage.setItem('bt_'+k, JSON.stringify(v)); } catch {} },
};

// ─── CURRENCY CONTEXT ─────────────────────────────────────────────────────────
let _currency = 'INR';
const setCurrencyGlobal = c => { _currency = c; };
const getCurrencySymbol = () => CURRENCIES[_currency]?.symbol || '₹';
const convertAmount = n => {
  const rate = CURRENCIES[_currency]?.rate || 1;
  return Math.abs(Math.round((n||0) * rate));
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fc    = n => getCurrencySymbol() + convertAmount(n).toLocaleString('en-IN');
const fcs   = n => (n>=0?'+':'-') + fc(n);
const pct   = (n,d=1) => (n||0).toFixed(d)+'%';
const today = () => new Date().toISOString().slice(0,10);
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
const getDOW = ds => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(ds).getDay()];
const getMon = ds => new Date(ds).toLocaleString('en-IN',{month:'short'});
const calcEV = (odds,stake,prob) => Math.round(stake*((clamp(prob/100,0,1)*(odds-1))-((1-clamp(prob/100,0,1))*1)));
const getWeekKey = ds => { const d=new Date(ds); const jan1=new Date(d.getFullYear(),0,1); return `W${Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7)}`; };

function computeStats(bets) {
  const settled = bets.filter(b=>['won','lost','half-won','half-lost'].includes(b.result));
  const won  = bets.filter(b=>b.result==='won').length;
  const lost = bets.filter(b=>b.result==='lost').length;
  const tPL  = bets.reduce((s,b)=>s+(b.profit||0),0);
  const tStake = bets.reduce((s,b)=>s+(b.stake||0),0);
  const roi  = tStake>0?(tPL/tStake)*100:0;
  const wr   = settled.length>0?(won/settled.length)*100:0;
  const avgOdds = bets.length?bets.reduce((s,b)=>s+(b.odds||0),0)/bets.length:0;
  const avgStake = bets.length?tStake/bets.length:0;

  const ss = [...bets].filter(b=>['won','lost'].includes(b.result)).reverse();
  let curStreak = {c:0,tp:'-'};
  if(ss.length){let c=1,tp=ss[0].result;for(let i=1;i<ss.length;i++){if(ss[i].result===tp)c++;else break;}curStreak={c,tp};}

  let maxW=0,maxL=0,cw=0,cl=0;
  [...bets].filter(b=>['won','lost'].includes(b.result)).sort((a,b)=>new Date(a.date)-new Date(b.date))
    .forEach(b=>{if(b.result==='won'){cw++;cl=0;maxW=Math.max(maxW,cw);}else{cl++;cw=0;maxL=Math.max(maxL,cl);}});

  const sorted=[...bets].filter(b=>b.result!=='pending').sort((a,b)=>new Date(a.date)-new Date(b.date));
  let run=0,peak=0,maxDD=0;
  const runData=sorted.map(b=>{run+=(b.profit||0);if(run>peak)peak=run;const dd=peak-run;if(dd>maxDD)maxDD=dd;return{date:b.date.slice(5),v:run};});

  const profits=settled.map(b=>b.profit||0);
  const mean=profits.length?profits.reduce((s,v)=>s+v,0)/profits.length:0;
  const variance=profits.length?profits.reduce((s,v)=>s+Math.pow(v-mean,2),0)/profits.length:0;
  const stdDev=Math.sqrt(variance);
  const winRate2=settled.length>0?won/settled.length:0.5;
  const b_=(avgOdds||2)-1;
  const kelly=b_>0?((winRate2*b_-(1-winRate2))/b_)*100:0;

  // Best/worst single bets
  const topWin = bets.filter(b=>b.result==='won').sort((a,b)=>(b.profit||0)-(a.profit||0))[0];
  const topLoss = bets.filter(b=>b.result==='lost').sort((a,b)=>(a.profit||0)-(b.profit||0))[0];

  return {settled,won,lost,tPL,tStake,roi,wr,avgOdds,avgStake,curStreak,maxW,maxL,runData,maxDD,stdDev,kelly,topWin,topLoss};
}

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
function Card({t, children, style, onPress, glowColor}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => onPress && Animated.spring(scale,{toValue:0.975,useNativeDriver:true,speed:50,bounciness:0}).start();
  const pressOut = () => onPress && Animated.spring(scale,{toValue:1,useNativeDriver:true,speed:28,bounciness:6}).start();
  return (
    <Animated.View style={[
      {
        transform:[{scale}],
        marginBottom:10,
        ...getDepthStyle(glowColor ? 'floating' : 'card', glowColor || (isLightTheme(t) ? 'rgba(15,23,42,0.35)' : '#000')),
      },
      style,
    ]}>
      <View style={{borderRadius:22,overflow:'hidden'}}>
        <GlassLayer t={t} surface='card' borderRadius={22} blurAmount={22} tone={glowColor}/>
        <TouchableOpacity
          onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}
          activeOpacity={1} disabled={!onPress}
          style={{padding:16,borderRadius:22}}
        >
          {children}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function SectionHead({title, sub, t, right}) {
  return (
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
      <View>
        <Text style={{fontSize:14,fontWeight:'900',color:t.text,letterSpacing:-0.3}}>{title}</Text>
        {sub && <Text style={{fontSize:9.5,color:t.muted,marginTop:2,fontWeight:'600',letterSpacing:0.2}}>{sub}</Text>}
      </View>
      {right}
    </View>
  );
}

function StatCard({label, value, sub, color, icon, t}) {
  return (
    <View style={{
      flex:1, marginHorizontal:3,
      ...getDepthStyle('floating', color),
    }}>
      <View style={{borderRadius:20,overflow:'hidden'}}>
        <GlassLayer t={t} surface='card' borderRadius={20} blurAmount={18} tone={color}/>
        <View style={{padding:14}}>
          <Text style={{position:'absolute',top:-4,right:4,fontSize:36,opacity:0.06}}>{icon}</Text>
          <Text style={{fontSize:9,color:t.muted,letterSpacing:1,textTransform:'uppercase',marginBottom:6,fontWeight:'800'}}>{label}</Text>
          <Text style={{fontSize:22,fontWeight:'900',color,letterSpacing:-0.5}}>{value}</Text>
          {sub && <Text style={{fontSize:10,color:t.sub,marginTop:4}}>{sub}</Text>}
          <View style={{position:'absolute',bottom:0,left:0,right:0,height:3,backgroundColor:color,opacity:0.5,borderBottomLeftRadius:20,borderBottomRightRadius:20}}/>
        </View>
      </View>
    </View>
  );
}

function Stars({value, onChange, size=14, t=THEMES.amoled}) {
  const pillSize = size <= 10 ? 'xs' : 'sm';
  return (
    <View style={{flexDirection:'row',gap:4}}>
      {[1,2,3,4,5].map(i=>(
        <GlossyPill
          key={i}
          t={t}
          onPress={()=>onChange&&onChange(i===value?0:i)}
          icon="★"
          tone="#ffd60a"
          active={i<=value}
          size={pillSize}
          style={{minWidth:size <= 10 ? 22 : 26}}
        />
      ))}
    </View>
  );
}

function Toast({msg, type, onDone}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.spring(anim,{toValue:1,useNativeDriver:true,tension:90,friction:9}).start();
    const t=setTimeout(()=>{Animated.timing(anim,{toValue:0,duration:250,useNativeDriver:true}).start(onDone);},2600);
    return()=>clearTimeout(t);
  },[]);
  const bg   = type==='success'?'rgba(30,52,34,0.98)':type==='warn'?'rgba(52,38,14,0.98)':'rgba(52,18,18,0.98)';
  const bdr  = type==='success'?'#30d158':type==='warn'?'#ff9f0a':'#ff453a';
  return (
    <Animated.View style={{
      position:'absolute', top:60, left:20, right:20, zIndex:9999,
      backgroundColor:bg,
      borderRadius:18, padding:14, alignItems:'center',
      borderWidth:1.5, borderColor:bdr+'60',
      shadowColor:bdr, shadowOpacity:0.5, shadowRadius:24, shadowOffset:{width:0,height:8},
      opacity:anim,
      transform:[{translateY:anim.interpolate({inputRange:[0,1],outputRange:[-24,0]})},{scale:anim.interpolate({inputRange:[0,1],outputRange:[0.94,1]})}],
    }}>
      <Text style={{color:'#fff',fontWeight:'900',fontSize:13,letterSpacing:0.1}}>{msg}</Text>
    </Animated.View>
  );
}

function TagChip({tag, selected, onPress, t, color}) {
  const c = color || '#0a84ff';
  return (
    <GlossyPill
      t={t}
      label={tag}
      onPress={onPress}
      tone={c}
      active={selected}
      size='xs'
      style={{marginRight:5,marginBottom:5}}
    />
  );
}

function ProgressBar({value, max, color, t, height=10}) {
  const pct = clamp((value/max)*100,0,100);
  const animW = useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.timing(animW,{toValue:pct,duration:800,useNativeDriver:false}).start();
  },[pct]);
  return (
    <View style={{height,backgroundColor:t.inp,borderRadius:height/2,overflow:'hidden'}}>
      <Animated.View style={{height:'100%',width:animW.interpolate({inputRange:[0,100],outputRange:['0%','100%']}),backgroundColor:color,borderRadius:height/2}}/>
    </View>
  );
}

// ─── LINE CHART ───────────────────────────────────────────────────────────────
function LineChart({data, t, height:h=80}) {
  if(!data||data.length<2) return <Text style={{color:t.muted,textAlign:'center',paddingVertical:20,fontSize:11}}>Add more bets to see chart</Text>;
  const W = SW - 64;
  const vals = data.map(d=>d.v);
  const mn=Math.min(...vals), mx=Math.max(...vals);
  const range=mx-mn||1;
  const px=i=>(i/(data.length-1))*W;
  const py=v=>h-clamp(((v-mn)/range)*h*0.85+h*0.075,2,h-2);
  const pts=data.map((d,i)=>`${px(i)},${py(d.v)}`).join(' ');
  const polyPts=`0,${h} ${pts} ${W},${h}`;
  const lastV=vals[vals.length-1];
  const lc=lastV>=0?'#30d158':'#ff453a';
  return (
    <View>
      <Svg width={W} height={h}>
        <Defs>
          <LinearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lc} stopOpacity="0.25"/>
            <Stop offset="100%" stopColor={lc} stopOpacity="0.01"/>
          </LinearGradient>
        </Defs>
        {mn<0&&mx>0&&<Line x1="0" y1={py(0)} x2={W} y2={py(0)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3,3"/>}
        <Polygon points={polyPts} fill="url(#lg)"/>
        <Polyline points={pts} fill="none" stroke={lc} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        {data.length<=30&&data.map((d,i)=><Circle key={i} cx={px(i)} cy={py(d.v)} r="2.5" fill={lc} opacity="0.7"/>)}
      </Svg>
      <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:4}}>
        <Text style={{fontSize:8,color:t.muted}}>{data[0]?.date}</Text>
        <Text style={{fontSize:9,fontWeight:'700',color:lc}}>{lastV>=0?'+':''}{fc(lastV)}</Text>
        <Text style={{fontSize:8,color:t.muted}}>{data[data.length-1]?.date}</Text>
      </View>
    </View>
  );
}

// ─── BAR CHART ────────────────────────────────────────────────────────────────
function BarChart({data, labelKey, valueKey, t, height:h=72}) {
  if(!data||!data.length) return <Text style={{color:t.muted,textAlign:'center',paddingVertical:16,fontSize:11}}>No data yet</Text>;
  const mx=Math.max(...data.map(d=>Math.abs(d[valueKey])),1);
  return (
    <View style={{flexDirection:'row',alignItems:'flex-end',height:h,gap:3}}>
      {data.map((d,i)=>{
        const v=d[valueKey], barH=Math.max(4,(Math.abs(v)/mx)*(h-16));
        const col=v>=0?'rgba(48,209,88,0.85)':'rgba(255,69,58,0.85)';
        return (
          <View key={i} style={{flex:1,alignItems:'center',justifyContent:'flex-end',gap:2}}>
            <Text style={{fontSize:7,color:t.muted,fontWeight:'600'}}>{v>=0?'+':''}{Math.abs(v)>999?Math.round(v/1000)+'k':Math.round(v)}</Text>
            <View style={{width:'100%',height:barH,backgroundColor:col,borderRadius:4}}/>
            <Text style={{fontSize:7,color:t.muted}}>{d[labelKey]}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── DONUT CHART ──────────────────────────────────────────────────────────────
function DonutChart({won, lost, pending, t, size=80}) {
  const total = won+lost+pending||1;
  const r=size/2-8, cx=size/2, cy=size/2, circ=2*Math.PI*r;
  const wPct=won/total, lPct=lost/total, pPct=pending/total;
  const wDash=circ*wPct, lDash=circ*lPct, pDash=circ*pPct;
  const wOff=0, lOff=circ-wDash, pOff=circ-wDash-lDash;
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
      {won>0&&<Circle cx={cx} cy={cy} r={r} fill="none" stroke="#30d158" strokeWidth="8" strokeDasharray={`${wDash} ${circ-wDash}`} strokeDashoffset={circ/4} strokeLinecap="round"/>}
      {lost>0&&<Circle cx={cx} cy={cy} r={r} fill="none" stroke="#ff453a" strokeWidth="8" strokeDasharray={`${lDash} ${circ-lDash}`} strokeDashoffset={circ/4-circ*wPct} strokeLinecap="round"/>}
      {pending>0&&<Circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffd60a" strokeWidth="8" strokeDasharray={`${pDash} ${circ-pDash}`} strokeDashoffset={circ/4-circ*(wPct+lPct)} strokeLinecap="round"/>}
      <SvgText x={cx} y={cy-4} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800">{won+lost+pending}</SvgText>
      <SvgText x={cx} y={cy+10} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8">bets</SvgText>
    </Svg>
  );
}

// ─── PICKER COMPONENT ─────────────────────────────────────────────────────────
function Picker({value, options, onChange, t, style}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={style}>
      <TouchableOpacity onPress={()=>setOpen(true)} style={[styles.inp(t),{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}]}>
        <Text style={{color:t.text,fontSize:13,flex:1}}>{value}</Text>
        <Text style={{color:t.muted,fontSize:11}}>▼</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide">
        <TouchableOpacity style={{flex:1,backgroundColor:'rgba(0,0,0,0.5)'}} onPress={()=>setOpen(false)}/>
        <View style={{backgroundColor:t.bg2,borderTopLeftRadius:20,borderTopRightRadius:20,paddingBottom:34,maxHeight:'60%'}}>
          <View style={{padding:16,borderBottomWidth:1,borderColor:t.cardB}}>
            <Text style={{color:t.text,fontWeight:'800',fontSize:15,textAlign:'center'}}>Select Option</Text>
          </View>
          <ScrollView>
            {options.map(opt=>(
              <TouchableOpacity key={opt} onPress={()=>{onChange(opt);setOpen(false);}}
                style={{padding:16,borderBottomWidth:1,borderColor:t.cardB,backgroundColor:opt===value?'rgba(10,132,255,0.1)':'transparent'}}>
                <Text style={{color:opt===value?'#0a84ff':t.text,fontSize:14,fontWeight:opt===value?'700':'400'}}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── BET MODAL ────────────────────────────────────────────────────────────────
const blank = (bookies) => ({date:today(),sport:'cricket',match:'',market:'Match Winner',selection:'',odds:'',stake:'',result:'pending',profit:'',bookie:bookies[0]||'Betfair',notes:'',confidence:3,livebet:false,betType:'Single',estWinProb:'',tags:[]});

function BetModal({show, onClose, onSave, editBet, t, bookies}) {
  const [form, setForm] = useState(blank(bookies));
  const [sug, setSug] = useState([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(()=>{
    if(show){
      setStep(0);
      if(editBet){
        setForm({...blank(bookies),...editBet,odds:String(editBet.odds),stake:String(editBet.stake),profit:String(editBet.profit||''),estWinProb:String(editBet.estWinProb||''),tags:editBet.tags||[]});
      } else {
        Promise.all([store.get('lastStake',''),store.get('lastBookie',bookies[0]||'Betfair')])
          .then(([ls,lb])=>setForm({...blank(bookies),stake:ls,bookie:lb}));
      }
    }
  },[show]);

  const calcP=(r,s,o)=>{const sv=parseFloat(s),ov=parseFloat(o);if(!sv||!ov)return'';if(r==='won')return String(Math.round(sv*(ov-1)));if(r==='lost')return String(-sv);if(r==='half-won')return String(Math.round(sv*(ov-1)/2));if(r==='half-lost')return String(-Math.round(sv/2));if(r==='push')return'0';return'';};
  const ch=(k,v)=>{const u={...form,[k]:v};if(['result','stake','odds'].includes(k))u.profit=calcP(u.result,u.stake,u.odds);if(k==='sport'){u.market=SPORTS[v].markets[0];u.match='';u.selection='';}setForm(u);};
  const sport=SPORTS[form.sport]||SPORTS.other;
  const implP=parseFloat(form.odds)>0?Math.round(100/parseFloat(form.odds)):null;
  const ev=parseFloat(form.stake)&&parseFloat(form.odds)&&parseFloat(form.estWinProb)?calcEV(parseFloat(form.odds),parseFloat(form.stake),parseFloat(form.estWinProb)):null;
  const potReturn = parseFloat(form.stake)&&parseFloat(form.odds)?Math.round(parseFloat(form.stake)*parseFloat(form.odds)):null;

  const handleMatch=v=>{
    ch('match',v);
    const all=sport.teams.flatMap(a=>sport.teams.filter(b=>b!==a).map(b=>`${a} vs ${b}`));
    setSug(v.length>1?all.filter(s=>s.toLowerCase().includes(v.toLowerCase())).slice(0,4):[]);
  };

  const toggleTag = tag => {
    const tags = form.tags||[];
    setForm(f=>({...f,tags:tags.includes(tag)?tags.filter(t=>t!==tag):[...tags,tag]}));
  };

  const addCustomTag = () => {
    const tag = tagInput.trim();
    if(!tag) return;
    const tags = form.tags||[];
    if(!tags.includes(tag)) setForm(f=>({...f,tags:[...tags,tag]}));
    setTagInput('');
  };

  const handleSave=async()=>{
    if(!form.match||!form.odds||!form.stake){Alert.alert('Missing fields','Match, Odds & Stake required');return;}
    await store.set('lastStake',form.stake);
    await store.set('lastBookie',form.bookie);
    onSave({...form,odds:parseFloat(form.odds)||0,stake:parseFloat(form.stake)||0,profit:parseFloat(form.profit)||0,estWinProb:parseFloat(form.estWinProb)||0,tags:form.tags||[]});
  };

  const STEPS = editBet ? null : ['Sport','Match & Pick','Odds & Stake','Details'];
  const [step, setStep] = useState(0);

  const canNext = () => {
    if(!STEPS) return true;
    if(step===0) return !!form.sport;
    if(step===1) return !!form.match && !!form.selection;
    if(step===2) return !!form.odds && !!form.stake;
    return true;
  };

  const stepContent = () => {
    const s = STEPS ? step : 99;
    if(s===0) return (
      <View>
        <Text style={{fontSize:16,fontWeight:'800',color:t.text,marginBottom:6}}>What sport?</Text>
        <Text style={{fontSize:12,color:t.muted,marginBottom:20}}>Select the sport for this bet</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
          {Object.entries(SPORTS).map(([k,v])=>(
            <TouchableOpacity key={k} onPress={()=>ch('sport',k)}
              style={{width:(SW-80)/2,backgroundColor:form.sport===k?v.color+'20':t.inp,borderRadius:18,borderWidth:2,borderColor:form.sport===k?v.color:t.inpB,padding:18,alignItems:'center',gap:8}}>
              <Text style={{fontSize:32}}>{v.icon}</Text>
              <Text style={{fontSize:13,color:form.sport===k?v.color:t.sub,fontWeight:'800'}}>{v.name}</Text>
              {form.sport===k&&<View style={{width:8,height:8,borderRadius:4,backgroundColor:v.color}}/>}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
    if(s===1) return (
      <View>
        <Text style={{fontSize:16,fontWeight:'800',color:t.text,marginBottom:6}}>Match & Selection</Text>
        <Text style={{fontSize:12,color:t.muted,marginBottom:20}}>Enter the match and your pick</Text>
        <Label t={t}>Match / Event</Label>
        <TextInput value={form.match} onChangeText={handleMatch} style={styles.inp(t)} placeholder={sport.teams.length>=2?`${sport.teams[0]} vs ${sport.teams[1]}`:'e.g. Team A vs Team B'} placeholderTextColor={t.muted}/>
        {sug.length>0&&<View style={{backgroundColor:t.bg2,borderRadius:12,borderWidth:1,borderColor:t.cardB,marginBottom:8}}>
          {sug.map((s2,i)=><TouchableOpacity key={i} onPress={()=>{ch('match',s2);setSug([]);}} style={{padding:12,borderBottomWidth:i<sug.length-1?1:0,borderColor:t.cardB}}>
            <Text style={{fontSize:12,color:t.text}}>{sport.icon} {s2}</Text>
          </TouchableOpacity>)}
        </View>}
        <Label t={t}>Market</Label>
        <Picker value={form.market} options={sport.markets} onChange={v=>ch('market',v)} t={t} style={{marginBottom:10}}/>
        <Label t={t}>Selection / Pick</Label>
        <TextInput value={form.selection} onChangeText={v=>ch('selection',v)} style={styles.inp(t)} placeholder="Who/what are you backing?" placeholderTextColor={t.muted}/>
      </View>
    );
    if(s===2) return (
      <View>
        <Text style={{fontSize:16,fontWeight:'800',color:t.text,marginBottom:6}}>Odds & Stake</Text>
        <Text style={{fontSize:12,color:t.muted,marginBottom:20}}>Enter the odds and how much you're staking</Text>
        <Row>
          <View style={{flex:1,marginRight:6}}>
            <Label t={t}>Odds</Label>
            <TextInput value={form.odds} onChangeText={v=>ch('odds',v)} style={styles.inp(t)} placeholder="2.00" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
            {implP&&<Text style={{fontSize:9,color:t.muted,marginTop:2}}>Implied: {implP}%</Text>}
          </View>
          <View style={{flex:1,marginLeft:6}}>
            <Label t={t}>Stake (₹)</Label>
            <TextInput value={form.stake} onChangeText={v=>ch('stake',v)} style={styles.inp(t)} placeholder="500" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
          </View>
        </Row>
        {potReturn&&(
          <View style={{backgroundColor:'rgba(48,209,88,0.1)',borderRadius:14,borderWidth:1,borderColor:'rgba(48,209,88,0.25)',padding:14,marginTop:4,alignItems:'center'}}>
            <Text style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:4}}>Potential Return</Text>
            <Text style={{fontSize:28,fontWeight:'900',color:'#30d158'}}>₹{potReturn.toLocaleString('en-IN')}</Text>
            <Text style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:2}}>Profit: +₹{Math.round(potReturn-parseFloat(form.stake)).toLocaleString('en-IN')}</Text>
          </View>
        )}
        <Row style={{marginTop:10}}>
          <View style={{flex:1,marginRight:6}}>
            <Label t={t}>Result</Label>
            <Picker value={form.result} options={RESULTS} onChange={v=>ch('result',v)} t={t}/>
          </View>
          <View style={{flex:1,marginLeft:6}}>
            <Label t={t}>Bookie</Label>
            <Picker value={form.bookie} options={bookies} onChange={v=>ch('bookie',v)} t={t}/>
          </View>
        </Row>
      </View>
    );
    // Step 3 (optional details) OR edit mode (all fields)
    return (
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!!STEPS&&<><Text style={{fontSize:16,fontWeight:'800',color:t.text,marginBottom:6}}>Extra Details</Text>
        <Text style={{fontSize:12,color:t.muted,marginBottom:16}}>Optional — add more context to this bet</Text></>}

        {!STEPS&&<>
          {/* Full form for edit mode */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
            <View style={{flexDirection:'row',gap:8}}>
              {Object.entries(SPORTS).map(([k,v])=>(
                <TouchableOpacity key={k} onPress={()=>ch('sport',k)} style={{backgroundColor:form.sport===k?v.color+'25':t.inp,borderRadius:12,borderWidth:1,borderColor:form.sport===k?v.color+'60':t.inpB,padding:10,alignItems:'center',minWidth:60}}>
                  <Text style={{fontSize:20,marginBottom:2}}>{v.icon}</Text>
                  <Text style={{fontSize:9,color:form.sport===k?v.color:t.sub,fontWeight:'700'}}>{v.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Row>
            <View style={{flex:1,marginRight:6}}>
              <Label t={t}>Date</Label>
              <TextInput value={form.date} onChangeText={v=>ch('date',v)} style={styles.inp(t)} placeholder="YYYY-MM-DD" placeholderTextColor={t.muted}/>
            </View>
            <View style={{flex:1,marginLeft:6}}>
              <Label t={t}>Bet Type</Label>
              <Picker value={form.betType} options={BET_TYPES} onChange={v=>ch('betType',v)} t={t}/>
            </View>
          </Row>
          <Label t={t}>Match / Event</Label>
          <TextInput value={form.match} onChangeText={handleMatch} style={styles.inp(t)} placeholder={sport.teams.length>=2?`${sport.teams[0]} vs ${sport.teams[1]}`:'e.g. Team A vs Team B'} placeholderTextColor={t.muted}/>
          {sug.length>0&&<View style={{backgroundColor:t.bg2,borderRadius:12,borderWidth:1,borderColor:t.cardB,marginBottom:8}}>
            {sug.map((s2,i)=><TouchableOpacity key={i} onPress={()=>{ch('match',s2);setSug([]);}} style={{padding:12,borderBottomWidth:i<sug.length-1?1:0,borderColor:t.cardB}}>
              <Text style={{fontSize:12,color:t.text}}>{sport.icon} {s2}</Text>
            </TouchableOpacity>)}
          </View>}
          <Label t={t}>Market</Label>
          <Picker value={form.market} options={sport.markets} onChange={v=>ch('market',v)} t={t} style={{marginBottom:10}}/>
          <Label t={t}>Selection / Pick</Label>
          <TextInput value={form.selection} onChangeText={v=>ch('selection',v)} style={styles.inp(t)} placeholder="Who/what are you backing?" placeholderTextColor={t.muted}/>
          <Row>
            <View style={{flex:1,marginRight:6}}>
              <Label t={t}>Odds</Label>
              <TextInput value={form.odds} onChangeText={v=>ch('odds',v)} style={styles.inp(t)} placeholder="2.00" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
              {implP&&<Text style={{fontSize:9,color:t.muted,marginTop:2}}>Implied: {implP}%</Text>}
            </View>
            <View style={{flex:1,marginLeft:6}}>
              <Label t={t}>Stake (₹)</Label>
              <TextInput value={form.stake} onChangeText={v=>ch('stake',v)} style={styles.inp(t)} placeholder="500" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
            </View>
          </Row>
          <Row>
            <View style={{flex:1,marginRight:6}}>
              <Label t={t}>Result</Label>
              <Picker value={form.result} options={RESULTS} onChange={v=>ch('result',v)} t={t}/>
            </View>
            <View style={{flex:1,marginLeft:6}}>
              <Label t={t}>P&L (₹)</Label>
              <TextInput value={form.profit} onChangeText={v=>ch('profit',v)} style={[styles.inp(t),{color:parseFloat(form.profit||0)>=0?'#30d158':'#ff453a'}]} placeholder="Auto-calc" keyboardType="numbers-and-punctuation" placeholderTextColor={t.muted}/>
            </View>
          </Row>
          <Row>
            <View style={{flex:1,marginRight:6}}>
              <Label t={t}>Bookie</Label>
              <Picker value={form.bookie} options={bookies} onChange={v=>ch('bookie',v)} t={t}/>
            </View>
            <View style={{flex:1,marginLeft:6}}>
              <Label t={t}>Bet Type</Label>
              <Picker value={form.betType} options={BET_TYPES} onChange={v=>ch('betType',v)} t={t}/>
            </View>
          </Row>
        </>}

        <Label t={t}>Confidence</Label>
        <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12}}>
          <Stars value={form.confidence} onChange={v=>ch('confidence',v)} size={18}/>
          <Text style={{fontSize:11,color:t.muted}}>{['','Very Low','Low','Medium','High','Very High'][form.confidence]||'None'}</Text>
        </View>

        <TouchableOpacity onPress={()=>ch('livebet',!form.livebet)} style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12}}>
          <View style={{width:20,height:20,borderRadius:4,borderWidth:2,borderColor:'#ff453a',backgroundColor:form.livebet?'#ff453a':'transparent',justifyContent:'center',alignItems:'center'}}>
            {form.livebet&&<Text style={{color:'#fff',fontSize:12}}>✓</Text>}
          </View>
          <Text style={{fontSize:11,color:'#ff453a',fontWeight:'700'}}>🔴 Live / In-Play</Text>
        </TouchableOpacity>

        <Label t={t}>Tags</Label>
        <View style={{flexDirection:'row',flexWrap:'wrap',marginBottom:8}}>
          {TAGS_PRESET.map(tag=>(
            <TagChip key={tag} tag={tag} selected={(form.tags||[]).includes(tag)} onPress={()=>toggleTag(tag)} t={t}/>
          ))}
        </View>
        <View style={{flexDirection:'row',gap:8,marginBottom:12}}>
          <TextInput value={tagInput} onChangeText={setTagInput} style={[styles.inp(t),{flex:1}]} placeholder="Custom tag..." placeholderTextColor={t.muted} onSubmitEditing={addCustomTag}/>
          <TouchableOpacity onPress={addCustomTag} style={{backgroundColor:t.accent+'20',borderRadius:10,borderWidth:1,borderColor:t.accent+'40',paddingHorizontal:14,justifyContent:'center'}}>
            <Text style={{color:t.accent,fontWeight:'800'}}>+</Text>
          </TouchableOpacity>
        </View>

        {!STEPS&&<>
          <Row>
            <View style={{flex:1,marginRight:6}}>
              <Label t={t}>Est. Win Prob %</Label>
              <TextInput value={form.estWinProb} onChangeText={v=>ch('estWinProb',v)} style={styles.inp(t)} placeholder="55" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
              {ev!==null&&<Text style={{fontSize:9,marginTop:2,fontWeight:'700',color:ev>=0?'#30d158':'#ff453a'}}>EV: {ev>=0?'+':''}{fc(ev)}</Text>}
            </View>
            <View style={{flex:1,marginLeft:6}}>
              <Label t={t}>Date</Label>
              <TextInput value={form.date} onChangeText={v=>ch('date',v)} style={styles.inp(t)} placeholder="YYYY-MM-DD" placeholderTextColor={t.muted}/>
            </View>
          </Row>
        </>}

        <Label t={t}>Notes</Label>
        <TextInput value={form.notes} onChangeText={v=>ch('notes',v)} style={[styles.inp(t),{height:60,textAlignVertical:'top'}]} placeholder="Strategy, reason, observations..." placeholderTextColor={t.muted} multiline/>
      </ScrollView>
    );
  };

  return (
    <Modal visible={show} animationType="slide" transparent>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.65)',justifyContent:'flex-end'}}>
        <View style={[
          {backgroundColor:'transparent',borderTopLeftRadius:28,borderTopRightRadius:28,maxHeight:'95%',borderWidth:1,borderColor:t.cardB,overflow:'hidden'},
          getDepthStyle('modal', isLightTheme(t) ? 'rgba(15,23,42,0.22)' : '#000')
        ]}>
          <GlassLayer t={t} surface='modal' borderRadius={28} blurAmount={40} tone={sport.color}/>

          {/* Progress bar (new bet only) */}
          {STEPS&&(
            <View style={{paddingHorizontal:20,paddingTop:16,paddingBottom:0}}>
              <View style={{flexDirection:'row',gap:6,marginBottom:14}}>
                {STEPS.map((label,i)=>(
                  <View key={i} style={{flex:1}}>
                    <View style={{height:3,borderRadius:2,backgroundColor:i<=step?sport.color:'rgba(255,255,255,0.1)',marginBottom:4}}/>
                    <Text style={{fontSize:8,color:i===step?sport.color:t.muted,fontWeight:i===step?'800':'500',textAlign:'center'}}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Header */}
          <View style={{paddingHorizontal:20,paddingBottom:14,borderBottomWidth:1,borderColor:t.cardB,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
            <View>
              <Text style={{fontSize:17,fontWeight:'800',color:t.text}}>{editBet?'✏️ Edit Bet':STEPS?`Step ${step+1} of ${STEPS.length}`:'➕ New Bet'}</Text>
              {potReturn&&!STEPS&&<Text style={{fontSize:10,color:t.muted,marginTop:2}}>Potential return: <Text style={{color:'#30d158',fontWeight:'700'}}>{fc(potReturn)}</Text></Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={{backgroundColor:t.inp,borderRadius:20,width:32,height:32,justifyContent:'center',alignItems:'center'}}>
              <Text style={{color:t.sub,fontSize:14}}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={{padding:20,maxHeight:SH*0.6}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {stepContent()}
            <View style={{height:20}}/>
          </ScrollView>

          {/* Footer nav buttons */}
          <View style={{flexDirection:'row',gap:10,padding:20,paddingTop:8,paddingBottom:36,borderTopWidth:1,borderColor:t.cardB}}>
            {STEPS&&step>0&&(
              <GlossyButton t={t} title="← Back" onPress={()=>setStep(s=>s-1)} variant='muted' radius={14} style={{flex:1}} />
            )}
            {(!STEPS||step===STEPS.length-1)?(
              <GlossyButton t={t} title={editBet?'Save Changes':`Add ${sport.icon} Bet`} onPress={handleSave} tone={sport.color} radius={14} style={{flex:2}} />
            ):(
              <GlossyButton t={t} title="Continue →" onPress={()=>{if(canNext())setStep(s=>s+1);}} tone={sport.color} disabled={!canNext()} radius={14} style={{flex:2}} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── QUICK ADD MODAL ──────────────────────────────────────────────────────────
function QuickAddModal({show, onClose, onSave, t, bookies}) {
  const [form, setForm] = useState({sport:'cricket',match:'',selection:'',odds:'',stake:'',bookie:bookies[0]||'Betfair',confidence:3,livebet:false});
  const ch=(k,v)=>setForm(f=>({...f,[k]:v}));
  const potReturn = parseFloat(form.odds)&&parseFloat(form.stake)?Math.round(parseFloat(form.odds)*parseFloat(form.stake)):null;
  return (
    <Modal visible={show} animationType="slide" transparent>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.55)',justifyContent:'flex-end'}}>
        <View style={[
          {backgroundColor:'transparent',borderTopLeftRadius:26,borderTopRightRadius:26,padding:22,paddingBottom:36,borderWidth:1,borderColor:t.cardB,overflow:'hidden'},
          getDepthStyle('modal', isLightTheme(t) ? 'rgba(15,23,42,0.2)' : '#000')
        ]}>
          <GlassLayer t={t} surface='modal' borderRadius={26} blurAmount={36} tone={SPORTS[form.sport]?.color}/>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <View>
              <Text style={{fontSize:16,fontWeight:'800',color:t.text}}>⚡ Quick Add</Text>
              {potReturn&&<Text style={{fontSize:10,color:'#30d158',fontWeight:'700'}}>Return: {fc(potReturn)}</Text>}
            </View>
            <View style={{flexDirection:'row',gap:6}}>
              {Object.entries(SPORTS).map(([k,v])=>(
                <TouchableOpacity key={k} onPress={()=>ch('sport',k)} style={{backgroundColor:form.sport===k?v.color+'30':t.inp,borderRadius:9,borderWidth:1,borderColor:form.sport===k?v.color+'50':t.inpB,padding:6}}>
                  <Text style={{fontSize:14}}>{v.icon}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TextInput value={form.match} onChangeText={v=>ch('match',v)} style={[styles.inp(t),{marginBottom:8}]} placeholder={`Match — e.g. ${SPORTS[form.sport].teams[0]||'Team A'} vs ${SPORTS[form.sport].teams[1]||'Team B'}`} placeholderTextColor={t.muted}/>
          <TextInput value={form.selection} onChangeText={v=>ch('selection',v)} style={[styles.inp(t),{marginBottom:8}]} placeholder="Your pick / selection" placeholderTextColor={t.muted}/>
          <View style={{flexDirection:'row',gap:8,marginBottom:8}}>
            <TextInput value={form.odds} onChangeText={v=>ch('odds',v)} style={[styles.inp(t),{flex:1}]} placeholder="Odds 2.00" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
            <TextInput value={form.stake} onChangeText={v=>ch('stake',v)} style={[styles.inp(t),{flex:1}]} placeholder="Stake ₹" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
          </View>
          <View style={{flexDirection:'row',gap:8,marginBottom:14,alignItems:'center'}}>
            <View style={{flex:1}}>
              <Picker value={form.bookie} options={bookies} onChange={v=>ch('bookie',v)} t={t}/>
            </View>
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
              <Stars value={form.confidence} onChange={v=>ch('confidence',v)} size={16}/>
            </View>
          </View>
          <TouchableOpacity onPress={()=>ch('livebet',!form.livebet)} style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:14}}>
            <View style={{width:18,height:18,borderRadius:4,borderWidth:2,borderColor:'#ff453a',backgroundColor:form.livebet?'#ff453a':'transparent',justifyContent:'center',alignItems:'center'}}>
              {form.livebet&&<Text style={{color:'#fff',fontSize:10}}>✓</Text>}
            </View>
            <Text style={{fontSize:11,color:'#ff453a',fontWeight:'700'}}>🔴 Live bet</Text>
          </TouchableOpacity>
          <GlossyButton
            t={t}
            title="Add Instantly"
            icon="⚡"
            tone={SPORTS[form.sport]?.color || t.accent}
            radius={14}
            size='lg'
            onPress={()=>{
              if(!form.match||!form.odds||!form.stake){Alert.alert('Missing','Match, Odds & Stake required');return;}
              onSave({id:Date.now(),date:today(),sport:form.sport,match:form.match,market:SPORTS[form.sport].markets[0],selection:form.selection||form.match,odds:parseFloat(form.odds),stake:parseFloat(form.stake),result:'pending',profit:0,bookie:form.bookie,notes:'',confidence:form.confidence||3,livebet:form.livebet||false,betType:'Single',estWinProb:0,tags:[]});
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── FEATURE 1: BET SLIP BUILDER ─────────────────────────────────────────────
function BetSlipModal({show, onClose, t, bookies, onSaveAll}) {
  const [slipBets, setSlipBets] = useState([]);
  const [totalStake, setTotalStake] = useState('1000');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({sport:'cricket',selection:'',odds:'',match:''});
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(()=>{
    if(show) Animated.spring(slideAnim,{toValue:0,tension:90,friction:12,useNativeDriver:true}).start();
    else Animated.timing(slideAnim,{toValue:300,duration:180,useNativeDriver:true}).start();
  },[show]);

  const totalOdds = slipBets.reduce((p,b)=>p*(parseFloat(b.odds)||1),1);
  const potReturn = Math.round(totalOdds * parseFloat(totalStake||0));
  const removeFromSlip = id => setSlipBets(s=>s.filter(b=>b.id!==id));
  const addToSlip = () => {
    if(!form.selection||!form.odds) return;
    setSlipBets(s=>[...s,{...form,id:Date.now(),odds:parseFloat(form.odds)}]);
    setForm({sport:'cricket',selection:'',odds:'',match:''});
    setAdding(false);
  };

  return (
    <Modal visible={show} animationType="none" transparent>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'flex-end'}}>
        <TouchableOpacity style={{flex:1}} onPress={onClose} activeOpacity={1}/>
        <Animated.View style={{transform:[{translateY:slideAnim}],backgroundColor:'transparent',borderTopLeftRadius:28,borderTopRightRadius:28,borderWidth:1,borderColor:t.cardB,paddingHorizontal:20,paddingBottom:40,maxHeight:'85%',overflow:'hidden'}}>
          <GlassLayer t={t} surface='modal' borderRadius={28} blurAmount={40} tone='#ffd60a'/>
          <View style={{width:44,height:4,backgroundColor:t.muted,borderRadius:2,alignSelf:'center',marginTop:10,marginBottom:16,opacity:0.4}}/>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <View>
              <Text style={{fontSize:18,fontWeight:'900',color:t.text}}>🎫 Bet Slip</Text>
              <Text style={{fontSize:10,color:t.muted}}>{slipBets.length} selections</Text>
            </View>
            <View style={{alignItems:'flex-end'}}>
              <Text style={{fontSize:10,color:t.muted}}>Combined Odds</Text>
              <Text style={{fontSize:18,fontWeight:'900',color:'#ffd60a'}}>{totalOdds.toFixed(2)}x</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{maxHeight:280}}>
            {slipBets.length===0&&<View style={{alignItems:'center',padding:32}}><Text style={{fontSize:36,marginBottom:8}}>🎫</Text><Text style={{color:t.muted,fontSize:12}}>Add selections below</Text></View>}
            {slipBets.map((b,i)=>(
              <Animated.View key={b.id} style={{backgroundColor:t.card,borderRadius:14,borderWidth:1,borderColor:t.cardB,padding:12,marginBottom:8,flexDirection:'row',alignItems:'center'}}>
                <Text style={{fontSize:16,marginRight:10}}>{SPORTS[b.sport]?.icon||'🎲'}</Text>
                <View style={{flex:1}}>
                  <Text style={{fontSize:12,fontWeight:'700',color:t.text}}>{b.selection}</Text>
                  <Text style={{fontSize:10,color:t.muted}}>{b.match||'—'} · Odds: <Text style={{color:'#ffd60a',fontWeight:'700'}}>{b.odds}</Text></Text>
                </View>
                <TouchableOpacity onPress={()=>removeFromSlip(b.id)} style={{backgroundColor:'rgba(255,69,58,0.15)',borderRadius:8,padding:6}}>
                  <Text style={{color:'#ff453a',fontSize:12}}>✕</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}

            {adding&&(
              <View style={{backgroundColor:t.inp,borderRadius:14,borderWidth:1,borderColor:t.inpB,padding:12,marginBottom:8}}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>
                  <View style={{flexDirection:'row',gap:5}}>
                    {Object.entries(SPORTS).map(([k,v])=>(
                      <TouchableOpacity key={k} onPress={()=>setForm(f=>({...f,sport:k}))} style={{backgroundColor:form.sport===k?v.color+'30':t.inp,borderRadius:8,borderWidth:1,borderColor:form.sport===k?v.color+'60':t.inpB,paddingHorizontal:10,paddingVertical:5}}>
                        <Text style={{fontSize:13}}>{v.icon}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <TextInput value={form.match} onChangeText={v=>setForm(f=>({...f,match:v}))} style={[styles.inp(t),{marginBottom:6}]} placeholder="Match name" placeholderTextColor={t.muted}/>
                <TextInput value={form.selection} onChangeText={v=>setForm(f=>({...f,selection:v}))} style={[styles.inp(t),{marginBottom:6}]} placeholder="Your pick / selection" placeholderTextColor={t.muted}/>
                <TextInput value={form.odds} onChangeText={v=>setForm(f=>({...f,odds:v}))} style={[styles.inp(t),{marginBottom:6}]} placeholder="Odds e.g. 1.85" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
                <View style={{flexDirection:'row',gap:8}}>
                  <GlossyButton t={t} title="Cancel" onPress={()=>setAdding(false)} variant='muted' radius={10} style={{flex:1}} size='sm'/>
                  <GlossyButton t={t} title="Add to Slip ✓" onPress={addToSlip} tone='#0a84ff' radius={10} style={{flex:2}} size='sm'/>
                </View>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity onPress={()=>setAdding(true)} style={{backgroundColor:t.card,borderRadius:14,borderWidth:1,borderColor:t.cardB,padding:12,alignItems:'center',marginTop:8,marginBottom:12,flexDirection:'row',justifyContent:'center',gap:8}}>
            <Text style={{color:t.accent,fontWeight:'800',fontSize:13}}>+ Add Selection</Text>
          </TouchableOpacity>

          {slipBets.length>0&&(
            <>
              <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12}}>
                <Text style={{fontSize:12,color:t.muted,fontWeight:'700'}}>Total Stake:</Text>
                <TextInput value={totalStake} onChangeText={setTotalStake} style={[styles.inp(t),{flex:1,marginBottom:0}]} keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
              </View>
              <View style={{backgroundColor:'rgba(255,214,10,0.12)',borderRadius:16,borderWidth:1,borderColor:'rgba(255,214,10,0.3)',padding:14,marginBottom:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <View><Text style={{fontSize:10,color:t.muted}}>Potential Return</Text><Text style={{fontSize:24,fontWeight:'900',color:'#ffd60a'}}>{fc(potReturn)}</Text></View>
                <View style={{alignItems:'flex-end'}}><Text style={{fontSize:10,color:t.muted}}>Net Profit</Text><Text style={{fontSize:18,fontWeight:'800',color:'#30d158'}}>+{fc(potReturn-parseFloat(totalStake||0))}</Text></View>
              </View>
              <GlossyButton
                t={t}
                title={`Place All ${slipBets.length} Bets`}
                icon="🎫"
                tone='#30d158'
                radius={16}
                size='lg'
                onPress={()=>{
                  slipBets.forEach(b=>{
                    onSaveAll({id:Date.now()+Math.random(),date:today(),sport:b.sport,match:b.match||'Slip Bet',market:SPORTS[b.sport]?.markets[0]||'Winner',selection:b.selection,odds:b.odds,stake:parseFloat(totalStake)/slipBets.length,result:'pending',profit:0,bookie:bookies[0]||'',confidence:3,livebet:false,betType:'Single',tags:['Slip'],notes:'From bet slip'});
                  });
                  setSlipBets([]);onClose();
                }}
              />
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── FEATURE 2: PENDING REMINDER CARD ────────────────────────────────────────
function PendingReminderCard({bets, onSettleTap, t}) {
  const pending = bets.filter(b=>b.result==='pending');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim,{toValue:1.04,duration:800,useNativeDriver:true}),
      Animated.timing(pulseAnim,{toValue:1,duration:800,useNativeDriver:true}),
    ]));
    loop.start();
    return ()=>loop.stop();
  },[]);
  if(pending.length===0) return null;
  return (
    <Animated.View style={{transform:[{scale:pulseAnim}],marginBottom:12}}>
      <TouchableOpacity onPress={onSettleTap} activeOpacity={0.85}
        style={{backgroundColor:'rgba(255,214,10,0.12)',borderRadius:20,borderWidth:1.5,borderColor:'rgba(255,214,10,0.45)',padding:16,flexDirection:'row',alignItems:'center',gap:14}}>
        <View style={{width:44,height:44,borderRadius:22,backgroundColor:'rgba(255,214,10,0.2)',justifyContent:'center',alignItems:'center'}}>
          <Text style={{fontSize:22}}>⏳</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={{fontSize:13,fontWeight:'900',color:'#ffd60a'}}>{pending.length} Pending Bet{pending.length!==1?'s':''}</Text>
          <Text style={{fontSize:10,color:t.muted}}>Tap to settle · Total staked: {fc(pending.reduce((s,b)=>s+(b.stake||0),0))}</Text>
        </View>
        <View style={{backgroundColor:'rgba(255,214,10,0.2)',borderRadius:10,paddingHorizontal:12,paddingVertical:7}}>
          <Text style={{color:'#ffd60a',fontWeight:'800',fontSize:11}}>Settle →</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── FEATURE 3: AI INSIGHTS CARD (Claude powered) ────────────────────────────
function AIInsightsCard({bets, t}) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    if(loading){
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(shimmerAnim,{toValue:1,duration:900,useNativeDriver:true}),
        Animated.timing(shimmerAnim,{toValue:0,duration:900,useNativeDriver:true}),
      ]));
      loop.start();
      return ()=>loop.stop();
    }
  },[loading]);

  const getInsights = async () => {
    if(bets.length<3){Alert.alert('Not enough data','Add at least 3 bets for AI analysis');return;}
    setLoading(true);setExpanded(true);
    try {
      const stats = computeStats(bets);
      const sportBreak = Object.entries(SPORTS).map(([k,v])=>{
        const sb=bets.filter(b=>b.sport===k);
        const pl=sb.reduce((s,b)=>s+(b.profit||0),0);
        const sw=sb.filter(b=>b.result==='won').length;
        const ss=sb.filter(b=>['won','lost'].includes(b.result)).length;
        return sb.length>0?`${v.name}: ${sb.length} bets, ${ss>0?Math.round(sw/ss*100):0}% WR, P&L ₹${Math.round(pl)}`:null;
      }).filter(Boolean).join('; ');
      const dowMap={};
      bets.forEach(b=>{const d=getDOW(b.date);if(!dowMap[d])dowMap[d]={pl:0,c:0};dowMap[d].pl+=(b.profit||0);dowMap[d].c++;});
      const dowSummary=Object.entries(dowMap).map(([d,v])=>`${d}:₹${Math.round(v.pl)}`).join(', ');
      const prompt=`You are a professional betting analyst. Analyze this bettor's data and provide 3-4 sharp, specific, actionable insights in a casual conversational tone (mix of English and common betting terms). Be direct and data-driven.\n\nData:\n- Total bets: ${bets.length}\n- Win rate: ${stats.wr.toFixed(1)}%\n- ROI: ${stats.roi.toFixed(1)}%\n- Total P&L: ₹${Math.round(stats.tPL)}\n- Avg odds: ${stats.avgOdds.toFixed(2)}\n- Current streak: ${stats.curStreak.c} ${stats.curStreak.tp}\n- Max win streak: ${stats.maxW}, Max loss streak: ${stats.maxL}\n- Sports breakdown: ${sportBreak}\n- Day of week P&L: ${dowSummary}\n- Kelly criterion: ${stats.kelly.toFixed(1)}%\n- Max drawdown: ₹${Math.round(stats.maxDD)}\n\nProvide insights in this JSON format only (no markdown):\n{"insights":[{"emoji":"🎯","title":"Short title","detail":"2-3 sentence specific actionable insight based on the data"}]}`;
      const res = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:prompt}]})});
      const data = await res.json();
      const text = data.content?.map(c=>c.text||'').join('').replace(/```json|```/g,'').trim();
      const parsed = JSON.parse(text);
      setInsight(parsed.insights||[]);
      Animated.timing(fadeAnim,{toValue:1,duration:500,useNativeDriver:true}).start();
    } catch(e){setInsight([{emoji:'🤔',title:'Analysis ready',detail:'Your ROI and win rate trends have been processed. Check your sport breakdown for the best opportunities.'}]);}
    setLoading(false);
  };

  return (
    <View style={{backgroundColor:'rgba(94,92,230,0.1)',borderRadius:20,borderWidth:1,borderColor:'rgba(94,92,230,0.3)',marginBottom:12,overflow:'hidden'}}>
      <TouchableOpacity onPress={()=>{if(!insight&&!loading)getInsights();else setExpanded(e=>!e);}} activeOpacity={0.85} style={{padding:16,flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{width:44,height:44,borderRadius:22,backgroundColor:'rgba(94,92,230,0.2)',justifyContent:'center',alignItems:'center'}}>
          <Text style={{fontSize:22}}>🧠</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={{fontSize:13,fontWeight:'900',color:'#5e5ce6'}}>Smart Analysis</Text>
          <Text style={{fontSize:10,color:t.muted}}>{loading?'Analyzing your patterns...':insight?'AI insights ready':'Tap for AI-powered insights'}</Text>
        </View>
        {loading
          ?<Animated.View style={{opacity:shimmerAnim,backgroundColor:'rgba(94,92,230,0.3)',borderRadius:10,paddingHorizontal:12,paddingVertical:7}}><Text style={{color:'#5e5ce6',fontSize:11}}>⏳</Text></Animated.View>
          :<View style={{backgroundColor:'rgba(94,92,230,0.2)',borderRadius:10,paddingHorizontal:12,paddingVertical:7}}><Text style={{color:'#5e5ce6',fontWeight:'800',fontSize:11}}>{insight?expanded?'▲':'▼':'Analyze'}</Text></View>
        }
      </TouchableOpacity>
      {expanded&&insight&&(
        <Animated.View style={{opacity:fadeAnim,paddingHorizontal:16,paddingBottom:16}}>
          <View style={{height:1,backgroundColor:'rgba(94,92,230,0.2)',marginBottom:12}}/>
          {insight.map((ins,i)=>(
            <View key={i} style={{flexDirection:'row',gap:10,marginBottom:10,backgroundColor:'rgba(94,92,230,0.07)',borderRadius:12,padding:10}}>
              <Text style={{fontSize:20,width:28}}>{ins.emoji}</Text>
              <View style={{flex:1}}>
                <Text style={{fontSize:12,fontWeight:'800',color:'#5e5ce6',marginBottom:3}}>{ins.title}</Text>
                <Text style={{fontSize:11,color:t.sub,lineHeight:17}}>{ins.detail}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity onPress={getInsights} style={{alignItems:'center',marginTop:4}}>
            <Text style={{fontSize:10,color:t.muted}}>🔄 Refresh Analysis</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

// ─── FEATURE 4: CSV IMPORT ────────────────────────────────────────────────────
function CSVImportModal({show, onClose, onImport, t}) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState([]);
  const [error, setError] = useState('');
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(()=>{
    if(show) Animated.spring(slideAnim,{toValue:0,tension:90,friction:12,useNativeDriver:true}).start();
    else Animated.timing(slideAnim,{toValue:400,duration:200,useNativeDriver:true}).start();
  },[show]);

  const parseCSV = () => {
    try {
      setError('');
      const lines = csvText.trim().split('\n');
      if(lines.length<2){setError('Need at least header + 1 data row');return;}
      const hdr = lines[0].toLowerCase().split(',').map(h=>h.trim().replace(/"/g,''));
      const parsed = lines.slice(1).map(line=>{
        const vals = line.split(',').map(v=>v.trim().replace(/"/g,''));
        const obj = {};
        hdr.forEach((h,i)=>{obj[h]=vals[i]||'';});
        const odds = parseFloat(obj.odds)||2.0;
        const stake = parseFloat(obj.stake)||100;
        const result = (obj.result||'pending').toLowerCase();
        const profit = result==='won'?Math.round(stake*(odds-1)):result==='lost'?-stake:0;
        return {
          id:Date.now()+Math.random(),
          date:obj.date||today(),
          sport:obj.sport||'cricket',
          match:obj.match||obj.event||'Imported Bet',
          market:obj.market||'Match Winner',
          selection:obj.selection||obj.pick||obj.match||'—',
          odds, stake, result,
          profit: parseFloat(obj.pl||obj.profit||obj['p&l']||profit),
          bookie:obj.bookie||'',
          confidence:parseInt(obj.confidence||3),
          livebet:obj.livebet==='Yes'||obj.livebet==='true',
          betType:obj.bettype||obj['bet type']||'Single',
          tags:(obj.tags||'').split('|').filter(Boolean),
          notes:obj.notes||'CSV Import'
        };
      }).filter(b=>b.match);
      setPreview(parsed);
    } catch(e){setError('Parse error: '+e.message);}
  };

  return (
    <Modal visible={show} animationType="none" transparent>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'flex-end'}}>
        <TouchableOpacity style={{flex:1}} onPress={onClose} activeOpacity={1}/>
        <Animated.View style={{transform:[{translateY:slideAnim}],backgroundColor:'transparent',borderTopLeftRadius:28,borderTopRightRadius:28,borderWidth:1,borderColor:t.cardB,padding:20,paddingBottom:40,maxHeight:'90%',overflow:'hidden'}}>
          <GlassLayer t={t} surface='modal' borderRadius={28} blurAmount={40} tone={t.accent}/>
          <View style={{width:44,height:4,backgroundColor:t.muted,borderRadius:2,alignSelf:'center',marginBottom:16,opacity:0.4}}/>
          <Text style={{fontSize:18,fontWeight:'900',color:t.text,marginBottom:4}}>📥 Import CSV</Text>
          <Text style={{fontSize:10,color:t.muted,marginBottom:14}}>Paste CSV data below. Columns: date, sport, match, selection, odds, stake, result, bookie, tags</Text>
          <TextInput value={csvText} onChangeText={setCsvText} style={[styles.inp(t),{height:110,textAlignVertical:'top',fontFamily:Platform.OS==='ios'?'Courier':'monospace',fontSize:11}]} placeholder={`date,sport,match,selection,odds,stake,result,bookie\n2024-01-15,cricket,MI vs CSK,CSK,1.85,500,won,Betfair`} placeholderTextColor={t.muted} multiline/>
          {error&&<Text style={{color:'#ff453a',fontSize:11,marginBottom:8}}>⚠️ {error}</Text>}
          <View style={{flexDirection:'row',gap:8,marginBottom:14}}>
            <GlossyButton t={t} title={`Preview (${preview.length})`} onPress={parseCSV} tone={t.accent} variant='muted' radius={12} style={{flex:1}} size='sm' textStyle={{color:t.accent}} />
            <GlossyButton t={t} title="Cancel" onPress={onClose} variant='muted' radius={12} style={{flex:1}} size='sm'/>
          </View>
          {preview.length>0&&(
            <>
              <ScrollView style={{maxHeight:180}} showsVerticalScrollIndicator={false}>
                {preview.slice(0,8).map((b,i)=>(
                  <View key={i} style={{backgroundColor:t.card,borderRadius:10,borderWidth:1,borderColor:t.cardB,padding:10,marginBottom:6,flexDirection:'row',alignItems:'center',gap:10}}>
                    <Text style={{fontSize:14}}>{SPORTS[b.sport]?.icon||'🎲'}</Text>
                    <View style={{flex:1}}>
                      <Text style={{fontSize:11,fontWeight:'700',color:t.text}} numberOfLines={1}>{b.match}</Text>
                      <Text style={{fontSize:9,color:t.muted}}>{b.selection} @ {b.odds} · {b.date}</Text>
                    </View>
                    <View style={{backgroundColor:b.result==='won'?'rgba(48,209,88,0.2)':b.result==='lost'?'rgba(255,69,58,0.2)':'rgba(255,214,10,0.2)',borderRadius:6,paddingHorizontal:7,paddingVertical:3}}>
                      <Text style={{fontSize:9,color:b.result==='won'?'#30d158':b.result==='lost'?'#ff453a':'#ffd60a',fontWeight:'700'}}>{b.result}</Text>
                    </View>
                  </View>
                ))}
                {preview.length>8&&<Text style={{color:t.muted,textAlign:'center',fontSize:10,marginBottom:4}}>+ {preview.length-8} more bets</Text>}
              </ScrollView>
              <GlossyButton t={t} title={`Import ${preview.length} Bets`} icon="📥" onPress={()=>{onImport(preview);setPreview([]);setCsvText('');onClose();}} tone='#30d158' radius={16} style={{marginTop:8}} />
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── FEATURE 5: TIPSTER TRACKER ───────────────────────────────────────────────
function TipsterTab({bets, t}) {
  const [tipsters, setTipsters] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [selTipster, setSelTipster] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    store.get('tipsters',[]).then(setTipsters);
    Animated.timing(fadeAnim,{toValue:1,duration:500,useNativeDriver:true}).start();
  },[]);

  const addTipster = ()=>{
    if(!newName.trim()) return;
    const t2=[...tipsters,{id:Date.now(),name:newName.trim(),color:'#'+Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0')}];
    setTipsters(t2);store.set('tipsters',t2);setNewName('');setShowAdd(false);
  };

  const tipsterBets = id => bets.filter(b=>(b.tags||[]).includes('Tipster:'+id));

  return (
    <Animated.View style={{opacity:fadeAnim}}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <Text style={{fontSize:15,fontWeight:'900',color:t.text}}>🏷️ Tipster Tracker</Text>
          <TouchableOpacity onPress={()=>setShowAdd(s=>!s)} style={{backgroundColor:'rgba(10,132,255,0.15)',borderRadius:11,borderWidth:1,borderColor:'rgba(10,132,255,0.3)',paddingHorizontal:14,paddingVertical:7}}>
            <Text style={{color:'#0a84ff',fontWeight:'800',fontSize:11}}>{showAdd?'Cancel':'+ Add'}</Text>
          </TouchableOpacity>
        </View>
        {showAdd&&(
          <View style={{backgroundColor:t.card,borderRadius:14,borderWidth:1,borderColor:t.cardB,padding:14,marginBottom:12}}>
            <TextInput value={newName} onChangeText={setNewName} style={styles.inp(t)} placeholder="Tipster name e.g. CricketGuru" placeholderTextColor={t.muted}/>
            <GlossyButton t={t} title="Add Tipster" onPress={addTipster} tone={t.accent} radius={12} style={{marginTop:2}} />
          </View>
        )}
        <View style={{backgroundColor:'rgba(10,132,255,0.08)',borderRadius:16,borderWidth:1,borderColor:'rgba(10,132,255,0.2)',padding:14,marginBottom:14}}>
          <Text style={{fontSize:11,color:'#0a84ff',fontWeight:'700',marginBottom:6}}>💡 How to track tipsters</Text>
          <Text style={{fontSize:10,color:t.muted,lineHeight:16}}>When adding a bet, add a tag in format "Tipster:TipsterID" to link bets to a tipster. Stats will appear here automatically.</Text>
        </View>
        {tipsters.length===0&&(
          <View style={{alignItems:'center',padding:40}}><Text style={{fontSize:40,marginBottom:10}}>🏷️</Text><Text style={{color:t.muted,textAlign:'center'}}>No tipsters added yet.{'\n'}Track your sources!</Text></View>
        )}
        {tipsters.map(tip=>{
          const tb = tipsterBets(tip.id);
          const tpl = tb.reduce((s,b)=>s+(b.profit||0),0);
          const tw = tb.filter(b=>b.result==='won').length;
          const ts = tb.filter(b=>['won','lost'].includes(b.result)).length;
          const twr = ts>0?(tw/ts)*100:0;
          const troi = tb.reduce((s,b)=>s+(b.stake||0),0)>0?(tpl/tb.reduce((s,b)=>s+(b.stake||0),0))*100:0;
          return (
            <TouchableOpacity key={tip.id} onPress={()=>setSelTipster(selTipster===tip.id?null:tip.id)} activeOpacity={0.85}
              style={{backgroundColor:t.card,borderRadius:18,borderWidth:1,borderColor:t.cardB,marginBottom:10,borderLeftWidth:4,borderLeftColor:tip.color||'#0a84ff',overflow:'hidden'}}>
              <View style={{padding:14}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                    <View style={{width:36,height:36,borderRadius:18,backgroundColor:(tip.color||'#0a84ff')+'30',justifyContent:'center',alignItems:'center'}}>
                      <Text style={{fontSize:18}}>🎯</Text>
                    </View>
                    <View>
                      <Text style={{fontSize:14,fontWeight:'800',color:t.text}}>{tip.name}</Text>
                      <Text style={{fontSize:10,color:t.muted}}>{tb.length} bets tracked</Text>
                    </View>
                  </View>
                  <Text style={{fontSize:18,fontWeight:'900',color:tpl>=0?'#30d158':'#ff453a'}}>{fcs(tpl)}</Text>
                </View>
                <View style={{flexDirection:'row',gap:8}}>
                  {[['WR',`${twr.toFixed(0)}%`,twr>=50?'#30d158':'#ff453a'],['ROI',`${troi.toFixed(1)}%`,troi>=0?'#30d158':'#ff453a'],['Bets',String(tb.length),'#0a84ff']].map(([l,v,c])=>(
                    <View key={l} style={{flex:1,backgroundColor:t.inp,borderRadius:10,borderWidth:1,borderColor:t.inpB,padding:8,alignItems:'center'}}>
                      <Text style={{fontSize:8,color:t.muted,marginBottom:2}}>{l}</Text>
                      <Text style={{fontSize:14,fontWeight:'800',color:c}}>{v}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{fontSize:9,color:t.muted,marginTop:8}}>Tag: Tipster:{tip.id}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{height:20}}/>
      </ScrollView>
    </Animated.View>
  );
}

// ─── FEATURE 6: PRE-BET WARNING (used inside BetModal check) ─────────────────
function PreBetWarningCard({show, dailyLim, weeklyLim, todayLoss, weeklyLoss, t, onProceed, onCancel}) {
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    if(show){
      Animated.parallel([
        Animated.spring(slideAnim,{toValue:0,tension:80,friction:10,useNativeDriver:true}),
        Animated.timing(fadeAnim,{toValue:1,duration:300,useNativeDriver:true}),
      ]).start();
    }
  },[show]);
  if(!show) return null;
  const dlPct = clamp((todayLoss/dailyLim)*100,0,100);
  const wlPct = clamp((weeklyLoss/weeklyLim)*100,0,100);
  return (
    <Animated.View style={{opacity:fadeAnim,transform:[{translateY:slideAnim}],backgroundColor:'rgba(255,159,10,0.12)',borderRadius:20,borderWidth:1.5,borderColor:'rgba(255,159,10,0.45)',padding:18,marginBottom:14}}>
      <Text style={{fontSize:15,fontWeight:'900',color:'#ff9f0a',marginBottom:6}}>⚠️ Limit Warning</Text>
      {dlPct>=80&&<View style={{marginBottom:8}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}><Text style={{fontSize:11,color:t.sub}}>Daily Loss</Text><Text style={{fontSize:11,fontWeight:'700',color:'#ff9f0a'}}>{dlPct.toFixed(0)}% used</Text></View>
        <ProgressBar value={dlPct} max={100} color='#ff9f0a' t={t} height={6}/>
        <Text style={{fontSize:10,color:t.muted,marginTop:3}}>{fc(todayLoss)} of {fc(dailyLim)} daily limit</Text>
      </View>}
      {wlPct>=80&&<View style={{marginBottom:12}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}><Text style={{fontSize:11,color:t.sub}}>Weekly Loss</Text><Text style={{fontSize:11,fontWeight:'700',color:'#ff453a'}}>{wlPct.toFixed(0)}% used</Text></View>
        <ProgressBar value={wlPct} max={100} color='#ff453a' t={t} height={6}/>
        <Text style={{fontSize:10,color:t.muted,marginTop:3}}>{fc(weeklyLoss)} of {fc(weeklyLim)} weekly limit</Text>
      </View>}
      <Text style={{fontSize:11,color:t.sub,marginBottom:14}}>Are you sure you want to add this bet?</Text>
      <View style={{flexDirection:'row',gap:10}}>
        <GlossyButton t={t} title="Cancel" onPress={onCancel} variant='muted' radius={12} style={{flex:1}} size='sm'/>
        <GlossyButton t={t} title="Proceed Anyway" onPress={onProceed} tone='#ff9f0a' radius={12} style={{flex:2}} size='sm'/>
      </View>
    </Animated.View>
  );
}

// ─── FEATURE 7: GOAL SETTING ──────────────────────────────────────────────────
function GoalCard({bets, t}) {
  const [goals, setGoals] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({name:'',target:'5000',deadline:''});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    store.get('goals',[]).then(g=>{setGoals(g);Animated.timing(fadeAnim,{toValue:1,duration:600,useNativeDriver:true}).start();});
  },[]);
  const tPL = bets.reduce((s,b)=>s+(b.profit||0),0);
  const addGoal = ()=>{
    if(!form.name||!form.target) return;
    const g=[...goals,{id:Date.now(),name:form.name,target:parseFloat(form.target),deadline:form.deadline,startPL:tPL,createdAt:today()}];
    setGoals(g);store.set('goals',g);setForm({name:'',target:'5000',deadline:''});setShowAdd(false);
  };
  const removeGoal = id=>{const g=goals.filter(x=>x.id!==id);setGoals(g);store.set('goals',g);};
  if(goals.length===0&&!showAdd) return (
    <TouchableOpacity onPress={()=>setShowAdd(true)} style={{backgroundColor:'rgba(48,209,88,0.08)',borderRadius:20,borderWidth:1,borderColor:'rgba(48,209,88,0.25)',padding:16,marginBottom:12,flexDirection:'row',alignItems:'center',gap:12}}>
      <Text style={{fontSize:24}}>🎯</Text>
      <View style={{flex:1}}><Text style={{fontSize:13,fontWeight:'800',color:'#30d158'}}>Set a Profit Goal</Text><Text style={{fontSize:10,color:t.muted}}>Track your progress toward a target</Text></View>
      <Text style={{color:'#30d158',fontWeight:'800',fontSize:13}}>+</Text>
    </TouchableOpacity>
  );
  return (
    <Animated.View style={{opacity:fadeAnim,marginBottom:12}}>
      {goals.map(goal=>{
        const earned = tPL - goal.startPL;
        const pct = clamp((earned/goal.target)*100,0,100);
        const done = earned>=goal.target;
        const daysLeft = goal.deadline?Math.max(0,Math.ceil((new Date(goal.deadline)-new Date())/86400000)):null;
        return (
          <View key={goal.id} style={{backgroundColor:done?'rgba(48,209,88,0.12)':'rgba(255,214,10,0.08)',borderRadius:20,borderWidth:1,borderColor:done?'rgba(48,209,88,0.4)':'rgba(255,214,10,0.3)',padding:16,marginBottom:8}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
              <View style={{flex:1}}>
                <Text style={{fontSize:14,fontWeight:'900',color:done?'#30d158':'#ffd60a'}}>{done?'🏆':'🎯'} {goal.name}</Text>
                <Text style={{fontSize:10,color:t.muted}}>Target: {fc(goal.target)}{daysLeft!==null?` · ${daysLeft}d left`:''}</Text>
              </View>
              <TouchableOpacity onPress={()=>removeGoal(goal.id)} style={{padding:4}}><Text style={{color:t.muted,fontSize:12}}>✕</Text></TouchableOpacity>
            </View>
            <View style={{marginBottom:8}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6}}>
                <Text style={{fontSize:13,fontWeight:'800',color:done?'#30d158':earned>=0?'#ffd60a':'#ff453a'}}>{fc(earned)}</Text>
                <Text style={{fontSize:12,fontWeight:'700',color:done?'#30d158':'#ffd60a'}}>{pct.toFixed(0)}%</Text>
              </View>
              <ProgressBar value={pct} max={100} color={done?'#30d158':'#ffd60a'} t={t} height={10}/>
            </View>
            {done&&<View style={{backgroundColor:'rgba(48,209,88,0.15)',borderRadius:10,padding:8,alignItems:'center'}}><Text style={{fontSize:11,color:'#30d158',fontWeight:'800'}}>🎉 Goal achieved! You beast!</Text></View>}
          </View>
        );
      })}
      {showAdd&&(
        <View style={{backgroundColor:t.card,borderRadius:16,borderWidth:1,borderColor:t.cardB,padding:14,marginBottom:8}}>
          <Text style={{fontSize:13,fontWeight:'800',color:t.text,marginBottom:10}}>🎯 New Goal</Text>
          <TextInput value={form.name} onChangeText={v=>setForm(f=>({...f,name:v}))} style={styles.inp(t)} placeholder="Goal name e.g. Holiday Fund" placeholderTextColor={t.muted}/>
          <TextInput value={form.target} onChangeText={v=>setForm(f=>({...f,target:v}))} style={styles.inp(t)} placeholder="Target profit e.g. 5000" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
          <TextInput value={form.deadline} onChangeText={v=>setForm(f=>({...f,deadline:v}))} style={styles.inp(t)} placeholder="Deadline YYYY-MM-DD (optional)" placeholderTextColor={t.muted}/>
          <View style={{flexDirection:'row',gap:8}}>
            <GlossyButton t={t} title="Cancel" onPress={()=>setShowAdd(false)} variant='muted' radius={12} style={{flex:1}} size='sm'/>
            <GlossyButton t={t} title="Set Goal 🎯" onPress={addGoal} tone='#30d158' radius={12} style={{flex:2}} size='sm'/>
          </View>
        </View>
      )}
      {goals.length>0&&<TouchableOpacity onPress={()=>setShowAdd(true)} style={{alignItems:'center',padding:8}}><Text style={{color:'#30d158',fontSize:11,fontWeight:'700'}}>+ Add Another Goal</Text></TouchableOpacity>}
    </Animated.View>
  );
}

// ─── FEATURE 8: ODDS COMPARISON ───────────────────────────────────────────────
function OddsComparisonCard({t}) {
  const [rows, setRows] = useState([{bookie:'',odds:''},{bookie:'',odds:''}]);
  const [expanded, setExpanded] = useState(false);
  const addRow = ()=>setRows(r=>[...r,{bookie:'',odds:''}]);
  const updateRow = (i,k,v)=>setRows(r=>r.map((row,j)=>j===i?{...row,[k]:v}:row));
  const removeRow = i=>setRows(r=>r.filter((_,j)=>j!==i));
  const validRows = rows.filter(r=>r.bookie&&parseFloat(r.odds)>0);
  const bestIdx = validRows.length>0?validRows.reduce((best,r,i)=>parseFloat(r.odds)>parseFloat(validRows[best].odds)?i:best,0):-1;
  return (
    <View style={{backgroundColor:'rgba(10,132,255,0.08)',borderRadius:20,borderWidth:1,borderColor:'rgba(10,132,255,0.2)',marginBottom:12,overflow:'hidden'}}>
      <TouchableOpacity onPress={()=>setExpanded(e=>!e)} style={{padding:16,flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{width:40,height:40,borderRadius:20,backgroundColor:'rgba(10,132,255,0.15)',justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:20}}>💹</Text></View>
        <View style={{flex:1}}><Text style={{fontSize:13,fontWeight:'900',color:'#0a84ff'}}>Odds Comparison</Text><Text style={{fontSize:10,color:t.muted}}>Find best value across bookies</Text></View>
        <Text style={{color:'#0a84ff',fontWeight:'800',fontSize:13}}>{expanded?'▲':'▼'}</Text>
      </TouchableOpacity>
      {expanded&&(
        <View style={{paddingHorizontal:16,paddingBottom:16}}>
          <View style={{height:1,backgroundColor:'rgba(10,132,255,0.15)',marginBottom:14}}/>
          {rows.map((row,i)=>(
            <View key={i} style={{flexDirection:'row',gap:8,marginBottom:8,alignItems:'center'}}>
              <TextInput value={row.bookie} onChangeText={v=>updateRow(i,'bookie',v)} style={[styles.inp(t),{flex:2,marginBottom:0}]} placeholder={`Bookie ${i+1}`} placeholderTextColor={t.muted}/>
              <TextInput value={row.odds} onChangeText={v=>updateRow(i,'odds',v)} style={[styles.inp(t),{flex:1,marginBottom:0}]} placeholder="Odds" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
              {rows.length>2&&<TouchableOpacity onPress={()=>removeRow(i)} style={{backgroundColor:'rgba(255,69,58,0.15)',borderRadius:8,padding:8}}><Text style={{color:'#ff453a',fontSize:12}}>✕</Text></TouchableOpacity>}
            </View>
          ))}
          <TouchableOpacity onPress={addRow} style={{alignItems:'center',marginBottom:12,padding:8}}><Text style={{color:'#0a84ff',fontSize:11,fontWeight:'700'}}>+ Add Bookie</Text></TouchableOpacity>
          {validRows.length>=2&&(
            <View>
              {validRows.map((r,i)=>{
                const isBest = i===bestIdx;
                const diff = isBest?0:((parseFloat(validRows[bestIdx].odds)-parseFloat(r.odds))/parseFloat(r.odds))*100;
                return (
                  <View key={i} style={{backgroundColor:isBest?'rgba(48,209,88,0.15)':t.inp,borderRadius:12,borderWidth:1.5,borderColor:isBest?'rgba(48,209,88,0.5)':t.inpB,padding:12,marginBottom:6,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
                    <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                      {isBest&&<Text style={{fontSize:14}}>🏆</Text>}
                      <Text style={{fontSize:12,fontWeight:'700',color:t.text}}>{r.bookie}</Text>
                    </View>
                    <View style={{alignItems:'flex-end'}}>
                      <Text style={{fontSize:16,fontWeight:'900',color:isBest?'#30d158':'#ffd60a'}}>{parseFloat(r.odds).toFixed(2)}</Text>
                      {!isBest&&<Text style={{fontSize:9,color:'#ff453a'}}>-{diff.toFixed(1)}% value</Text>}
                    </View>
                  </View>
                );
              })}
              <View style={{backgroundColor:'rgba(48,209,88,0.1)',borderRadius:12,borderWidth:1,borderColor:'rgba(48,209,88,0.3)',padding:10,alignItems:'center',marginTop:4}}>
                <Text style={{fontSize:12,fontWeight:'800',color:'#30d158'}}>✅ Best value: {validRows[bestIdx]?.bookie} @ {parseFloat(validRows[bestIdx]?.odds).toFixed(2)}</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── FEATURE 9: HEATMAP (yearly GitHub-style) ────────────────────────────────
function YearlyHeatmap({bets, t}) {
  const [expanded, setExpanded] = useState(false);
  const year = new Date().getFullYear();
  const dayMap = {};
  bets.forEach(b=>{if(b.date&&b.date.startsWith(year))dayMap[b.date]=(dayMap[b.date]||0)+(b.profit||0);});
  const jan1 = new Date(year,0,1);
  const totalDays = ((new Date(year,11,31)-jan1)/86400000)+1;
  const startDOW = jan1.getDay();
  const allDays = Array(startDOW).fill(null).concat(Array(totalDays).fill(0).map((_,i)=>{
    const d = new Date(year,0,i+1);
    const ds = d.toISOString().slice(0,10);
    return {date:ds,pl:dayMap[ds]||0,hasData:!!dayMap[ds]};
  }));
  const cellSize = Math.floor((SW-56)/53)-1;
  const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  return (
    <View style={{backgroundColor:t.card,borderRadius:20,borderWidth:1,borderColor:t.cardB,marginBottom:12,overflow:'hidden'}}>
      <TouchableOpacity onPress={()=>setExpanded(e=>!e)} style={{padding:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <View>
          <Text style={{fontSize:13,fontWeight:'800',color:t.text}}>📆 {year} Activity Heatmap</Text>
          <Text style={{fontSize:10,color:t.muted}}>{Object.keys(dayMap).length} active days</Text>
        </View>
        <Text style={{color:t.muted,fontSize:13}}>{expanded?'▲':'▼'}</Text>
      </TouchableOpacity>
      {expanded&&(
        <View style={{paddingHorizontal:16,paddingBottom:16}}>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:1.5}}>
            {allDays.map((day,i)=>{
              if(!day) return <View key={`e${i}`} style={{width:cellSize,height:cellSize}}/>;
              const bg = !day.hasData?t.inp:day.pl>500?'#1a7f37':day.pl>0?'#26a641':day.pl<-500?'#7d0000':day.pl<0?'#b91c1c':'rgba(255,214,10,0.4)';
              return <View key={day.date} style={{width:cellSize,height:cellSize,backgroundColor:bg,borderRadius:2}}/>;
            })}
          </View>
          <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:8}}>
            {months.map((m,i)=><Text key={i} style={{fontSize:7,color:t.muted,width:cellSize*4.4,textAlign:'center'}}>{m}</Text>)}
          </View>
          <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:8}}>
            <Text style={{fontSize:9,color:t.muted}}>Less</Text>
            {[t.inp,'rgba(255,214,10,0.4)','#26a641','#1a7f37'].map((c,i)=><View key={i} style={{width:10,height:10,backgroundColor:c,borderRadius:2}}/>)}
            <Text style={{fontSize:9,color:t.muted}}>More</Text>
            <View style={{flex:1}}/>
            <View style={{width:10,height:10,backgroundColor:'#b91c1c',borderRadius:2}}/><Text style={{fontSize:9,color:t.muted}}>Loss</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── FEATURE 10: ROLLING PERFORMANCE ─────────────────────────────────────────
function RollingPerformanceCard({bets, t}) {
  const [window, setWindow] = useState(10);
  const settled = [...bets].filter(b=>['won','lost'].includes(b.result)).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const recent = settled.slice(-window);
  if(recent.length<3) return null;
  const rpl = recent.reduce((s,b)=>s+(b.profit||0),0);
  const rwr = (recent.filter(b=>b.result==='won').length/recent.length)*100;
  const prevWindow = settled.slice(-window*2,-window);
  const prevPL = prevWindow.length>0?prevWindow.reduce((s,b)=>s+(b.profit||0),0):0;
  const trend = rpl-prevPL;
  return (
    <View style={{backgroundColor:t.card,borderRadius:20,borderWidth:1,borderColor:t.cardB,padding:16,marginBottom:12}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <Text style={{fontSize:13,fontWeight:'800',color:t.text}}>📊 Rolling Form</Text>
        <View style={{flexDirection:'row',gap:5}}>
          {[5,10,20].map(w=>(
            <TouchableOpacity key={w} onPress={()=>setWindow(w)} style={{backgroundColor:window===w?'rgba(10,132,255,0.2)':t.inp,borderRadius:8,borderWidth:1,borderColor:window===w?'rgba(10,132,255,0.5)':t.inpB,paddingHorizontal:10,paddingVertical:4}}>
              <Text style={{color:window===w?'#0a84ff':t.muted,fontSize:10,fontWeight:'700'}}>L{w}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={{flexDirection:'row',gap:8}}>
        <View style={{flex:2,backgroundColor:rpl>=0?'rgba(48,209,88,0.1)':'rgba(255,69,58,0.1)',borderRadius:14,borderWidth:1,borderColor:rpl>=0?'rgba(48,209,88,0.3)':'rgba(255,69,58,0.3)',padding:12}}>
          <Text style={{fontSize:9,color:t.muted,marginBottom:4}}>LAST {window} P&L</Text>
          <Text style={{fontSize:22,fontWeight:'900',color:rpl>=0?'#30d158':'#ff453a'}}>{fcs(rpl)}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:4,marginTop:4}}>
            <Text style={{fontSize:11,color:trend>=0?'#30d158':'#ff453a'}}>{trend>=0?'↑':'↓'}</Text>
            <Text style={{fontSize:10,color:trend>=0?'#30d158':'#ff453a',fontWeight:'700'}}>{fcs(trend)} vs prev</Text>
          </View>
        </View>
        <View style={{flex:1,gap:8}}>
          <View style={{flex:1,backgroundColor:t.inp,borderRadius:12,borderWidth:1,borderColor:t.inpB,padding:10,alignItems:'center'}}>
            <Text style={{fontSize:8,color:t.muted,marginBottom:3}}>WIN RATE</Text>
            <Text style={{fontSize:16,fontWeight:'900',color:rwr>=50?'#30d158':'#ff453a'}}>{rwr.toFixed(0)}%</Text>
          </View>
          <View style={{flex:1,backgroundColor:t.inp,borderRadius:12,borderWidth:1,borderColor:t.inpB,padding:10,alignItems:'center'}}>
            <Text style={{fontSize:8,color:t.muted,marginBottom:3}}>FORM</Text>
            <Text style={{fontSize:10,fontWeight:'800',color:t.text}}>{recent.slice(-5).map(b=>b.result==='won'?'W':'L').join('')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── FEATURE 11: LOSING PATTERNS ──────────────────────────────────────────────
function LosingPatternsCard({bets, t}) {
  const [expanded, setExpanded] = useState(false);
  const losses = bets.filter(b=>b.result==='lost');
  if(losses.length<3) return null;
  const bySport={}, byBookie={}, byDOW={Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0};
  losses.forEach(b=>{
    const s=b.sport;if(!bySport[s])bySport[s]={count:0,pl:0};bySport[s].count++;bySport[s].pl+=(b.profit||0);
    const bk=b.bookie||'Other';if(!byBookie[bk])byBookie[bk]={count:0,pl:0};byBookie[bk].count++;byBookie[bk].pl+=(b.profit||0);
    byDOW[getDOW(b.date)]++;
  });
  const worstSport = Object.entries(bySport).sort((a,b)=>a[1].pl-b[1].pl)[0];
  const worstBookie = Object.entries(byBookie).sort((a,b)=>a[1].pl-b[1].pl)[0];
  const worstDOW = Object.entries(byDOW).sort((a,b)=>b[1]-a[1])[0];
  return (
    <View style={{backgroundColor:'rgba(255,69,58,0.07)',borderRadius:20,borderWidth:1,borderColor:'rgba(255,69,58,0.2)',marginBottom:12,overflow:'hidden'}}>
      <TouchableOpacity onPress={()=>setExpanded(e=>!e)} style={{padding:16,flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{width:40,height:40,borderRadius:20,backgroundColor:'rgba(255,69,58,0.15)',justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:20}}>📉</Text></View>
        <View style={{flex:1}}><Text style={{fontSize:13,fontWeight:'900',color:'#ff453a'}}>Losing Patterns</Text><Text style={{fontSize:10,color:t.muted}}>Where you bleed the most</Text></View>
        <Text style={{color:'#ff453a',fontWeight:'800',fontSize:13}}>{expanded?'▲':'▼'}</Text>
      </TouchableOpacity>
      {expanded&&(
        <View style={{paddingHorizontal:16,paddingBottom:16}}>
          <View style={{height:1,backgroundColor:'rgba(255,69,58,0.2)',marginBottom:12}}/>
          {[
            {label:'Worst Sport', value:`${SPORTS[worstSport?.[0]]?.icon||'🎲'} ${SPORTS[worstSport?.[0]]?.name||worstSport?.[0]||'—'}`, detail:`${worstSport?.[1]?.count||0} losses · ${fcs(worstSport?.[1]?.pl||0)}`, warn:true},
            {label:'Worst Bookie', value:`🎰 ${worstBookie?.[0]||'—'}`, detail:`${worstBookie?.[1]?.count||0} losses · ${fcs(worstBookie?.[1]?.pl||0)}`, warn:true},
            {label:'Worst Day', value:`📅 ${worstDOW?.[0]||'—'}`, detail:`${worstDOW?.[1]||0} losses on this day`, warn:false},
          ].map((item,i)=>(
            <View key={i} style={{backgroundColor:'rgba(255,69,58,0.08)',borderRadius:12,borderWidth:1,borderColor:'rgba(255,69,58,0.2)',padding:12,marginBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <View><Text style={{fontSize:9,color:t.muted,marginBottom:3}}>{item.label}</Text><Text style={{fontSize:13,fontWeight:'800',color:'#ff453a'}}>{item.value}</Text></View>
              <Text style={{fontSize:10,color:t.muted}}>{item.detail}</Text>
            </View>
          ))}
          <View style={{backgroundColor:'rgba(255,69,58,0.1)',borderRadius:12,padding:10,alignItems:'center'}}>
            <Text style={{fontSize:11,color:'#ff453a',fontWeight:'700'}}>💡 Avoid {worstDOW?.[0]} {SPORTS[worstSport?.[0]]?.name||''} bets on {worstBookie?.[0]||'this bookie'}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── FEATURE 12: VARIANCE METER ───────────────────────────────────────────────
function VarianceMeterCard({bets, t}) {
  const settled = bets.filter(b=>['won','lost'].includes(b.result));
  if(settled.length<5) return null;
  const won = settled.filter(b=>b.result==='won').length;
  const avgOdds = settled.reduce((s,b)=>s+(b.odds||2),0)/settled.length;
  const expWR = 1/avgOdds;
  const actWR = won/settled.length;
  const expWins = Math.round(expWR*settled.length);
  const actWins = won;
  const luckDiff = actWins-expWins;
  const luckColor = luckDiff>0?'#30d158':luckDiff<0?'#ff453a':'#ffd60a';
  return (
    <View style={{backgroundColor:'rgba(191,90,242,0.08)',borderRadius:20,borderWidth:1,borderColor:'rgba(191,90,242,0.2)',padding:16,marginBottom:12}}>
      <SectionHead title="🎲 Variance & Luck Meter" t={t}/>
      <View style={{flexDirection:'row',gap:8,marginBottom:12}}>
        {[['Expected Wins',String(expWins),'#0a84ff'],['Actual Wins',String(actWins),'#30d158'],['Luck',`${luckDiff>=0?'+':''}${luckDiff}`,luckColor]].map(([l,v,c])=>(
          <View key={l} style={{flex:1,backgroundColor:t.inp,borderRadius:12,borderWidth:1,borderColor:t.inpB,padding:10,alignItems:'center'}}>
            <Text style={{fontSize:8,color:t.muted,marginBottom:3,textTransform:'uppercase'}}>{l}</Text>
            <Text style={{fontSize:18,fontWeight:'900',color:c}}>{v}</Text>
          </View>
        ))}
      </View>
      <View style={{backgroundColor:luckColor+'15',borderRadius:12,borderWidth:1,borderColor:luckColor+'30',padding:10,alignItems:'center'}}>
        <Text style={{fontSize:12,fontWeight:'800',color:luckColor}}>
          {luckDiff>3?'🍀 Very Lucky Run — variance will correct':luckDiff>0?'✅ Slightly above expected':luckDiff<-3?'💀 Unlucky run — stay the course':luckDiff<0?'📉 Slightly below expected':'⚖️ Perfectly calibrated!'}
        </Text>
        <Text style={{fontSize:10,color:t.muted,marginTop:3}}>Based on avg odds of {avgOdds.toFixed(2)} across {settled.length} settled bets</Text>
      </View>
    </View>
  );
}

// ─── FEATURE 13: COMPARISON MODE (already partially covered — dedicated card) ─
function PeriodComparisonCard({bets, t}) {
  const [pA, setPA] = useState('month');
  const [pB, setPB] = useState('last_month');
  const now = new Date();
  const getPeriodBets = p => {
    if(p==='week'){const s=new Date(now);s.setDate(s.getDate()-7);return bets.filter(b=>new Date(b.date)>=s);}
    if(p==='month'){const s=new Date(now.getFullYear(),now.getMonth(),1);return bets.filter(b=>new Date(b.date)>=s);}
    if(p==='last_month'){const s=new Date(now.getFullYear(),now.getMonth()-1,1);const e=new Date(now.getFullYear(),now.getMonth(),0);return bets.filter(b=>new Date(b.date)>=s&&new Date(b.date)<=e);}
    if(p==='year'){const s=new Date(now.getFullYear(),0,1);return bets.filter(b=>new Date(b.date)>=s);}
    return bets;
  };
  const bA=getPeriodBets(pA), bB=getPeriodBets(pB);
  const getStats = bs=>{const pl=bs.reduce((s,b)=>s+(b.profit||0),0);const stk=bs.reduce((s,b)=>s+(b.stake||0),0);const w=bs.filter(b=>b.result==='won').length;const s=bs.filter(b=>['won','lost'].includes(b.result)).length;return{pl,roi:stk>0?(pl/stk)*100:0,wr:s>0?(w/s)*100:0,bets:bs.length};};
  const sA=getStats(bA), sB=getStats(bB);
  const labels={week:'This Week',month:'This Month',last_month:'Last Month',year:'This Year',all:'All Time'};
  const opts=[['week','Week'],['month','Month'],['last_month','L.Month'],['year','Year'],['all','All']];
  return (
    <View style={{backgroundColor:t.card,borderRadius:20,borderWidth:1,borderColor:t.cardB,padding:16,marginBottom:12}}>
      <SectionHead title="📊 Period Comparison" t={t}/>
      <View style={{flexDirection:'row',gap:8,marginBottom:14}}>
        <View style={{flex:1}}>
          <Text style={{fontSize:9,color:'#0a84ff',fontWeight:'700',marginBottom:6,textTransform:'uppercase'}}>Period A</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{flexDirection:'row',gap:4}}>{opts.map(([k,l])=><TouchableOpacity key={k} onPress={()=>setPA(k)} style={{backgroundColor:pA===k?'rgba(10,132,255,0.2)':t.inp,borderRadius:8,borderWidth:1,borderColor:pA===k?'rgba(10,132,255,0.5)':t.inpB,paddingHorizontal:8,paddingVertical:4}}><Text style={{color:pA===k?'#0a84ff':t.muted,fontSize:9,fontWeight:'700'}}>{l}</Text></TouchableOpacity>)}</View></ScrollView>
        </View>
        <View style={{flex:1}}>
          <Text style={{fontSize:9,color:'#bf5af2',fontWeight:'700',marginBottom:6,textTransform:'uppercase'}}>Period B</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{flexDirection:'row',gap:4}}>{opts.map(([k,l])=><TouchableOpacity key={k} onPress={()=>setPB(k)} style={{backgroundColor:pB===k?'rgba(191,90,242,0.2)':t.inp,borderRadius:8,borderWidth:1,borderColor:pB===k?'rgba(191,90,242,0.5)':t.inpB,paddingHorizontal:8,paddingVertical:4}}><Text style={{color:pB===k?'#bf5af2':t.muted,fontSize:9,fontWeight:'700'}}>{l}</Text></TouchableOpacity>)}</View></ScrollView>
        </View>
      </View>
      {[['P&L',fcs(sA.pl),fcs(sB.pl),'#30d158','#ff453a',v=>parseFloat(v.replace(/[^\d.-]/g,''))],['ROI',pct(sA.roi),pct(sB.roi),'#0a84ff','#bf5af2',v=>parseFloat(v)],['Win Rate',pct(sA.wr,0),pct(sB.wr,0),'#ffd60a','#30d158',v=>parseFloat(v)],['Bets',String(sA.bets),String(sB.bets),'#0a84ff','#bf5af2',v=>parseInt(v)]].map(([l,vA,vB,cA,cB])=>(
        <View key={l} style={{flexDirection:'row',alignItems:'center',marginBottom:8,gap:8}}>
          <Text style={{fontSize:10,color:t.muted,width:58,textAlign:'right'}}>{l}</Text>
          <View style={{flex:1,backgroundColor:'rgba(10,132,255,0.1)',borderRadius:8,borderWidth:1,borderColor:'rgba(10,132,255,0.25)',padding:6,alignItems:'center'}}><Text style={{fontSize:12,fontWeight:'800',color:'#0a84ff'}}>{vA}</Text></View>
          <Text style={{color:t.muted,fontSize:10}}>vs</Text>
          <View style={{flex:1,backgroundColor:'rgba(191,90,242,0.1)',borderRadius:8,borderWidth:1,borderColor:'rgba(191,90,242,0.25)',padding:6,alignItems:'center'}}><Text style={{fontSize:12,fontWeight:'800',color:'#bf5af2'}}>{vB}</Text></View>
        </View>
      ))}
    </View>
  );
}

// ─── FEATURE 14: BET TEMPLATES ────────────────────────────────────────────────
function TemplatesModal({show, onClose, onApply, t}) {
  const [templates, setTemplates] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({name:'',sport:'cricket',selection:'',odds:'',stake:'',market:'Match Winner'});
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(()=>{
    store.get('templates',DEFAULT_TEMPLATES).then(setTemplates);
    if(show) Animated.spring(slideAnim,{toValue:0,tension:90,friction:12,useNativeDriver:true}).start();
    else Animated.timing(slideAnim,{toValue:400,duration:200,useNativeDriver:true}).start();
  },[show]);

  const saveTemplate = ()=>{
    if(!form.name||!form.selection) return;
    const t2=[...templates,{...form,id:'t'+Date.now()}];
    setTemplates(t2);store.set('templates',t2);setAdding(false);
  };
  const deleteTemplate = id=>{const t2=templates.filter(t=>t.id!==id);setTemplates(t2);store.set('templates',t2);};

  return (
    <Modal visible={show} animationType="none" transparent>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'flex-end'}}>
        <TouchableOpacity style={{flex:1}} onPress={onClose} activeOpacity={1}/>
        <Animated.View style={{transform:[{translateY:slideAnim}],backgroundColor:'transparent',borderTopLeftRadius:28,borderTopRightRadius:28,borderWidth:1,borderColor:t.cardB,padding:20,paddingBottom:40,maxHeight:'85%',overflow:'hidden'}}>
          <GlassLayer t={t} surface='modal' borderRadius={28} blurAmount={40} tone={t.accent}/>
          <View style={{width:44,height:4,backgroundColor:t.muted,borderRadius:2,alignSelf:'center',marginBottom:16,opacity:0.4}}/>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <Text style={{fontSize:18,fontWeight:'900',color:t.text}}>📋 Bet Templates</Text>
            <TouchableOpacity onPress={()=>setAdding(a=>!a)} style={{backgroundColor:'rgba(10,132,255,0.15)',borderRadius:11,borderWidth:1,borderColor:'rgba(10,132,255,0.3)',paddingHorizontal:14,paddingVertical:7}}><Text style={{color:'#0a84ff',fontWeight:'800',fontSize:11}}>{adding?'Cancel':'+ New'}</Text></TouchableOpacity>
          </View>
          {adding&&(
            <View style={{backgroundColor:t.inp,borderRadius:14,borderWidth:1,borderColor:t.inpB,padding:14,marginBottom:14}}>
              <TextInput value={form.name} onChangeText={v=>setForm(f=>({...f,name:v}))} style={styles.inp(t)} placeholder="Template name" placeholderTextColor={t.muted}/>
              <View style={{flexDirection:'row',gap:8,marginBottom:8}}>
                <TextInput value={form.selection} onChangeText={v=>setForm(f=>({...f,selection:v}))} style={[styles.inp(t),{flex:2,marginBottom:0}]} placeholder="Selection / pick" placeholderTextColor={t.muted}/>
                <TextInput value={form.odds} onChangeText={v=>setForm(f=>({...f,odds:v}))} style={[styles.inp(t),{flex:1,marginBottom:0}]} placeholder="Odds" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
              </View>
              <TextInput value={form.stake} onChangeText={v=>setForm(f=>({...f,stake:v}))} style={[styles.inp(t),{marginTop:8}]} placeholder="Default stake" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
              <GlossyButton t={t} title="Save Template" onPress={saveTemplate} tone={t.accent} radius={12} style={{marginTop:4}} />
            </View>
          )}
          <ScrollView showsVerticalScrollIndicator={false}>
            {templates.map(tmpl=>(
              <View key={tmpl.id} style={{backgroundColor:t.card,borderRadius:16,borderWidth:1,borderColor:t.cardB,padding:14,marginBottom:8}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <Text style={{fontSize:13,fontWeight:'800',color:t.text}}>{SPORTS[tmpl.sport]?.icon||'🎲'} {tmpl.name}</Text>
                  <TouchableOpacity onPress={()=>deleteTemplate(tmpl.id)} style={{padding:4}}><Text style={{color:'#ff453a',fontSize:12}}>🗑️</Text></TouchableOpacity>
                </View>
                <Text style={{fontSize:11,color:t.sub}}>{tmpl.selection} @ {tmpl.odds||'—'} · Stake: {tmpl.stake?fc(parseFloat(tmpl.stake)):'—'}</Text>
                <GlossyButton t={t} title="Use Template" icon="⚡" onPress={()=>{onApply(tmpl);onClose();}} tone={t.accent} variant='muted' radius={10} style={{marginTop:8}} size='sm' textStyle={{color:t.accent}} />
              </View>
            ))}
            <View style={{height:20}}/>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── FEATURE 15: PIN LOCK ─────────────────────────────────────────────────────
function PINLock({onUnlock, t}) {
  const [pin, setPin] = useState('');
  const [savedPin, setSavedPin] = useState(null);
  const [setting, setSetting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    store.get('pin',null).then(p=>{setSavedPin(p);Animated.timing(fadeAnim,{toValue:1,duration:400,useNativeDriver:true}).start();if(!p){onUnlock();}});
  },[]);

  const shake = ()=>{
    Animated.sequence([
      Animated.timing(shakeAnim,{toValue:10,duration:60,useNativeDriver:true}),
      Animated.timing(shakeAnim,{toValue:-10,duration:60,useNativeDriver:true}),
      Animated.timing(shakeAnim,{toValue:8,duration:60,useNativeDriver:true}),
      Animated.timing(shakeAnim,{toValue:0,duration:60,useNativeDriver:true}),
    ]).start();
  };

  const handleNum = n => {
    if(setting){
      if(pin.length<4){const np=pin+n;setPin(np);if(np.length===4){if(!confirm){setConfirm(np);setPin('');}else if(confirm===np){store.set('pin',np);setSavedPin(np);onUnlock();}else{shake();setPin('');setConfirm('');}}}
    } else {
      if(pin.length<4){const np=pin+n;setPin(np);if(np.length===4){if(np===savedPin){onUnlock();}else{shake();setTimeout(()=>setPin(''),300);}}}
    }
  };

  if(!savedPin&&!setting) return null;

  return (
    <Animated.View style={{opacity:fadeAnim,position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:t.bg,zIndex:9999,justifyContent:'center',alignItems:'center'}}>
      <Animated.View style={{transform:[{translateX:shakeAnim}],alignItems:'center',width:'100%',paddingHorizontal:40}}>
        <Text style={{fontSize:50,marginBottom:20}}>🔐</Text>
        <Text style={{fontSize:22,fontWeight:'900',color:t.text,marginBottom:8}}>BetTracker Pro</Text>
        <Text style={{fontSize:13,color:t.muted,marginBottom:40}}>{setting?(confirm?'Confirm new PIN':'Set 4-digit PIN'):'Enter your PIN'}</Text>
        <View style={{flexDirection:'row',gap:16,marginBottom:44}}>
          {[0,1,2,3].map(i=>(
            <View key={i} style={{width:18,height:18,borderRadius:9,backgroundColor:pin.length>i?t.accent:t.inp,borderWidth:2,borderColor:pin.length>i?t.accent:t.inpB}}/>
          ))}
        </View>
        {[[1,2,3],[4,5,6],[7,8,9],['',0,'⌫']].map((row,ri)=>(
          <View key={ri} style={{flexDirection:'row',gap:20,marginBottom:16}}>
            {row.map((n,ci)=>n===''?<View key={ci} style={{width:70,height:70}}/>:(
              <TouchableOpacity key={ci} onPress={()=>{if(n==='⌫')setPin(p=>p.slice(0,-1));else handleNum(String(n));}}
                style={{width:70,height:70,borderRadius:35,backgroundColor:t.card,borderWidth:1,borderColor:t.cardB,justifyContent:'center',alignItems:'center',shadowColor:'#000',shadowOpacity:0.2,shadowRadius:8,shadowOffset:{width:0,height:4}}}>
                <Text style={{fontSize:n==='⌫'?20:24,fontWeight:'700',color:t.text}}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

// ─── FEATURE 16: CURRENCY SWITCHER COMPONENT ─────────────────────────────────
function CurrencySwitcher({currency, setCurrency, t}) {
  return (
    <View style={{marginBottom:14}}>
      <Text style={{fontSize:10,color:t.muted,fontWeight:'700',marginBottom:8,textTransform:'uppercase',letterSpacing:0.6}}>💱 Currency</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{flexDirection:'row',gap:6}}>
          {Object.entries(CURRENCIES).map(([k,v])=>(
            <GlossyPill
              key={k}
              t={t}
              icon={v.symbol}
              label={k}
              onPress={()=>{setCurrency(k);setCurrencyGlobal(k);store.set('currency',k);}}
              tone="#ffd60a"
              active={currency===k}
              size='sm'
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
// ─── AMBIENT BACKGROUND ORBS (from BettingTrackerDashboard) ─────────────────
function AmbientGlow({plC}) {
  // Breathing glow pulse
  const glowAnim = useRef(new Animated.Value(0.18)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, {toValue:0.32, duration:2200, useNativeDriver:false}),
      Animated.timing(glowAnim, {toValue:0.18, duration:2200, useNativeDriver:false}),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <>
      {/* Top accent orb — blue */}
      <View style={{
        position:'absolute', top:-80, left:'20%',
        width:260, height:260, borderRadius:130,
        backgroundColor:'rgba(79,110,247,0.10)',
        pointerEvents:'none',
      }}/>
      {/* Bottom profit orb — animates with P&L color */}
      <Animated.View style={{
        position:'absolute', bottom:80, right:-50,
        width:200, height:200, borderRadius:100,
        backgroundColor: plC === '#30d158' ? 'rgba(0,217,139,0.07)' : 'rgba(255,77,106,0.07)',
        opacity: glowAnim,
        pointerEvents:'none',
      }}/>
    </>
  );
}

// ─── HERO CARD (upgraded with BettingTrackerDashboard premium glow) ──────────
function HeroCard({tPL, roi, wr, won, lost, pending, curStreak, t}) {
  const isProfit = tPL >= 0;
  const plC = isProfit ? '#30d158' : '#ff453a';
  const currencySymbol = getCurrencySymbol();

  const streakIsHot = curStreak?.tp === 'won' && curStreak?.c > 0;
  const streakIsCold = curStreak?.tp === 'lost' && curStreak?.c > 0;
  const streakText = streakIsHot
    ? `↑ ${curStreak.c} win streak`
    : streakIsCold
      ? `↓ ${curStreak.c} loss streak`
      : '• no active streak';
  const streakColor = streakIsHot ? '#30d158' : streakIsCold ? '#ff453a' : 'rgba(255,255,255,0.42)';

  // Count-up animation
  const animVal = useRef(new Animated.Value(0)).current;
  const [displayNum, setDisplayNum] = useState(0);
  useEffect(() => {
    animVal.setValue(0);
    const id = animVal.addListener(({value}) => setDisplayNum(Math.round(value * tPL)));
    Animated.timing(animVal, {toValue:1, duration:1400, useNativeDriver:false}).start();
    return () => animVal.removeListener(id);
  }, [animVal, tPL]);

  // Breathing glow pulse
  const glowOpacity = useRef(new Animated.Value(0.32)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowOpacity, {toValue:0.62, duration:2000, useNativeDriver:false}),
      Animated.timing(glowOpacity, {toValue:0.32, duration:2000, useNativeDriver:false}),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glowOpacity]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, {toValue:1.014, duration:1800, useNativeDriver:true}),
      Animated.timing(pulseAnim, {toValue:1, duration:1800, useNativeDriver:true}),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const sign = displayNum >= 0 ? '+' : '-';
  const absStr = currencySymbol + Math.abs(displayNum).toLocaleString('en-IN');

  return (
    <View style={{position:'relative', marginBottom:20}}>
      <Animated.View style={{
        position:'absolute', top:-30, left:'7%',
        width:'86%', height:182, borderRadius:92,
        backgroundColor: isProfit ? 'rgba(0,217,139,0.17)' : 'rgba(255,77,106,0.17)',
        opacity: glowOpacity,
      }}/>

      <Animated.View style={{
        borderRadius:30,
        transform:[{scale: pulseAnim}],
        shadowColor: plC, shadowOpacity:0.48, shadowRadius:38, shadowOffset:{width:0, height:12},
      }}>
        <View style={{
          borderRadius:30, paddingHorizontal:24, paddingVertical:24,
          backgroundColor: isProfit ? 'rgba(16,38,25,0.97)' : 'rgba(46,16,22,0.97)',
          borderWidth:1.5, borderColor: plC + '58',
          overflow:'hidden',
        }}>
          <View style={{position:'absolute', top:-52, left:-30, width:200, height:200, borderRadius:100, backgroundColor:plC, opacity:0.09}}/>
          <View style={{position:'absolute', bottom:-54, right:-24, width:160, height:160, borderRadius:80, backgroundColor:isProfit ? '#4F6EF7' : '#ff9f0a', opacity:0.07}}/>
          <View style={{position:'absolute', top:0, left:'10%', right:'10%', height:2, backgroundColor:plC, opacity:0.5, borderRadius:2}}/>

          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12}}>
            <View>
              <Text style={{fontSize:10, color:'rgba(255,255,255,0.34)', fontWeight:'800', letterSpacing:2, textTransform:'uppercase'}}>Total P&L</Text>
              <Text style={{fontSize:11, color:'rgba(255,255,255,0.48)', marginTop:6, fontWeight:'700'}}>{won} won · {lost} lost · {pending} pending</Text>
            </View>
            <View style={{backgroundColor: plC+'24', borderRadius:12, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:plC+'40'}}>
              <Text style={{fontSize:12, color:plC, fontWeight:'900', letterSpacing:0.2}}>{(roi>=0?'+':'') + pct(roi,1)} ROI</Text>
            </View>
          </View>

          <Text style={{
            fontSize:64, fontWeight:'900', color:plC, letterSpacing:-3.2,
            marginBottom:12, includeFontPadding:false, lineHeight:70,
            textShadowColor: isProfit ? 'rgba(48,209,88,0.35)' : 'rgba(255,69,58,0.35)',
            textShadowRadius:18,
          }}>
            {sign}{absStr}
          </Text>

          <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:18}}>
            <Text style={{fontSize:14, color:streakColor, fontWeight:'900', letterSpacing:0.1}}>{streakText}</Text>
            <View style={{backgroundColor:'rgba(255,255,255,0.07)', borderRadius:10, paddingHorizontal:10, paddingVertical:5, borderWidth:1, borderColor:'rgba(255,255,255,0.09)'}}>
              <Text style={{fontSize:10, color:'rgba(255,255,255,0.58)', fontWeight:'800'}}>WR {pct(wr,0)}</Text>
            </View>
          </View>

          <View style={{height:1, backgroundColor:'rgba(255,255,255,0.08)', marginBottom:14}}/>

          <View style={{flexDirection:'row', gap:10}}>
            {[
              {label:'Won', value:String(won), color:'#30d158'},
              {label:'Lost', value:String(lost), color:'#ff453a'},
              {label:'Pending', value:String(pending), color:'#ffd60a'},
            ].map((item,i) => (
              <View key={i} style={{
                flex:1,
                backgroundColor:'rgba(255,255,255,0.05)',
                borderRadius:16,
                paddingVertical:12,
                paddingHorizontal:10,
                borderWidth:1,
                borderColor:'rgba(255,255,255,0.06)',
              }}>
                <Text style={{fontSize:20, fontWeight:'900', color:item.color, letterSpacing:-0.5, textAlign:'center'}}>{item.value}</Text>
                <Text style={{fontSize:8.5, color:'rgba(255,255,255,0.3)', fontWeight:'800', letterSpacing:0.9, textTransform:'uppercase', textAlign:'center', marginTop:4}}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── QUICK ACTIONS ────────────────────────────────────────────────────────────
function QuickActions({onAddBet, onQuickAdd, onStats, onExport, t}) {
  const scales = [useRef(new Animated.Value(1)).current, useRef(new Animated.Value(1)).current, useRef(new Animated.Value(1)).current, useRef(new Animated.Value(1)).current];
  const actions = [
    {icon:'➕', label:'Add Bet',   color:'#30d158', iconBg:'rgba(48,209,88,0.18)',  fn:onAddBet},
    {icon:'⚡', label:'Quick Add', color:'#0a84ff', iconBg:'rgba(10,132,255,0.18)', fn:onQuickAdd},
    {icon:'📊', label:'Stats',     color:'#bf5af2', iconBg:'rgba(191,90,242,0.18)', fn:onStats},
    {icon:'📤', label:'Export',    color:'#ff9f0a', iconBg:'rgba(255,159,10,0.18)', fn:onExport},
  ];
  const pressIn  = i => Animated.spring(scales[i], {toValue:0.92, useNativeDriver:true, speed:50, bounciness:3}).start();
  const pressOut = i => Animated.spring(scales[i], {toValue:1,    useNativeDriver:true, speed:28, bounciness:8}).start();

  const cardW = (SW - 28 - 24) / 4; // screen - paddingHorizontal(14*2) - gaps(8*3)

  return (
    <View style={{marginBottom:20}}>
      <Text style={{fontSize:10, color:'rgba(255,255,255,0.28)', fontWeight:'800', letterSpacing:1.6, textTransform:'uppercase', marginBottom:12}}>Quick Actions</Text>
      <View style={{flexDirection:'row', gap:8}}>
        {actions.map((a,i) => (
          <Animated.View key={i} style={{width:cardW, transform:[{scale:scales[i]}]}}>
            <TouchableOpacity
              onPress={a.fn}
              onPressIn={()=>pressIn(i)}
              onPressOut={()=>pressOut(i)}
              activeOpacity={1}
              style={{
                borderRadius:20,
                backgroundColor:'rgba(26,26,30,0.90)',
                borderWidth:1,
                borderColor:'rgba(255,255,255,0.09)',
                paddingVertical:16,
                paddingHorizontal:4,
                alignItems:'center',
                gap:8,
              }}
            >
              {/* Top accent line */}
              <View style={{position:'absolute',top:0,left:'15%',right:'15%',height:1.5,backgroundColor:a.color,opacity:0.4,borderRadius:1}}/>

              {/* Icon bubble */}
              <View style={{
                width:40, height:40,
                borderRadius:12,
                backgroundColor: a.iconBg,
                borderWidth:1,
                borderColor: a.color+'40',
                justifyContent:'center',
                alignItems:'center',
              }}>
                <Text style={{fontSize:18}}>{a.icon}</Text>
              </View>

              {/* Label — single line, no wrap */}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={{
                  fontSize:10,
                  color: a.color,
                  fontWeight:'800',
                  letterSpacing:0.1,
                  textAlign:'center',
                  width:'100%',
                  paddingHorizontal:4,
                }}
              >{a.label}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ─── PROFILE TAB (simple) ─────────────────────────────────────────────────────
function ProfileTab({bets, t, theme, setTheme, showToast}) {
  const stats = useMemo(()=>computeStats(bets),[bets]);
  const {tPL, roi, wr, won, lost} = stats;
  const plC = tPL >= 0 ? '#30d158' : '#ff453a';
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Avatar */}
      <View style={{alignItems:'center', paddingVertical:28}}>
        <View style={{width:72, height:72, borderRadius:36, backgroundColor:'rgba(10,132,255,0.2)', borderWidth:2, borderColor:'rgba(10,132,255,0.45)', justifyContent:'center', alignItems:'center', marginBottom:10}}>
          <Text style={{fontSize:32}}>👤</Text>
        </View>
        <Text style={{fontSize:18, fontWeight:'800', color:t.text}}>BetTracker Pro</Text>
        <Text style={{fontSize:11, color:t.muted, marginTop:4}}>{bets.length} total bets tracked</Text>
      </View>
      {/* Stats summary */}
      <Card t={t} style={{marginBottom:12}}>
        <SectionHead title="My Performance" t={t}/>
        <View style={{flexDirection:'row', flexWrap:'wrap', gap:10}}>
          {[
            {label:'Total P/L', value:(tPL>=0?'+':'')+fc(tPL), color:plC},
            {label:'ROI',       value:pct(roi),                  color:plC},
            {label:'Win Rate',  value:pct(wr,0),                 color:'#0a84ff'},
            {label:'Wins',      value:String(won),               color:'#30d158'},
            {label:'Losses',    value:String(lost),              color:'#ff453a'},
            {label:'All Bets',  value:String(bets.length),       color:t.sub},
          ].map((s,i)=>(
            <View key={i} style={{width:'30%', backgroundColor:t.inp, borderRadius:12, padding:10, alignItems:'center'}}>
              <Text style={{fontSize:14, fontWeight:'800', color:s.color}}>{s.value}</Text>
              <Text style={{fontSize:9, color:t.muted, marginTop:2}}>{s.label}</Text>
            </View>
          ))}
        </View>
      </Card>
      {/* Theme switcher */}
      <Card t={t} style={{marginBottom:12}}>
        <SectionHead title="Theme" t={t}/>
        <View style={{flexDirection:'row', gap:8}}>
          {Object.entries({amoled:'⬛',dark:'🌙',light:'☀️',forest:'🌿'}).map(([k,ico])=>(
            <GlossyPill
              key={k}
              t={t}
              icon={ico}
              label={k}
              onPress={()=>setTheme(k)}
              tone={t.accent}
              active={theme===k}
              size='sm'
              style={{flex:1}}
              textStyle={{textTransform:'capitalize'}}
            />
          ))}
        </View>
      </Card>
      <AchievementsTab bets={bets} t={t}/>
      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ─── CHART TAB CARD (Daily / Weekly / Monthly + tooltip) ─────────────────────
function ChartTabCard({bets, runData, maxDD, t}) {
  const [tab, setTab] = useState('cumulative');
  const [tooltip, setTooltip] = useState(null);

  const dailyData = useMemo(()=>{
    const map={};
    bets.filter(b=>b.result!=='pending').forEach(b=>{if(!map[b.date])map[b.date]=0;map[b.date]+=(b.profit||0);});
    return Object.entries(map).sort().slice(-14).map(([date,value])=>({date:date.slice(5),v:value}));
  },[bets]);

  const weeklyData = useMemo(()=>{
    const map={};
    bets.filter(b=>b.result!=='pending').forEach(b=>{const w=getWeekKey(b.date);if(!map[w])map[w]=0;map[w]+=(b.profit||0);});
    return Object.entries(map).sort().slice(-10).map(([label,value])=>({date:label,v:value}));
  },[bets]);

  const monthlyData = useMemo(()=>{
    const map={};
    bets.filter(b=>b.result!=='pending').forEach(b=>{const m=b.date.slice(0,7);if(!map[m])map[m]=0;map[m]+=(b.profit||0);});
    return Object.entries(map).sort().slice(-6).map(([label,value])=>({date:label.slice(5),v:value}));
  },[bets]);

  const tabs=[['cumulative','Cumulative'],['daily','Daily'],['weekly','Weekly'],['monthly','Monthly']];
  const data = tab==='daily'?dailyData:tab==='weekly'?weeklyData:tab==='monthly'?monthlyData:runData;

  const ChartWithTooltip=({data,height:h=110})=>{
    if(!data||data.length<2) return <Text style={{color:t.muted,textAlign:'center',paddingVertical:20,fontSize:11}}>Add more bets to see chart</Text>;
    const W=SW-64;
    const vals=data.map(d=>d.v);
    const mn=Math.min(...vals),mx=Math.max(...vals);
    const range=mx-mn||1;
    const px=i=>(i/(data.length-1))*W;
    const py=v=>h-clamp(((v-mn)/range)*h*0.82+h*0.09,2,h-2);
    const pts=data.map((d,i)=>`${px(i)},${py(d.v)}`).join(' ');
    const polyPts=`0,${h} ${pts} ${W},${h}`;
    const lastV=vals[vals.length-1];
    const lc=lastV>=0?'#30d158':'#ff453a';
    return (
      <View>
        <TouchableOpacity activeOpacity={1}
          onPress={e=>{
            const tx=e.nativeEvent.locationX;
            const idx=Math.round((tx/W)*(data.length-1));
            const i=clamp(idx,0,data.length-1);
            setTooltip(tooltip&&tooltip.i===i?null:{i,x:px(i),y:py(data[i].v),d:data[i]});
          }}>
          <Svg width={W} height={h}>
            <Defs>
              <LinearGradient id="lgc" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={lc} stopOpacity="0.3"/>
                <Stop offset="100%" stopColor={lc} stopOpacity="0.01"/>
              </LinearGradient>
            </Defs>
            {mn<0&&mx>0&&<Line x1="0" y1={py(0)} x2={W} y2={py(0)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3,3"/>}
            <Polygon points={polyPts} fill="url(#lgc)"/>
            <Polyline points={pts} fill="none" stroke={lc} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
            {tooltip&&<>
              <Line x1={tooltip.x} y1={0} x2={tooltip.x} y2={h} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3,3"/>
              <Circle cx={tooltip.x} cy={tooltip.y} r="5" fill={lc} opacity="1"/>
              <Circle cx={tooltip.x} cy={tooltip.y} r="9" fill={lc} opacity="0.2"/>
            </>}
          </Svg>
        </TouchableOpacity>
        {tooltip&&(
          <View style={{position:'absolute',top:Math.max(0,tooltip.y-42),left:clamp(tooltip.x-48,0,W-100),backgroundColor:'rgba(20,20,24,0.97)',borderRadius:12,borderWidth:1,borderColor:'rgba(255,255,255,0.15)',paddingHorizontal:12,paddingVertical:8,shadowColor:'#000',shadowOpacity:0.5,shadowRadius:12}}>
            <Text style={{fontSize:13,fontWeight:'800',color:lc}}>{tooltip.d.v>=0?'+':''}{fc(tooltip.d.v)}</Text>
            <Text style={{fontSize:9,color:'rgba(255,255,255,0.45)',marginTop:1}}>{tooltip.d.date}</Text>
          </View>
        )}
        <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:6}}>
          <Text style={{fontSize:8,color:t.muted}}>{data[0]?.date}</Text>
          <Text style={{fontSize:9,fontWeight:'700',color:lc}}>{lastV>=0?'+':''}{fc(lastV)}</Text>
          <Text style={{fontSize:8,color:t.muted}}>{data[data.length-1]?.date}</Text>
        </View>
      </View>
    );
  };

  return (
    <Card t={t} style={{marginBottom:12}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <Text style={{fontSize:13,fontWeight:'800',color:t.text}}>📈 Performance</Text>
        <Text style={{fontSize:10,color:t.muted}}>Max DD: {fc(maxDD)}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
        <View style={{flexDirection:'row',gap:6}}>
          {tabs.map(([k,l])=>(
            <GlossyPill t={t} key={k} label={l} onPress={()=>{setTab(k);setTooltip(null);}} tone="#0a84ff" active={tab===k} size='sm' />
          ))}
        </View>
      </ScrollView>
      <ChartWithTooltip data={data} height={110}/>
      {!tooltip&&<Text style={{fontSize:9,color:t.muted,textAlign:'center',marginTop:6}}>Tap chart for details</Text>}
    </Card>
  );
}

function DashboardBetListSection({bets, t, onGoToBets}) {
  const [resultFilter, setResultFilter] = useState('all');
  const [sportFilter, setSportFilter] = useState('all');

  const filtered = useMemo(() => bets
    .filter(b => resultFilter === 'all' || b.result === resultFilter)
    .filter(b => sportFilter === 'all' || b.sport === sportFilter)
    .sort((a,b) => new Date(b.date) - new Date(a.date))
  , [bets, resultFilter, sportFilter]);

  const visible = filtered.slice(0, 6);
  const listPL = filtered.reduce((sum, bet) => sum + (bet.profit || 0), 0);

  const resultChips = [
    ['all', 'All'],
    ['pending', 'Pending'],
    ['won', 'Won'],
    ['lost', 'Lost'],
  ];

  const sportChips = [
    ['all', 'All'],
    ['cricket', '🏏'],
    ['football', '⚽'],
    ['tennis', '🎾'],
    ['basketball', '🏀'],
    ['other', '🎲'],
  ];

  return (
    <Card t={t} style={{marginBottom:14}} glowColor='rgba(10,132,255,0.22)'>
      <SectionHead
        title="📋 Bet List"
        sub={`${filtered.length} bets · ${(filtered.length ? fcs(listPL) : 'No bets')}`}
        t={t}
        right={
          <GlossyPill t={t} label="Open full list →" onPress={onGoToBets} tone="#0a84ff" active size='xs' />
        }
      />

      <Text style={{fontSize:9,color:t.muted,marginBottom:8,fontWeight:'800',letterSpacing:1.1,textTransform:'uppercase'}}>Filters</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}} contentContainerStyle={{gap:6,paddingRight:8}}>
        {resultChips.map(([key, label]) => {
          const active = resultFilter === key;
          const color = key === 'won' ? '#30d158' : key === 'lost' ? '#ff453a' : key === 'pending' ? '#ffd60a' : '#0a84ff';
          const count = key === 'all' ? bets.length : bets.filter(b => b.result === key).length;
          return (
            <GlossyPill
              t={t}
              key={key}
              label={label}
              badge={count}
              onPress={() => setResultFilter(key)}
              tone={color}
              active={active}
              size='sm'
            />
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}} contentContainerStyle={{gap:6,paddingRight:8}}>
        {sportChips.map(([key, label]) => {
          const active = sportFilter === key;
          const color = key === 'all' ? '#bf5af2' : (SPORTS[key]?.color || '#bf5af2');
          return (
            <GlossyPill
              t={t}
              key={key}
              label={label}
              onPress={() => setSportFilter(key)}
              tone={color}
              active={active}
              size='sm'
            />
          );
        })}
      </ScrollView>

      {visible.length === 0 ? (
        <View style={{backgroundColor:t.inp,borderRadius:16,padding:18,borderWidth:1,borderColor:t.inpB}}>
          <Text style={{fontSize:12,color:t.sub,fontWeight:'700'}}>No bets match these filters yet.</Text>
          <Text style={{fontSize:10,color:t.muted,marginTop:4}}>Try switching the result or sport chips above.</Text>
        </View>
      ) : visible.map((b, index) => {
        const rc = b.result==='won' ? '#30d158' : b.result==='lost' ? '#ff453a' : b.result==='pending' ? '#ffd60a' : '#636366';
        return (
          <View key={`${b.id}_${index}`} style={{
            flexDirection:'row', alignItems:'center', gap:12,
            backgroundColor:'rgba(255,255,255,0.04)', borderRadius:18,
            borderWidth:1, borderColor:'rgba(255,255,255,0.07)',
            borderLeftWidth:3.5, borderLeftColor:rc,
            padding:12, marginBottom:index === visible.length - 1 ? 0 : 8,
          }}>
            <View style={{width:38,height:38,borderRadius:12,backgroundColor:(SPORTS[b.sport]?.color || '#636366')+'20',justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:(SPORTS[b.sport]?.color || '#636366')+'35'}}>
              <Text style={{fontSize:18}}>{SPORTS[b.sport]?.icon || '🎲'}</Text>
            </View>
            <View style={{flex:1}}>
              <Text style={{fontSize:12,fontWeight:'800',color:t.text,letterSpacing:-0.2}} numberOfLines={1}>{b.match}</Text>
              <Text style={{fontSize:10,color:t.muted,marginTop:2}} numberOfLines={1}>{b.selection} @ <Text style={{fontWeight:'700',color:t.sub}}>{b.odds}</Text> · {b.date}</Text>
            </View>
            <View style={{alignItems:'flex-end',gap:4}}>
              <Text style={{fontSize:13,fontWeight:'900',color:(b.profit||0)>=0?'#30d158':'#ff453a',letterSpacing:-0.3}}>{b.result === 'pending' ? fc(b.stake || 0) : fcs(b.profit || 0)}</Text>
              <View style={{backgroundColor:rc+'20',borderRadius:7,paddingHorizontal:7,paddingVertical:2,borderWidth:1,borderColor:rc+'35'}}>
                <Text style={{fontSize:8.5,color:rc,fontWeight:'800',textTransform:'uppercase',letterSpacing:0.5}}>{b.result}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({bets, t, onAddBet, onQuickAdd, onSettlePending, onGoToBets, onGoToStats}) {
  const stats = useMemo(()=>computeStats(bets),[bets]);
  const {won,lost,tPL,roi,wr,curStreak,runData,maxDD}=stats;
  const pending=bets.filter(b=>b.result==='pending').length;
  const hour=new Date().getHours();
  const greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';

  if(bets.length===0) return (
    <View style={{alignItems:'center',justifyContent:'center',padding:40,flex:1}}>
      <Text style={{fontSize:70,marginBottom:16}}>🏏</Text>
      <Text style={{fontSize:22,fontWeight:'900',color:t.text,marginBottom:8}}>No bets yet</Text>
      <Text style={{fontSize:13,color:t.muted,lineHeight:22,textAlign:'center',marginBottom:24}}>Track your first bet to unlock a clean home view with hero P&L, chart and filtered bet list.</Text>
      <QuickActions onAddBet={onAddBet} onQuickAdd={onQuickAdd} onStats={onGoToStats} onExport={()=>{}} t={t}/>
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <AmbientGlow plC={tPL>=0?'#30d158':'#ff453a'}/>

      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:18,marginTop:6}}>
        <View>
          <Text style={{fontSize:12,color:'rgba(255,255,255,0.32)',fontWeight:'700',letterSpacing:0.5}}>{greeting} 👋</Text>
          <Text style={{fontSize:26,fontWeight:'900',color:t.text,letterSpacing:-1,lineHeight:30}}>BetTracker Pro</Text>
        </View>
        <GlossyPill t={t} label="+ Add Bet" onPress={onAddBet} tone="#0a84ff" active size='md' />
      </View>

      <HeroCard tPL={tPL} roi={roi} wr={wr} won={won} lost={lost} pending={pending} curStreak={curStreak} t={t}/>

      {runData.length>=2 && <ChartTabCard bets={bets} runData={runData} maxDD={maxDD} t={t}/>} 

      <DashboardBetListSection bets={bets} t={t} onGoToBets={onGoToBets}/>

      <PendingReminderCard bets={bets} onSettleTap={onSettlePending} t={t}/>

      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ─── BETS TAB — Premium Redesign ─────────────────────────────────────────────
// Premium BetRow with Dashboard-style slide-in animation
function PremiumBetRowAnim({children, index}) {
  const translateX = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const delay = index * 50;
    Animated.parallel([
      Animated.timing(translateX, {toValue:0, duration:320, delay, useNativeDriver:true}),
      Animated.timing(opacity,    {toValue:1, duration:320, delay, useNativeDriver:true}),
    ]).start();
  }, []);
  return (
    <Animated.View style={{transform:[{translateX}], opacity}}>
      {children}
    </Animated.View>
  );
}

function SwipeBetCard({b, onEdit, onDelete, onDuplicate, onMarkResult, t, index=0}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [swiping, setSwiping] = useState(null); // 'edit' | 'delete' | null

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder:(e,g)=>Math.abs(g.dx)>8&&Math.abs(g.dy)<20,
    onPanResponderMove:(e,g)=>{
      translateX.setValue(clamp(g.dx,-120,120));
      setSwiping(g.dx>20?'edit':g.dx<-20?'delete':null);
    },
    onPanResponderRelease:(e,g)=>{
      if(g.dx>80){Animated.spring(translateX,{toValue:0,useNativeDriver:true}).start();onEdit(b);}
      else if(g.dx<-80){Animated.spring(translateX,{toValue:0,useNativeDriver:true}).start();Alert.alert('Delete bet?','This cannot be undone',[{text:'Cancel'},{text:'Delete',style:'destructive',onPress:()=>onDelete(b.id)}]);}
      else{Animated.spring(translateX,{toValue:0,useNativeDriver:true}).start();setSwiping(null);}
    },
  })).current;

  const rc=b.result==='won'?'#30d158':b.result==='lost'?'#ff453a':b.result==='pending'?'#ffd60a':b.result==='void'?'#636366':'#34aadc';
  const pc=(b.profit||0)>=0?'#30d158':'#ff453a';
  const sport=SPORTS[b.sport]||SPORTS.other;

  return (
    <PremiumBetRowAnim index={index}>
    <View style={{marginBottom:10,borderRadius:20,overflow:'hidden'}}>
      {/* Swipe bg layers */}
      <View style={{position:'absolute',inset:0,flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,borderRadius:20}}>
        <View style={{backgroundColor:'rgba(10,132,255,0.25)',borderRadius:14,paddingHorizontal:14,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:6}}>
          <Text style={{fontSize:18}}>✏️</Text>
          <Text style={{color:'#0a84ff',fontWeight:'800',fontSize:12}}>Edit</Text>
        </View>
        <View style={{backgroundColor:'rgba(255,69,58,0.25)',borderRadius:14,paddingHorizontal:14,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:6}}>
          <Text style={{color:'#ff453a',fontWeight:'800',fontSize:12}}>Delete</Text>
          <Text style={{fontSize:18}}>🗑️</Text>
        </View>
      </View>

      <Animated.View {...panResponder.panHandlers}
        style={{transform:[{translateX}],backgroundColor:t.card,borderRadius:20,borderWidth:1,borderColor:t.cardB,overflow:'hidden',
          shadowColor:'#000',shadowOpacity:0.18,shadowRadius:12,shadowOffset:{width:0,height:4}}}>
        {/* Left accent bar */}
        <View style={{position:'absolute',left:0,top:0,bottom:0,width:4,backgroundColor:rc,borderTopLeftRadius:20,borderBottomLeftRadius:20}}/>

        <View style={{padding:14,paddingLeft:18}}>
          {/* Row 1: Sport icon + Match + Profit badge */}
          <View style={{flexDirection:'row',alignItems:'flex-start',marginBottom:8,gap:10}}>
            <View style={{width:38,height:38,borderRadius:12,backgroundColor:sport.color+'20',justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:sport.color+'35'}}>
              <Text style={{fontSize:20}}>{sport.icon}</Text>
            </View>
            <View style={{flex:1}}>
              <Text style={{fontSize:14,fontWeight:'800',color:t.text,letterSpacing:-0.2}} numberOfLines={1}>{b.match}</Text>
              <Text style={{fontSize:11,color:t.sub,marginTop:2}} numberOfLines={1}>{b.selection} <Text style={{color:'#ffd60a',fontWeight:'700'}}>@ {b.odds}</Text></Text>
            </View>
            <View style={{alignItems:'flex-end',gap:4}}>
              <View style={{backgroundColor:rc+'22',borderRadius:10,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:rc+'44'}}>
                <Text style={{fontSize:10,color:rc,fontWeight:'800',textTransform:'uppercase'}}>{b.result}</Text>
              </View>
              <Text style={{fontSize:14,fontWeight:'900',color:pc}}>{b.result!=='pending'?(fcs(b.profit||0)):'₹'+b.stake}</Text>
            </View>
          </View>

          {/* Row 2: Tags */}
          {b.tags&&b.tags.length>0&&(
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:4,marginBottom:8}}>
              {b.tags.slice(0,4).map(tag=>(
                <View key={tag} style={{backgroundColor:'rgba(191,90,242,0.12)',borderRadius:8,paddingHorizontal:7,paddingVertical:2,borderWidth:1,borderColor:'rgba(191,90,242,0.25)'}}>
                  <Text style={{fontSize:9,color:'#bf5af2',fontWeight:'700'}}>#{tag}</Text>
                </View>
              ))}
              {b.tags.length>4&&<Text style={{fontSize:9,color:t.muted,paddingVertical:2}}>+{b.tags.length-4}</Text>}
            </View>
          )}

          {/* Row 3: Meta + Mark result */}
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <Text style={{fontSize:9,color:t.muted}}>📅 {b.date}</Text>
              {b.bookie&&<Text style={{fontSize:9,color:t.muted}}>· {b.bookie}</Text>}
              {b.livebet&&<View style={{backgroundColor:'rgba(255,69,58,0.15)',borderRadius:6,paddingHorizontal:6,paddingVertical:1}}>
                <Text style={{fontSize:8,color:'#ff453a',fontWeight:'800'}}>LIVE</Text>
              </View>}
              <Stars value={b.confidence||0} size={9} t={t}/>
            </View>
            {b.result==='pending'&&(
              <View style={{flexDirection:'row',gap:5}}>
                <GlossyPill t={t} label="Won" icon="✓" onPress={()=>onMarkResult(b.id,'won')} tone="#30d158" active size='xs' />
                <GlossyPill t={t} label="Lost" icon="✗" onPress={()=>onMarkResult(b.id,'lost')} tone="#ff453a" active size='xs' destructive />
              </View>
            )}
            {b.result!=='pending'&&(
              <View style={{flexDirection:'row',gap:4}}>
                <GlossyPill t={t} icon="✏️" onPress={()=>onEdit(b)} tone="#0a84ff" variant='ghost' size='xs' style={{minWidth:30}} />
                <GlossyPill t={t} icon="📋" onPress={()=>onDuplicate(b)} tone="#bf5af2" variant='ghost' size='xs' style={{minWidth:30}} />
              </View>
            )}
          </View>

          {b.notes&&<View style={{marginTop:7,backgroundColor:t.inp,borderRadius:8,padding:8}}>
            <Text style={{fontSize:10,color:t.sub,fontStyle:'italic'}}>📝 {b.notes}</Text>
          </View>}
        </View>
      </Animated.View>
    </View>
    </PremiumBetRowAnim>
  );
}

function BetsTab({bets, onEdit, onDelete, onDuplicate, onMarkResult, t}) {
  const [filter, setFilter] = useState('all');
  const [sport, setSport]   = useState('all');
  const [sort, setSort]     = useState('date');
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  const allTags = useMemo(()=>[...new Set(bets.flatMap(b=>b.tags||[]))],[bets]);

  const filtered = useMemo(()=>bets
    .filter(b=>filter==='all'||b.result===filter)
    .filter(b=>sport==='all'||b.sport===sport)
    .filter(b=>!tagFilter||(b.tags||[]).includes(tagFilter))
    .filter(b=>!search||[b.match,b.selection,b.bookie||'',b.market].some(v=>v&&v.toLowerCase().includes(search.toLowerCase())))
    .sort((a,b)=>sort==='date'?new Date(b.date)-new Date(a.date):sort==='profit'?(b.profit||0)-(a.profit||0):sort==='odds'?b.odds-a.odds:sort==='stake'?b.stake-a.stake:0)
  ,[bets,filter,sport,sort,search,tagFilter]);

  const totalPL = filtered.reduce((s,b)=>s+(b.profit||0),0);
  const resultColors={'all':'#0a84ff','pending':'#ffd60a','won':'#30d158','lost':'#ff453a','void':'#636366','half-won':'#34aadc','half-lost':'#ff9f0a'};

  return (
    <View style={{flex:1}}>
      {/* Search bar */}
      <View style={{backgroundColor:t.inp,borderRadius:16,borderWidth:1,borderColor:t.inpB,flexDirection:'row',alignItems:'center',paddingHorizontal:14,marginBottom:10}}>
        <Text style={{fontSize:14,marginRight:8}}>🔍</Text>
        <TextInput value={search} onChangeText={setSearch} style={{flex:1,color:t.text,fontSize:13,paddingVertical:12}} placeholder="Search match, pick, bookie..." placeholderTextColor={t.muted}/>
        {search.length>0&&<GlossyPill t={t} icon="✕" onPress={()=>setSearch('')} size='xs' variant='ghost' style={{minWidth:28}} />}
      </View>

      {/* Result filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}} contentContainerStyle={{gap:6,paddingRight:8}}>
        {['all','pending','won','lost','void','half-won','half-lost'].map(f=>{
          const count=f==='all'?bets.length:bets.filter(b=>b.result===f).length;
          const active=filter===f;
          const col=resultColors[f]||'#0a84ff';
          return (
            <GlossyPill
              t={t}
              key={f}
              label={f}
              badge={count}
              onPress={()=>setFilter(f)}
              tone={col}
              active={active}
              size='sm'
              textStyle={{textTransform:'capitalize'}}
            />
          );
        })}
      </ScrollView>

      {/* Sport chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}} contentContainerStyle={{gap:6,paddingRight:8}}>
        {[['all','All ⚽'],['cricket','🏏'],['football','⚽'],['tennis','🎾'],['basketball','🏀'],['other','🎲']].map(([k,l])=>(
          <GlossyPill t={t} key={k} label={l} onPress={()=>setSport(k)} tone="#5e5ce6" active={sport===k} size='sm' />
        ))}
      </ScrollView>

      {/* Tag chips (if any) */}
      {allTags.length>0&&(
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}} contentContainerStyle={{gap:6,paddingRight:8}}>
          <GlossyPill t={t} label="All tags" onPress={()=>setTagFilter('')} tone="#bf5af2" active={!tagFilter} size='sm' />
          {allTags.map(tag=>(
            <GlossyPill t={t} key={tag} label={`#${tag}`} onPress={()=>setTagFilter(tagFilter===tag?'':tag)} tone="#bf5af2" active={tagFilter===tag} size='sm' />
          ))}
        </ScrollView>
      )}

      {/* Sort row + summary */}
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:5}}>
          {[['date','Date'],['profit','P&L'],['odds','Odds'],['stake','Stake']].map(([k,l])=>(
            <GlossyPill t={t} key={k} label={l} onPress={()=>setSort(k)} tone="#ffd60a" active={sort===k} size='xs' />
          ))}
        </ScrollView>
        {filtered.length>0&&<Text style={{fontSize:10,fontWeight:'700',color:totalPL>=0?'#30d158':'#ff453a',marginLeft:8}}>{fcs(totalPL)}</Text>}
      </View>

      {/* Swipe hint */}
      <Text style={{fontSize:9,color:t.muted,textAlign:'center',marginBottom:8}}>← Swipe left to delete  ·  Swipe right to edit →</Text>

      <FlatList data={filtered} keyExtractor={b=>String(b.id)} showsVerticalScrollIndicator={false}
        ListEmptyComponent={<View style={{alignItems:'center',paddingVertical:56}}><Text style={{fontSize:40,marginBottom:10}}>🔍</Text><Text style={{fontSize:13,color:t.muted}}>No bets found</Text></View>}
        renderItem={({item:b, index})=>(
          <SwipeBetCard key={b.id} b={b} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} onMarkResult={onMarkResult} t={t} index={index}/>
        )}
        contentContainerStyle={{paddingBottom:20}}
      />
    </View>
  );
}

// ─── STATS TAB ────────────────────────────────────────────────────────────────
function StatsTab({bets, t}) {
  const [sf, setSf] = useState('all');
  const [section, setSection] = useState('overview');
  const fb = sf==='all'?bets:bets.filter(b=>b.sport===sf);
  const stats = useMemo(()=>computeStats(fb),[fb]);

  const mMap={}, dMap={Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0};
  fb.forEach(b=>{const m=getMon(b.date);if(!mMap[m])mMap[m]=0;mMap[m]+=(b.profit||0);dMap[getDOW(b.date)]+=(b.profit||0);});
  const monthData=Object.entries(mMap).map(([label,value])=>({label,value}));
  const dowData=Object.entries(dMap).map(([label,value])=>({label,value}));

  const oR=[{label:'1.0-1.5',min:1,max:1.5},{label:'1.5-2.0',min:1.5,max:2},{label:'2.0-3.0',min:2,max:3},{label:'3.0-5.0',min:3,max:5},{label:'5.0+',min:5,max:99}];
  const oddsData=oR.map(r=>{const rb=fb.filter(b=>b.odds>=r.min&&b.odds<r.max);const rw=rb.filter(b=>b.result==='won').length;const rs=rb.filter(b=>['won','lost'].includes(b.result)).length;return{label:r.label,value:rb.reduce((s,b)=>s+(b.profit||0),0),count:rb.length,wr:rs>0?(rw/rs)*100:0};});

  const bkMap={};
  fb.forEach(b=>{const bk=b.bookie||'Other';if(!bkMap[bk])bkMap[bk]={pl:0,won:0,total:0,stake:0};bkMap[bk].pl+=(b.profit||0);bkMap[bk].stake+=(b.stake||0);if(['won','lost'].includes(b.result))bkMap[bk].total++;if(b.result==='won')bkMap[bk].won++;});

  // Tag analysis
  const tagMap = {};
  fb.forEach(b=>(b.tags||[]).forEach(tag=>{if(!tagMap[tag])tagMap[tag]={pl:0,count:0,won:0,settled:0};tagMap[tag].pl+=(b.profit||0);tagMap[tag].count++;if(['won','lost'].includes(b.result))tagMap[tag].settled++;if(b.result==='won')tagMap[tag].won++;}));

  // Confidence analysis
  const confMap = {1:{pl:0,c:0,w:0,s:0},2:{pl:0,c:0,w:0,s:0},3:{pl:0,c:0,w:0,s:0},4:{pl:0,c:0,w:0,s:0},5:{pl:0,c:0,w:0,s:0}};
  fb.forEach(b=>{const c=b.confidence||3;if(confMap[c]){confMap[c].pl+=(b.profit||0);confMap[c].c++;if(['won','lost'].includes(b.result)){confMap[c].s++;if(b.result==='won')confMap[c].w++;}}});

  const sections = [['overview','📊'],['bookie','🎰'],['odds','🎲'],['tags','🏷️'],['confidence','⭐']];

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Sport filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>
        <View style={{flexDirection:'row',gap:5}}>
          {[['all','All'],['cricket','🏏'],['football','⚽'],['tennis','🎾'],['basketball','🏀'],['other','🎲']].map(([k,l])=>(
            <GlossyPill t={t} key={k} label={l} onPress={()=>setSf(k)} tone="#0a84ff" active={sf===k} size='sm' />
          ))}
        </View>
      </ScrollView>

      {/* Section tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
        <View style={{flexDirection:'row',gap:5}}>
          {sections.map(([k,l])=>(
            <GlossyPill t={t} key={k} label={`${l} ${k.charAt(0).toUpperCase()+k.slice(1)}`} onPress={()=>setSection(k)} tone="#ffd60a" active={section===k} size='sm' />
          ))}
        </View>
      </ScrollView>

      {section==='overview'&&<>
        {stats.runData.length>=2&&<Card t={t} style={{marginBottom:10}}><SectionHead title="📈 Running P&L" sub={`Max DD: ${fc(stats.maxDD)}`} t={t}/><LineChart data={stats.runData} t={t} height={90}/></Card>}
        <Card t={t} style={{marginBottom:10}}><SectionHead title="📅 Monthly P&L" t={t}/><BarChart data={monthData} labelKey="label" valueKey="value" t={t}/></Card>
        <Card t={t} style={{marginBottom:10}}>
          <SectionHead title="📆 Day of Week" t={t}/>
          <BarChart data={dowData} labelKey="label" valueKey="value" t={t}/>
          {dowData.some(d=>d.value!==0)&&<View style={{flexDirection:'row',gap:12,marginTop:9}}>
            <Text style={{fontSize:10,color:t.sub}}>🏆 Best: <Text style={{color:'#30d158',fontWeight:'700'}}>{dowData.reduce((a,b)=>b.value>a.value?b:a).label}</Text></Text>
            <Text style={{fontSize:10,color:t.sub}}>💀 Worst: <Text style={{color:'#ff453a',fontWeight:'700'}}>{dowData.reduce((a,b)=>b.value<a.value?b:a).label}</Text></Text>
          </View>}
        </Card>
        <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
          <Card t={t} style={{flex:1,marginBottom:0,alignItems:'center'}}>
            <Text style={{fontSize:9,color:t.muted,textTransform:'uppercase',marginBottom:4}}>Avg Stake</Text>
            <Text style={{fontSize:18,fontWeight:'800',color:'#0a84ff'}}>{fc(stats.avgStake)}</Text>
          </Card>
          <Card t={t} style={{flex:1,marginBottom:0,alignItems:'center'}}>
            <Text style={{fontSize:9,color:t.muted,textTransform:'uppercase',marginBottom:4}}>Total Staked</Text>
            <Text style={{fontSize:18,fontWeight:'800',color:'#bf5af2'}}>{fc(stats.tStake)}</Text>
          </Card>
        </View>
      </>}

      {section==='bookie'&&<>
        {Object.keys(bkMap).length===0
          ?<Card t={t}><Text style={{color:t.muted,textAlign:'center',padding:20}}>No bookie data yet</Text></Card>
          :Object.entries(bkMap).sort((a,b)=>b[1].pl-a[1].pl).map(([bk,d])=>{
            const wr=d.total>0?Math.round(d.won/d.total*100):0;
            const roi=d.stake>0?(d.pl/d.stake*100):0;
            return(
              <Card key={bk} t={t} style={{marginBottom:8}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <View>
                    <Text style={{fontSize:14,fontWeight:'800',color:t.text}}>🎰 {bk}</Text>
                    <Text style={{fontSize:9,color:t.muted}}>{d.total} settled · Staked {fc(d.stake)}</Text>
                  </View>
                  <Text style={{fontSize:18,fontWeight:'900',color:d.pl>=0?'#30d158':'#ff453a'}}>{fcs(d.pl)}</Text>
                </View>
                <View style={{flexDirection:'row',gap:7}}>
                  {[['WR',`${wr}%`,'#0a84ff'],['ROI',`${roi.toFixed(1)}%`,roi>=0?'#30d158':'#ff453a'],['Bets',String(d.total),'#ffd60a']].map(([l,v,c])=>(
                    <View key={l} style={{flex:1,backgroundColor:t.inp,borderRadius:10,borderWidth:1,borderColor:t.inpB,padding:8,alignItems:'center'}}>
                      <Text style={{fontSize:8,color:t.muted,marginBottom:2}}>{l}</Text>
                      <Text style={{fontSize:13,fontWeight:'800',color:c}}>{v}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}
      </>}

      {section==='odds'&&<>
        <Card t={t} style={{marginBottom:10}}><SectionHead title="🎲 Odds Range Analysis" t={t}/><BarChart data={oddsData} labelKey="label" valueKey="value" t={t}/></Card>
        {oddsData.filter(d=>d.count>0).map(d=>(
          <Card key={d.label} t={t} style={{marginBottom:8}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <Text style={{fontSize:13,fontWeight:'800',color:t.text}}>Odds {d.label}</Text>
              <Text style={{fontSize:16,fontWeight:'900',color:d.value>=0?'#30d158':'#ff453a'}}>{fcs(d.value)}</Text>
            </View>
            <View style={{flexDirection:'row',gap:7}}>
              {[['Bets',String(d.count),'#0a84ff'],['Win Rate',`${d.wr.toFixed(0)}%`,d.wr>=50?'#30d158':'#ff453a']].map(([l,v,c])=>(
                <View key={l} style={{flex:1,backgroundColor:t.inp,borderRadius:10,borderWidth:1,borderColor:t.inpB,padding:8,alignItems:'center'}}>
                  <Text style={{fontSize:8,color:t.muted,marginBottom:2}}>{l}</Text>
                  <Text style={{fontSize:14,fontWeight:'800',color:c}}>{v}</Text>
                </View>
              ))}
            </View>
          </Card>
        ))}
      </>}

      {section==='tags'&&<>
        {Object.keys(tagMap).length===0
          ?<Card t={t}><Text style={{color:t.muted,textAlign:'center',padding:20}}>No tags added yet</Text></Card>
          :Object.entries(tagMap).sort((a,b)=>b[1].pl-a[1].pl).map(([tag,d])=>{
            const wr=d.settled>0?(d.won/d.settled)*100:0;
            return (
              <Card key={tag} t={t} style={{marginBottom:8}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <Text style={{fontSize:13,fontWeight:'800',color:'#bf5af2'}}>#{tag}</Text>
                  <Text style={{fontSize:16,fontWeight:'900',color:d.pl>=0?'#30d158':'#ff453a'}}>{fcs(d.pl)}</Text>
                </View>
                <View style={{flexDirection:'row',gap:7}}>
                  {[['Total Bets',String(d.count),'#0a84ff'],['Win Rate',`${wr.toFixed(0)}%`,wr>=50?'#30d158':'#ff453a'],['Settled',String(d.settled),'#ffd60a']].map(([l,v,c])=>(
                    <View key={l} style={{flex:1,backgroundColor:t.inp,borderRadius:10,borderWidth:1,borderColor:t.inpB,padding:8,alignItems:'center'}}>
                      <Text style={{fontSize:8,color:t.muted,marginBottom:2}}>{l}</Text>
                      <Text style={{fontSize:13,fontWeight:'800',color:c}}>{v}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}
      </>}

      {section==='confidence'&&<>
        <Card t={t} style={{marginBottom:10}}>
          <SectionHead title="⭐ Confidence Level Analysis" sub="How accurate are your star ratings?" t={t}/>
          {[1,2,3,4,5].map(star=>{
            const d=confMap[star];
            if(d.c===0) return null;
            const wr=d.s>0?(d.w/d.s)*100:0;
            return (
              <View key={star} style={{marginBottom:10}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                    <Stars value={star} size={12}/>
                    <Text style={{fontSize:10,color:t.sub}}>{d.c} bets</Text>
                  </View>
                  <View style={{flexDirection:'row',gap:12}}>
                    <Text style={{fontSize:10,color:wr>=50?'#30d158':'#ff453a',fontWeight:'700'}}>{wr.toFixed(0)}% WR</Text>
                    <Text style={{fontSize:10,color:d.pl>=0?'#30d158':'#ff453a',fontWeight:'700'}}>{fcs(d.pl)}</Text>
                  </View>
                </View>
                <ProgressBar value={wr} max={100} color={wr>=50?'#30d158':'#ff453a'} t={t}/>
              </View>
            );
          })}
        </Card>
      </>}

      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ─── CALENDAR TAB ─────────────────────────────────────────────────────────────
function CalendarTab({bets, t}) {
  const now=new Date();
  const [vd,setVd]=useState({y:now.getFullYear(),m:now.getMonth()});
  const [selDay,setSelDay]=useState(null);
  const fd=new Date(vd.y,vd.m,1).getDay();
  const dim=new Date(vd.y,vd.m+1,0).getDate();
  const mName=new Date(vd.y,vd.m,1).toLocaleString('en-IN',{month:'long',year:'numeric'});
  const dMap={};
  bets.forEach(b=>{const d=new Date(b.date);if(d.getFullYear()===vd.y&&d.getMonth()===vd.m){const k=d.getDate();if(!dMap[k])dMap[k]={pl:0,c:0,won:0,lost:0};dMap[k].pl+=(b.profit||0);dMap[k].c++;if(b.result==='won')dMap[k].won++;if(b.result==='lost')dMap[k].lost++;}});
  const mPL=Object.values(dMap).reduce((s,d)=>s+d.pl,0);
  const mBets=Object.values(dMap).reduce((s,d)=>s+d.c,0);
  const selBets=selDay?bets.filter(b=>{const d=new Date(b.date);return d.getFullYear()===vd.y&&d.getMonth()===vd.m&&d.getDate()===selDay;}):[];
  const todayD=now.getFullYear()===vd.y&&now.getMonth()===vd.m?now.getDate():null;
  const cellW=Math.floor((SW-40)/7)-3;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Card t={t} style={{marginBottom:10}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <TouchableOpacity onPress={()=>setVd(v=>{let m=v.m-1,y=v.y;if(m<0){m=11;y--;}return{y,m};})} style={{backgroundColor:t.inp,borderRadius:10,borderWidth:1,borderColor:t.inpB,paddingHorizontal:14,paddingVertical:8}}>
            <Text style={{color:t.text,fontSize:16}}>‹</Text>
          </TouchableOpacity>
          <View style={{alignItems:'center'}}>
            <Text style={{fontSize:14,fontWeight:'800',color:t.text}}>{mName}</Text>
            <Text style={{fontSize:11,fontWeight:'700',color:mPL>=0?'#30d158':'#ff453a'}}>{fcs(mPL)} · {mBets} bets</Text>
          </View>
          <TouchableOpacity onPress={()=>setVd(v=>{let m=v.m+1,y=v.y;if(m>11){m=0;y++;}return{y,m};})} style={{backgroundColor:t.inp,borderRadius:10,borderWidth:1,borderColor:t.inpB,paddingHorizontal:14,paddingVertical:8}}>
            <Text style={{color:t.text,fontSize:16}}>›</Text>
          </TouchableOpacity>
        </View>
        {/* Month summary */}
        {mBets>0&&<View style={{flexDirection:'row',gap:7,marginBottom:12}}>
          {[['Bets',String(mBets),'#0a84ff'],['Won',String(Object.values(dMap).reduce((s,d)=>s+d.won,0)),'#30d158'],['Lost',String(Object.values(dMap).reduce((s,d)=>s+d.lost,0)),'#ff453a']].map(([l,v,c])=>(
            <View key={l} style={{flex:1,backgroundColor:t.inp,borderRadius:10,borderWidth:1,borderColor:t.inpB,padding:8,alignItems:'center'}}>
              <Text style={{fontSize:8,color:t.muted,marginBottom:2}}>{l}</Text>
              <Text style={{fontSize:14,fontWeight:'800',color:c}}>{v}</Text>
            </View>
          ))}
        </View>}
        <View style={{flexDirection:'row',marginBottom:4}}>
          {['S','M','T','W','T','F','S'].map((d,i)=>(
            <View key={i} style={{width:cellW,alignItems:'center'}}><Text style={{fontSize:9,color:t.muted,fontWeight:'700'}}>{d}</Text></View>
          ))}
        </View>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:2}}>
          {Array(fd).fill(null).map((_,i)=><View key={`e${i}`} style={{width:cellW,height:cellW}}/>)}
          {Array(dim).fill(null).map((_,i)=>{
            const day=i+1, info=dMap[day];
            const isT=todayD===day, isSel=selDay===day;
            const bg=info?(info.pl>0?'rgba(48,209,88,0.2)':info.pl<0?'rgba(255,69,58,0.2)':'rgba(255,214,10,0.14)'):t.inp;
            return(
              <TouchableOpacity key={day} onPress={()=>setSelDay(isSel?null:day)} style={{width:cellW,height:cellW,backgroundColor:bg,borderRadius:8,borderWidth:isSel?2:1,borderColor:isSel?'#0a84ff':isT?t.sub:t.inpB,alignItems:'center',justifyContent:'center'}}>
                <Text style={{fontSize:10,fontWeight:isT?'800':'500',color:isSel?'#0a84ff':t.text}}>{day}</Text>
                {info&&<Text style={{fontSize:7,color:info.pl>=0?'#30d158':'#ff453a',fontWeight:'700'}}>{Math.abs(info.pl)>999?Math.round(info.pl/1000)+'k':Math.round(info.pl)}</Text>}
                {info&&<Text style={{fontSize:7,color:t.muted}}>{info.c}b</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>
      {selDay&&selBets.length>0&&<Card t={t}>
        <SectionHead title={`${selDay} ${mName}`} sub={`${selBets.length} bet(s) · ${fcs(selBets.reduce((s,b)=>s+(b.profit||0),0))}`} t={t}/>
        {selBets.map(b=>{
          const rc=b.result==='won'?'#30d158':b.result==='lost'?'#ff453a':b.result==='pending'?'#ffd60a':'#636366';
          return(
            <View key={b.id} style={{backgroundColor:t.inp,borderRadius:12,borderWidth:1,borderColor:t.inpB,borderLeftWidth:3,borderLeftColor:rc,padding:12,marginBottom:7}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:3}}>
                <Text style={{fontSize:12,fontWeight:'700',color:t.text}}>{SPORTS[b.sport]?.icon||'🎲'} {b.match}</Text>
                <Text style={{fontSize:13,fontWeight:'800',color:(b.profit||0)>=0?'#30d158':'#ff453a'}}>{fcs(b.profit||0)}</Text>
              </View>
              <Text style={{fontSize:10,color:t.sub}}>{b.selection} @ {b.odds} · {fc(b.stake)} · <Text style={{color:rc,fontWeight:'700'}}>{b.result}</Text></Text>
              {b.tags&&b.tags.length>0&&<View style={{flexDirection:'row',gap:4,marginTop:4}}>
                {b.tags.map(tag=><Text key={tag} style={{fontSize:8,color:'#bf5af2'}}>#{tag}</Text>)}
              </View>}
            </View>
          );
        })}
      </Card>}
      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ─── BANKROLL TAB ─────────────────────────────────────────────────────────────
function BankrollTab({bets, t}) {
  const [bankroll,setBankroll]=useState(10000);
  const [target,setTarget]=useState(5000);
  const [dailyLim,setDailyLim]=useState(2000);
  const [weeklyLim,setWeeklyLim]=useState(8000);
  const [editing,setEditing]=useState(false);
  const [showProjection,setShowProjection]=useState(false);

  useEffect(()=>{
    Promise.all([store.get('bankroll',10000),store.get('target',5000),store.get('dailyLim',2000),store.get('weeklyLim',8000)])
      .then(([b,tg,dl,wl])=>{setBankroll(b);setTarget(tg);setDailyLim(dl);setWeeklyLim(wl);});
  },[]);
  useEffect(()=>{store.set('bankroll',bankroll);},[bankroll]);
  useEffect(()=>{store.set('target',target);},[target]);
  useEffect(()=>{store.set('dailyLim',dailyLim);},[dailyLim]);
  useEffect(()=>{store.set('weeklyLim',weeklyLim);},[weeklyLim]);

  const {tPL,wr,avgOdds,maxW,maxL,maxDD,stdDev,kelly,tStake,roi}=useMemo(()=>computeStats(bets),[bets]);
  const cur=bankroll+tPL, growth=(tPL/bankroll)*100;
  const now=new Date();
  const thisMonth=bets.filter(b=>{const d=new Date(b.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
  const mPL=thisMonth.reduce((s,b)=>s+(b.profit||0),0);
  const mPct=clamp((mPL/target)*100,0,100);
  const todayLoss=Math.abs(bets.filter(b=>b.date===today()&&(b.profit||0)<0).reduce((s,b)=>s+(b.profit||0),0));
  const dlPct=clamp((todayLoss/dailyLim)*100,0,100);
  const kellySug=Math.max(0,kelly/100)*cur;
  // Weekly loss
  const weekStart=new Date(); weekStart.setDate(weekStart.getDate()-weekStart.getDay());
  const weeklyLoss=Math.abs(bets.filter(b=>new Date(b.date)>=weekStart&&(b.profit||0)<0).reduce((s,b)=>s+(b.profit||0),0));
  const wlPct=clamp((weeklyLoss/weeklyLim)*100,0,100);

  // Projection: if current ROI continues
  const projMonths=6;
  const monthlyBets=bets.length>0?bets.length/Math.max(1,(new Date()-new Date(bets[bets.length-1]?.date||today()))/2592000000):0;
  const avgMonthlyStake=tStake>0?tStake/Math.max(1,(new Date()-new Date(bets[bets.length-1]?.date||today()))/2592000000):0;
  const projData=Array(projMonths+1).fill(0).map((_,i)=>({label:`M${i}`,v:cur+avgMonthlyStake*(roi/100)*i}));

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Card t={t} style={{marginBottom:10}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
          <View>
            <Text style={{fontSize:9,color:t.muted,textTransform:'uppercase',letterSpacing:0.7,marginBottom:4}}>Current Bankroll</Text>
            <Text style={{fontSize:30,fontWeight:'800',color:tPL>=0?'#30d158':'#ff453a',letterSpacing:-1}}>{fc(cur)}</Text>
            <Text style={{fontSize:11,color:t.sub,marginTop:2}}>Started: {fc(bankroll)} · <Text style={{color:growth>=0?'#30d158':'#ff453a',fontWeight:'700'}}>{growth.toFixed(1)}%</Text></Text>
          </View>
          <TouchableOpacity onPress={()=>setEditing(e=>!e)} style={{backgroundColor:'rgba(10,132,255,0.15)',borderRadius:11,borderWidth:1,borderColor:'rgba(10,132,255,0.3)',paddingHorizontal:14,paddingVertical:8}}>
            <Text style={{color:'#0a84ff',fontSize:11,fontWeight:'700'}}>{editing?'Done':'⚙️ Edit'}</Text>
          </TouchableOpacity>
        </View>
        {editing&&<View style={{gap:8}}>
          {[['Starting Bankroll (₹)',bankroll,setBankroll],['Monthly Target (₹)',target,setTarget],['Daily Loss Limit (₹)',dailyLim,setDailyLim],['Weekly Loss Limit (₹)',weeklyLim,setWeeklyLim]].map(([lbl,val,fn])=>(
            <View key={lbl} style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <Text style={{fontSize:10,color:t.muted,flex:1}}>{lbl}</Text>
              <TextInput value={String(val)} onChangeText={v=>fn(parseFloat(v)||0)} style={[styles.inp(t),{width:120,marginBottom:0}]} keyboardType="decimal-pad"/>
            </View>
          ))}
        </View>}
      </Card>

      {/* Quick stats */}
      <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
        <Card t={t} style={{flex:1,alignItems:'center',marginBottom:0}}><Text style={{fontSize:9,color:t.muted,textTransform:'uppercase',marginBottom:4}}>🏆 Best</Text><Text style={{fontSize:24,fontWeight:'800',color:'#30d158'}}>{maxW}</Text><Text style={{fontSize:8,color:t.muted}}>win streak</Text></Card>
        <Card t={t} style={{flex:1,alignItems:'center',marginBottom:0}}><Text style={{fontSize:9,color:t.muted,textTransform:'uppercase',marginBottom:4}}>💀 Worst</Text><Text style={{fontSize:24,fontWeight:'800',color:'#ff453a'}}>{maxL}</Text><Text style={{fontSize:8,color:t.muted}}>loss streak</Text></Card>
        <Card t={t} style={{flex:1,alignItems:'center',marginBottom:0}}><Text style={{fontSize:9,color:t.muted,textTransform:'uppercase',marginBottom:4}}>📉 Max DD</Text><Text style={{fontSize:14,fontWeight:'800',color:'#ff9f0a'}}>{fc(maxDD)}</Text></Card>
      </View>

      {/* Monthly target */}
      <Card t={t} style={{marginBottom:10}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
          <Text style={{fontSize:12,fontWeight:'700',color:t.text}}>🎯 Monthly Target</Text>
          <Text style={{fontSize:11,color:t.sub}}>{fc(mPL)} / {fc(target)}</Text>
        </View>
        <ProgressBar value={mPL} max={target} color={mPL>=0?'#30d158':'#ff453a'} t={t}/>
        <Text style={{fontSize:10,color:t.muted,marginTop:4}}>{mPct.toFixed(0)}% achieved · {thisMonth.length} bets this month</Text>
      </Card>

      {/* Daily limit */}
      <Card t={t} style={{marginBottom:10}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
          <Text style={{fontSize:12,fontWeight:'700',color:t.text}}>⚠️ Daily Loss Limit</Text>
          <Text style={{fontSize:11,color:dlPct>=80?'#ff453a':t.sub}}>{fc(todayLoss)} / {fc(dailyLim)}</Text>
        </View>
        <ProgressBar value={todayLoss} max={dailyLim} color={dlPct>=80?'#ff453a':dlPct>=50?'#ffd60a':'#30d158'} t={t}/>
        {dlPct>=80&&<Text style={{fontSize:10,color:'#ff453a',fontWeight:'700',marginTop:4}}>🛑 STOP! Daily loss limit almost reached!</Text>}
      </Card>

      {/* Weekly limit */}
      <Card t={t} style={{marginBottom:10}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
          <Text style={{fontSize:12,fontWeight:'700',color:t.text}}>📅 Weekly Loss Limit</Text>
          <Text style={{fontSize:11,color:wlPct>=80?'#ff453a':t.sub}}>{fc(weeklyLoss)} / {fc(weeklyLim)}</Text>
        </View>
        <ProgressBar value={weeklyLoss} max={weeklyLim} color={wlPct>=80?'#ff453a':wlPct>=50?'#ffd60a':'#30d158'} t={t}/>
        {wlPct>=80&&<Text style={{fontSize:10,color:'#ff453a',fontWeight:'700',marginTop:4}}>⚠️ Weekly limit almost reached! Be careful.</Text>}
      </Card>

      {/* Kelly */}
      <Card t={t} style={{marginBottom:10}}>
        <SectionHead title="📐 Kelly Criterion" sub="Optimal bet sizing" t={t}/>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
          {[['Win Rate',pct(wr,0),'#30d158'],['Avg Odds',avgOdds.toFixed(2),'#ffd60a'],['Kelly %',pct(Math.max(0,kelly)),'#0a84ff'],['Suggested',fc(kellySug),'#bf5af2'],['Std Dev',fc(stdDev),'#ff9f0a'],['ROI',pct(roi),'#30d158']].map(([l,v,c])=>(
            <View key={l} style={{flex:1,minWidth:70,backgroundColor:t.inp,borderRadius:12,borderWidth:1,borderColor:t.inpB,padding:10}}>
              <Text style={{fontSize:8,color:t.muted,textTransform:'uppercase',marginBottom:2}}>{l}</Text>
              <Text style={{fontSize:13,fontWeight:'800',color:c}}>{v}</Text>
            </View>
          ))}
        </View>
        <View style={{backgroundColor:'rgba(255,159,10,0.1)',borderRadius:10,borderWidth:1,borderColor:'rgba(255,159,10,0.25)',padding:10,marginTop:10}}>
          <Text style={{fontSize:10,color:'#ff9f0a',lineHeight:16}}>💡 Half-Kelly ({pct(Math.max(0,kelly/2))}) is recommended for safer bankroll management. Current suggested bet: {fc(kellySug/2)}</Text>
        </View>
      </Card>

      {/* Projection */}
      <Card t={t} style={{marginBottom:10}}>
        <TouchableOpacity onPress={()=>setShowProjection(p=>!p)}>
          <SectionHead title="🔮 6-Month Projection" sub={`Based on current ${roi.toFixed(1)}% ROI`} t={t}/>
        </TouchableOpacity>
        {showProjection&&projData.length>=2&&<LineChart data={projData} t={t} height={80}/>}
        {!showProjection&&<Text style={{fontSize:10,color:t.muted}}>Tap to expand projection chart</Text>}
      </Card>

      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ─── CALC TAB ─────────────────────────────────────────────────────────────────
function CalcTab({t}) {
  const [mode,setMode]=useState('back');
  const [stake,setStake]=useState('');
  const [odds,setOdds]=useState('');
  const [prob,setProb]=useState('');
  const [layForm,setLayForm]=useState({lo:'',ls:'',comm:'5'});
  const [legs,setLegs]=useState(['','','']);
  const [hedgeForm,setHedgeForm]=useState({origOdds:'',origStake:'',newOdds:'',comm:'0'});
  const [arbitForm,setArbitForm]=useState({o1:'',o2:'',total:'1000'});

  const bProfit=parseFloat(stake)&&parseFloat(odds)?Math.round(parseFloat(stake)*(parseFloat(odds)-1)):null;
  const lLiab=parseFloat(layForm.lo)&&parseFloat(layForm.ls)?Math.round(parseFloat(layForm.ls)*(parseFloat(layForm.lo)-1)):null;
  const lProfit=parseFloat(layForm.ls)&&parseFloat(layForm.comm)?Math.round(parseFloat(layForm.ls)*(1-parseFloat(layForm.comm)/100)):null;
  const pOdds=legs.reduce((a,o)=>parseFloat(o)?a*parseFloat(o):a,1);
  const pProfit=parseFloat(stake)&&pOdds>1?Math.round(parseFloat(stake)*(pOdds-1)):null;
  const implP=parseFloat(odds)>0?Math.round(100/parseFloat(odds)):null;
  const ev=parseFloat(stake)&&parseFloat(odds)&&parseFloat(prob)?calcEV(parseFloat(odds),parseFloat(stake),parseFloat(prob)):null;
  const beWR=parseFloat(odds)>1?(1/parseFloat(odds)*100).toFixed(1):null;

  // Hedge calc
  const origReturn = parseFloat(hedgeForm.origOdds)&&parseFloat(hedgeForm.origStake)?parseFloat(hedgeForm.origStake)*parseFloat(hedgeForm.origOdds):0;
  const hedgeStake = parseFloat(hedgeForm.newOdds)>1?origReturn/parseFloat(hedgeForm.newOdds):0;
  const hedgeProfit = parseFloat(hedgeForm.newOdds)>1?(hedgeStake*(parseFloat(hedgeForm.newOdds)-1)*(1-parseFloat(hedgeForm.comm||0)/100)):0;
  const hedgeLock = origReturn - parseFloat(hedgeForm.origStake||0) - hedgeStake;

  // Arb calc
  const o1=parseFloat(arbitForm.o1), o2=parseFloat(arbitForm.o2), total=parseFloat(arbitForm.total)||1000;
  const arbPct = o1>0&&o2>0?(1/o1+1/o2)*100:null;
  const s1=o1>0&&o2>0?total*(1/o1)/(1/o1+1/o2):0;
  const s2=total-s1;
  const arbProfit=o1>0&&o2>0?Math.round(s1*o1-total):null;

  const Inp=({value,onChange,placeholder,style})=>(
    <TextInput value={value} onChangeText={onChange} style={[styles.inp(t),style]} placeholder={placeholder} placeholderTextColor={t.muted} keyboardType="decimal-pad"/>
  );

  const calcModes = [['back','🔵 Back'],['lay','🟠 Lay'],['parlay','🔗 Parlay'],['ev','📊 EV'],['breakeven','⚖️ B/E'],['hedge','🔀 Hedge'],['arb','💱 Arb']];

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
        <View style={{flexDirection:'row',gap:5}}>
          {calcModes.map(([m,l])=>(
            <TouchableOpacity key={m} onPress={()=>setMode(m)} style={{backgroundColor:mode===m?'rgba(10,132,255,0.25)':t.inp,borderRadius:11,borderWidth:1,borderColor:mode===m?'rgba(10,132,255,0.5)':t.inpB,paddingHorizontal:12,paddingVertical:8}}>
              <Text style={{color:mode===m?'#0a84ff':t.sub,fontSize:11,fontWeight:'700'}}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <Card t={t}>
        {mode==='back'&&<View>
          <Text style={{fontSize:13,fontWeight:'800',color:t.text,marginBottom:14}}>🔵 Back Bet Calculator</Text>
          <Row><View style={{flex:1,marginRight:6}}><Label t={t}>Stake (₹)</Label><Inp value={stake} onChange={setStake} placeholder="500"/></View>
          <View style={{flex:1,marginLeft:6}}><Label t={t}>Odds</Label><Inp value={odds} onChange={setOdds} placeholder="2.00"/>{implP&&<Text style={{fontSize:9,color:t.muted,marginTop:2}}>Implied: {implP}%</Text>}</View></Row>
          {bProfit!==null&&<View style={{flexDirection:'row',gap:9}}>
            <View style={{flex:1,backgroundColor:'rgba(48,209,88,0.1)',borderRadius:14,borderWidth:1,borderColor:'rgba(48,209,88,0.28)',padding:14,alignItems:'center'}}>
              <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>IF WON</Text>
              <Text style={{fontSize:22,fontWeight:'800',color:'#30d158'}}>+{fc(bProfit)}</Text>
              <Text style={{fontSize:9,color:t.muted}}>Returns {fc(bProfit+parseFloat(stake))}</Text>
            </View>
            <View style={{flex:1,backgroundColor:'rgba(255,69,58,0.1)',borderRadius:14,borderWidth:1,borderColor:'rgba(255,69,58,0.28)',padding:14,alignItems:'center'}}>
              <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>IF LOST</Text>
              <Text style={{fontSize:22,fontWeight:'800',color:'#ff453a'}}>-{fc(parseFloat(stake))}</Text>
              <Text style={{fontSize:9,color:t.muted}}>Net loss</Text>
            </View>
          </View>}
        </View>}

        {mode==='lay'&&<View>
          <Text style={{fontSize:13,fontWeight:'800',color:t.text,marginBottom:14}}>🟠 Lay Bet Calculator</Text>
          <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
            <View style={{flex:1}}><Label t={t}>Lay Odds</Label><Inp value={layForm.lo} onChange={v=>setLayForm({...layForm,lo:v})} placeholder="2.0"/></View>
            <View style={{flex:1}}><Label t={t}>Backer Stake</Label><Inp value={layForm.ls} onChange={v=>setLayForm({...layForm,ls:v})} placeholder="500"/></View>
          </View>
          <Label t={t}>Exchange Commission %</Label>
          <Inp value={layForm.comm} onChange={v=>setLayForm({...layForm,comm:v})} placeholder="5" style={{marginBottom:10}}/>
          {lLiab!==null&&<View style={{flexDirection:'row',gap:9}}>
            <View style={{flex:1,backgroundColor:'rgba(48,209,88,0.1)',borderRadius:14,borderWidth:1,borderColor:'rgba(48,209,88,0.28)',padding:14,alignItems:'center'}}>
              <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>BET LOSES (you win)</Text>
              <Text style={{fontSize:20,fontWeight:'800',color:'#30d158'}}>+{fc(lProfit)}</Text>
            </View>
            <View style={{flex:1,backgroundColor:'rgba(255,69,58,0.1)',borderRadius:14,borderWidth:1,borderColor:'rgba(255,69,58,0.28)',padding:14,alignItems:'center'}}>
              <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>BET WINS (you lose)</Text>
              <Text style={{fontSize:20,fontWeight:'800',color:'#ff453a'}}>-{fc(lLiab)}</Text>
            </View>
          </View>}
        </View>}

        {mode==='parlay'&&<View>
          <Text style={{fontSize:13,fontWeight:'800',color:t.text,marginBottom:14}}>🔗 Parlay / Accumulator</Text>
          <Label t={t}>Total Stake (₹)</Label>
          <Inp value={stake} onChange={setStake} placeholder="500" style={{marginBottom:10}}/>
          {legs.map((o,i)=><View key={i} style={{marginBottom:8}}><Label t={t}>Leg {i+1} Odds</Label><Inp value={o} onChange={v=>{const n=[...legs];n[i]=v;setLegs(n);}}/></View>)}
          <View style={{flexDirection:'row',gap:7,marginBottom:pProfit!==null?12:0}}>
            <TouchableOpacity onPress={()=>setLegs([...legs,''])} style={{flex:1,backgroundColor:'rgba(10,132,255,0.15)',borderRadius:10,borderWidth:1,borderColor:'rgba(10,132,255,0.3)',padding:9,alignItems:'center'}}>
              <Text style={{color:'#0a84ff',fontSize:11,fontWeight:'700'}}>+ Add Leg</Text>
            </TouchableOpacity>
            {legs.length>2&&<TouchableOpacity onPress={()=>setLegs(legs.slice(0,-1))} style={{flex:1,backgroundColor:'rgba(255,69,58,0.15)',borderRadius:10,borderWidth:1,borderColor:'rgba(255,69,58,0.3)',padding:9,alignItems:'center'}}>
              <Text style={{color:'#ff453a',fontSize:11,fontWeight:'700'}}>− Remove</Text>
            </TouchableOpacity>}
          </View>
          {pProfit!==null&&<View style={{backgroundColor:t.inp,borderRadius:14,borderWidth:1,borderColor:t.inpB,padding:14,alignItems:'center'}}>
            <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>COMBINED ODDS: {pOdds.toFixed(2)}</Text>
            <Text style={{fontSize:24,fontWeight:'800',color:'#30d158'}}>+{fc(pProfit)}</Text>
            <Text style={{fontSize:9,color:t.muted}}>Returns {fc(pProfit+parseFloat(stake))}</Text>
          </View>}
        </View>}

        {mode==='ev'&&<View>
          <Text style={{fontSize:13,fontWeight:'800',color:t.text,marginBottom:14}}>📊 Expected Value</Text>
          <Row>
            <View style={{flex:1,marginRight:6}}><Label t={t}>Odds</Label><Inp value={odds} onChange={setOdds} placeholder="2.00"/>{implP&&<Text style={{fontSize:9,color:t.muted,marginTop:2}}>Implied: {implP}%</Text>}</View>
            <View style={{flex:1,marginLeft:6}}><Label t={t}>Stake (₹)</Label><Inp value={stake} onChange={setStake} placeholder="500"/></View>
          </Row>
          <Label t={t}>Your Win Probability %</Label>
          <Inp value={prob} onChange={setProb} placeholder="55" style={{marginBottom:10}}/>
          {ev!==null&&<View>
            <View style={{flexDirection:'row',gap:9,marginBottom:10}}>
              {[['Expected Value',ev>=0?'+'+fc(ev):'-'+fc(Math.abs(ev)),ev>=0?'#30d158':'#ff453a'],['Edge',implP&&prob?((parseFloat(prob)-implP)/implP*100).toFixed(1)+'%':'—','#0a84ff']].map(([l,v,c])=>(
                <View key={l} style={{flex:1,backgroundColor:t.inp,borderRadius:14,borderWidth:1,borderColor:t.inpB,padding:14,alignItems:'center'}}>
                  <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>{l}</Text>
                  <Text style={{fontSize:20,fontWeight:'800',color:c}}>{v}</Text>
                </View>
              ))}
            </View>
            <View style={{backgroundColor:ev>=0?'rgba(48,209,88,0.1)':'rgba(255,69,58,0.1)',borderRadius:10,borderWidth:1,borderColor:ev>=0?'rgba(48,209,88,0.25)':'rgba(255,69,58,0.25)',padding:10}}>
              <Text style={{fontSize:10,color:ev>=0?'#30d158':'#ff453a',fontWeight:'700'}}>{ev>=0?'✅ Positive EV — Good value bet!':'❌ Negative EV — Avoid this bet!'}</Text>
            </View>
          </View>}
        </View>}

        {mode==='breakeven'&&<View>
          <Text style={{fontSize:13,fontWeight:'800',color:t.text,marginBottom:14}}>⚖️ Break-Even Calculator</Text>
          <Row>
            <View style={{flex:1,marginRight:6}}><Label t={t}>Odds</Label><Inp value={odds} onChange={setOdds} placeholder="2.00"/></View>
            <View style={{flex:1,marginLeft:6}}><Label t={t}>Stake (₹)</Label><Inp value={stake} onChange={setStake} placeholder="500"/></View>
          </Row>
          {beWR&&<View>
            <View style={{backgroundColor:t.inp,borderRadius:14,borderWidth:1,borderColor:t.inpB,padding:16,marginBottom:12,alignItems:'center'}}>
              <Text style={{fontSize:10,color:t.muted,marginBottom:4}}>Break-Even Win Rate</Text>
              <Text style={{fontSize:30,fontWeight:'800',color:'#ffd60a'}}>{beWR}%</Text>
              <Text style={{fontSize:10,color:t.muted,textAlign:'center',marginTop:4}}>You must win at least {beWR}% to not lose money</Text>
            </View>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
              {[10,25,50,100,200,500].map(total=>(
                <View key={total} style={{flex:1,minWidth:80,backgroundColor:t.inp,borderRadius:12,borderWidth:1,borderColor:t.inpB,padding:10,alignItems:'center'}}>
                  <Text style={{fontSize:9,color:t.muted}}>{total} bets</Text>
                  <Text style={{fontSize:17,fontWeight:'800',color:'#0a84ff'}}>{Math.ceil(total*parseFloat(beWR)/100)}</Text>
                  <Text style={{fontSize:8,color:t.muted}}>wins needed</Text>
                </View>
              ))}
            </View>
          </View>}
        </View>}

        {mode==='hedge'&&<View>
          <Text style={{fontSize:13,fontWeight:'800',color:t.text,marginBottom:4}}>🔀 Hedge Calculator</Text>
          <Text style={{fontSize:10,color:t.muted,marginBottom:14}}>Lock in profit or minimise loss</Text>
          <Row>
            <View style={{flex:1,marginRight:6}}><Label t={t}>Original Odds</Label><Inp value={hedgeForm.origOdds} onChange={v=>setHedgeForm(f=>({...f,origOdds:v}))} placeholder="3.00"/></View>
            <View style={{flex:1,marginLeft:6}}><Label t={t}>Original Stake</Label><Inp value={hedgeForm.origStake} onChange={v=>setHedgeForm(f=>({...f,origStake:v}))} placeholder="500"/></View>
          </Row>
          <Row>
            <View style={{flex:1,marginRight:6}}><Label t={t}>New/Hedge Odds</Label><Inp value={hedgeForm.newOdds} onChange={v=>setHedgeForm(f=>({...f,newOdds:v}))} placeholder="2.00"/></View>
            <View style={{flex:1,marginLeft:6}}><Label t={t}>Commission %</Label><Inp value={hedgeForm.comm} onChange={v=>setHedgeForm(f=>({...f,comm:v}))} placeholder="0"/></View>
          </Row>
          {parseFloat(hedgeForm.newOdds)>1&&parseFloat(hedgeForm.origOdds)>1&&parseFloat(hedgeForm.origStake)>0&&<View>
            <View style={{backgroundColor:'rgba(10,132,255,0.1)',borderRadius:14,borderWidth:1,borderColor:'rgba(10,132,255,0.28)',padding:14,marginBottom:10}}>
              <Text style={{fontSize:10,color:t.muted,marginBottom:4}}>Hedge Stake Required</Text>
              <Text style={{fontSize:26,fontWeight:'900',color:'#0a84ff'}}>{fc(hedgeStake)}</Text>
            </View>
            <View style={{flexDirection:'row',gap:9}}>
              <View style={{flex:1,backgroundColor:'rgba(48,209,88,0.1)',borderRadius:14,borderWidth:1,borderColor:'rgba(48,209,88,0.28)',padding:14,alignItems:'center'}}>
                <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>LOCKED PROFIT</Text>
                <Text style={{fontSize:20,fontWeight:'800',color:'#30d158'}}>{fcs(hedgeLock)}</Text>
                <Text style={{fontSize:8,color:t.muted}}>guaranteed</Text>
              </View>
              <View style={{flex:1,backgroundColor:'rgba(255,214,10,0.1)',borderRadius:14,borderWidth:1,borderColor:'rgba(255,214,10,0.28)',padding:14,alignItems:'center'}}>
                <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>TOTAL INVESTED</Text>
                <Text style={{fontSize:20,fontWeight:'800',color:'#ffd60a'}}>{fc(parseFloat(hedgeForm.origStake)+hedgeStake)}</Text>
              </View>
            </View>
          </View>}
        </View>}

        {mode==='arb'&&<View>
          <Text style={{fontSize:13,fontWeight:'800',color:t.text,marginBottom:4}}>💱 Arbitrage Calculator</Text>
          <Text style={{fontSize:10,color:t.muted,marginBottom:14}}>Find risk-free profit from odds discrepancies</Text>
          <Row>
            <View style={{flex:1,marginRight:6}}><Label t={t}>Outcome 1 Odds</Label><Inp value={arbitForm.o1} onChange={v=>setArbitForm(f=>({...f,o1:v}))} placeholder="2.10"/></View>
            <View style={{flex:1,marginLeft:6}}><Label t={t}>Outcome 2 Odds</Label><Inp value={arbitForm.o2} onChange={v=>setArbitForm(f=>({...f,o2:v}))} placeholder="2.05"/></View>
          </Row>
          <Label t={t}>Total Investment (₹)</Label>
          <Inp value={arbitForm.total} onChange={v=>setArbitForm(f=>({...f,total:v}))} placeholder="1000"/>
          {arbPct!==null&&<View>
            <View style={{backgroundColor:arbPct<100?'rgba(48,209,88,0.12)':'rgba(255,69,58,0.12)',borderRadius:12,borderWidth:1,borderColor:arbPct<100?'rgba(48,209,88,0.3)':'rgba(255,69,58,0.3)',padding:12,marginBottom:10,alignItems:'center'}}>
              <Text style={{fontSize:9,color:t.muted,marginBottom:4}}>ARBITRAGE %</Text>
              <Text style={{fontSize:28,fontWeight:'900',color:arbPct<100?'#30d158':'#ff453a'}}>{arbPct.toFixed(2)}%</Text>
              <Text style={{fontSize:10,color:arbPct<100?'#30d158':'#ff453a',fontWeight:'700'}}>{arbPct<100?'✅ ARB OPPORTUNITY!':'❌ No arbitrage here'}</Text>
            </View>
            {arbPct<100&&<View style={{flexDirection:'row',gap:9}}>
              <View style={{flex:1,backgroundColor:t.inp,borderRadius:14,borderWidth:1,borderColor:t.inpB,padding:14,alignItems:'center'}}>
                <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>Stake on O1</Text>
                <Text style={{fontSize:18,fontWeight:'800',color:'#0a84ff'}}>{fc(s1)}</Text>
              </View>
              <View style={{flex:1,backgroundColor:t.inp,borderRadius:14,borderWidth:1,borderColor:t.inpB,padding:14,alignItems:'center'}}>
                <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>Stake on O2</Text>
                <Text style={{fontSize:18,fontWeight:'800',color:'#0a84ff'}}>{fc(s2)}</Text>
              </View>
              <View style={{flex:1,backgroundColor:'rgba(48,209,88,0.12)',borderRadius:14,borderWidth:1,borderColor:'rgba(48,209,88,0.3)',padding:14,alignItems:'center'}}>
                <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>Profit</Text>
                <Text style={{fontSize:18,fontWeight:'800',color:'#30d158'}}>+{fc(arbProfit)}</Text>
              </View>
            </View>}
          </View>}
        </View>}
      </Card>
      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ─── REPORT TAB ───────────────────────────────────────────────────────────────
function ReportTab({bets, t, showToast}) {
  const [period,setPeriod]=useState('month');
  const now=new Date();
  const pb=useMemo(()=>{
    if(period==='week'){const s=new Date(now);s.setDate(s.getDate()-7);return bets.filter(b=>new Date(b.date)>=s);}
    if(period==='month'){const s=new Date(now.getFullYear(),now.getMonth(),1);return bets.filter(b=>new Date(b.date)>=s);}
    if(period==='year'){const s=new Date(now.getFullYear(),0,1);return bets.filter(b=>new Date(b.date)>=s);}
    return bets;
  },[period,bets]);
  const settled=pb.filter(b=>['won','lost'].includes(b.result));
  const won=pb.filter(b=>b.result==='won').length;
  const lost=pb.filter(b=>b.result==='lost').length;
  const tPL=pb.reduce((s,b)=>s+(b.profit||0),0);
  const tStake=pb.reduce((s,b)=>s+(b.stake||0),0);
  const roi=tStake>0?(tPL/tStake)*100:0;
  const wr=settled.length>0?(won/settled.length)*100:0;
  const plC=tPL>=0?'#30d158':'#ff453a';
  const labels={week:'This Week',month:'This Month',year:'This Year',all:'All Time'};

  // Detailed by sport
  const sportReport = Object.entries(SPORTS).map(([k,v])=>{
    const sb=pb.filter(b=>b.sport===k);
    const sw=sb.filter(b=>b.result==='won').length;
    const sl=sb.filter(b=>b.result==='lost').length;
    const sp=sb.reduce((s,b)=>s+(b.profit||0),0);
    const ss=sb.reduce((s,b)=>s+(b.stake||0),0);
    return sb.length>0?{...v,key:k,bets:sb.length,won:sw,lost:sl,pl:sp,stake:ss,wr:sl+sw>0?(sw/(sl+sw))*100:0}:null;
  }).filter(Boolean);

  // Bet type breakdown
  const btMap={};
  pb.forEach(b=>{const bt=b.betType||'Single';if(!btMap[bt])btMap[bt]={pl:0,c:0};btMap[bt].pl+=(b.profit||0);btMap[bt].c++;});

  const runData=useMemo(()=>{
    const sorted=[...pb].filter(b=>b.result!=='pending').sort((a,b)=>new Date(a.date)-new Date(b.date));
    let run=0;
    return sorted.map(b=>{run+=(b.profit||0);return{date:b.date.slice(5),v:run};});
  },[pb]);

  const exportReport=async()=>{
    const sportLines = sportReport.map(s=>`  ${s.icon} ${s.name}: ${s.bets} bets, ${s.wr.toFixed(0)}% WR, P&L ₹${Math.round(s.pl)}`).join('\n');
    const txt=[
      `═══════════════════════════════`,
      `🏆 BETTRACKER PRO — ${labels[period].toUpperCase()} REPORT`,
      `Generated: ${new Date().toLocaleString('en-IN')}`,
      `═══════════════════════════════`,
      `📊 SUMMARY`,
      `Total Bets: ${pb.length}`,
      `Won: ${won}  Lost: ${lost}  Pending: ${pb.filter(b=>b.result==='pending').length}`,
      `Win Rate: ${wr.toFixed(1)}%`,
      ``,
      `💰 FINANCIALS`,
      `Total P&L: ${tPL>=0?'+':''}₹${Math.round(tPL)}`,
      `ROI: ${roi.toFixed(1)}%`,
      `Total Staked: ₹${Math.round(tStake)}`,
      ``,
      `🏅 BY SPORT`,
      sportLines,
      `═══════════════════════════════`,
    ].join('\n');
    await Share.share({message:txt,title:`BetTracker Pro — ${labels[period]} Report`});
    showToast('📋 Report shared!','success');
  };

  const exportCSV=async()=>{
    const hdr=['Date','Sport','Match','Market','Selection','BetType','Odds','Stake','Result','PL','Bookie','Confidence','LiveBet','Tags','Notes'];
    const rows=pb.map(b=>[b.date,b.sport,b.match,b.market,b.selection,b.betType||'Single',b.odds,b.stake,b.result,b.profit||0,b.bookie||'',b.confidence||0,b.livebet?'Yes':'No',(b.tags||[]).join('|'),b.notes||'']);
    const csv=[hdr,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    await Share.share({message:csv,title:`BetTracker Pro — ${labels[period]} CSV`});
    showToast('📥 CSV shared!','success');
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Card t={t} style={{marginBottom:10}}>
        <View style={{flexDirection:'row',gap:5,flexWrap:'wrap'}}>
          {[['week','This Week'],['month','This Month'],['year','This Year'],['all','All Time']].map(([k,l])=>(
            <TouchableOpacity key={k} onPress={()=>setPeriod(k)} style={{flex:1,backgroundColor:period===k?'rgba(10,132,255,0.25)':t.inp,borderRadius:11,borderWidth:1,borderColor:period===k?'rgba(10,132,255,0.5)':t.inpB,padding:7,alignItems:'center'}}>
              <Text style={{color:period===k?'#0a84ff':t.sub,fontSize:10,fontWeight:'700'}}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {pb.length===0
        ?<View style={{alignItems:'center',paddingVertical:48}}><Text style={{fontSize:40,marginBottom:10}}>📋</Text><Text style={{color:t.muted}}>No bets in this period</Text></View>
        :<View>
          {/* Main P&L */}
          <View style={{backgroundColor:plC+'18',borderRadius:26,borderWidth:1,borderColor:plC+'35',padding:22,marginBottom:12}}>
            <Text style={{fontSize:9,color:t.muted,letterSpacing:1,textTransform:'uppercase',fontWeight:'700',marginBottom:6}}>📋 {labels[period]} Report</Text>
            <Text style={{fontSize:40,fontWeight:'900',color:plC,letterSpacing:-1,marginBottom:10}}>{tPL>=0?'+':''}{fc(tPL)}</Text>
            <View style={{flexDirection:'row',gap:14,flexWrap:'wrap'}}>
              {[['ROI',`${roi.toFixed(1)}%`,plC],['Win Rate',`${wr.toFixed(0)}%`,'#0a84ff'],['Bets',String(pb.length),t.sub],['Staked',fc(tStake),t.muted],['Won',String(won),'#30d158'],['Lost',String(lost),'#ff453a']].map(([l,v,c])=>(
                <View key={l}><Text style={{fontSize:10,color:t.muted}}>{l} </Text><Text style={{fontSize:12,fontWeight:'700',color:c}}>{v}</Text></View>
              ))}
            </View>
          </View>

          {/* Chart */}
          {runData.length>=2&&<Card t={t} style={{marginBottom:12}}>
            <SectionHead title={`📈 P&L Over ${labels[period]}`} t={t}/>
            <LineChart data={runData} t={t} height={80}/>
          </Card>}

          {/* By sport */}
          {sportReport.length>0&&<Card t={t} style={{marginBottom:12}}>
            <SectionHead title="🏅 By Sport" t={t}/>
            {sportReport.map(s=>(
              <View key={s.key} style={{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:t.inp,borderRadius:12,borderWidth:1,borderColor:t.inpB,padding:10,marginBottom:7}}>
                <Text style={{fontSize:22}}>{s.icon}</Text>
                <View style={{flex:1}}>
                  <Text style={{fontSize:11,fontWeight:'700',color:t.text}}>{s.name}</Text>
                  <Text style={{fontSize:9,color:t.muted}}>{s.bets} bets · {s.wr.toFixed(0)}% WR · Staked {fc(s.stake)}</Text>
                </View>
                <Text style={{fontSize:14,fontWeight:'900',color:s.pl>=0?'#30d158':'#ff453a'}}>{fcs(s.pl)}</Text>
              </View>
            ))}
          </Card>}

          {/* By bet type */}
          {Object.keys(btMap).length>1&&<Card t={t} style={{marginBottom:12}}>
            <SectionHead title="🎯 By Bet Type" t={t}/>
            {Object.entries(btMap).sort((a,b)=>b[1].pl-a[1].pl).map(([bt,d])=>(
              <View key={bt} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',backgroundColor:t.inp,borderRadius:10,borderWidth:1,borderColor:t.inpB,padding:10,marginBottom:6}}>
                <View><Text style={{fontSize:11,fontWeight:'700',color:t.text}}>{bt}</Text><Text style={{fontSize:9,color:t.muted}}>{d.c} bets</Text></View>
                <Text style={{fontSize:13,fontWeight:'800',color:d.pl>=0?'#30d158':'#ff453a'}}>{fcs(d.pl)}</Text>
              </View>
            ))}
          </Card>}

          {/* Export buttons */}
          <View style={{flexDirection:'row',gap:9}}>
            <TouchableOpacity onPress={exportReport} style={{flex:1,backgroundColor:'#0a84ff',borderRadius:16,padding:14,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:8}}>
              <Text style={{fontSize:14}}>📤</Text>
              <Text style={{color:'#fff',fontWeight:'800',fontSize:13}}>Share Report</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={exportCSV} style={{flex:1,backgroundColor:'rgba(48,209,88,0.15)',borderRadius:16,padding:14,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:8,borderWidth:1,borderColor:'rgba(48,209,88,0.3)'}}>
              <Text style={{fontSize:14}}>📥</Text>
              <Text style={{color:'#30d158',fontWeight:'800',fontSize:13}}>Export CSV</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ─── ACHIEVEMENTS TAB ─────────────────────────────────────────────────────────
function AchievementsTab({bets, t}) {
  const earned = useMemo(()=>new Set(ACHIEVEMENTS.filter(a=>a.check(bets)).map(a=>a.id)),[bets]);
  const earnedList = ACHIEVEMENTS.filter(a=>earned.has(a.id));
  const pendingList = ACHIEVEMENTS.filter(a=>!earned.has(a.id));

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={{backgroundColor:'rgba(255,214,10,0.1)',borderRadius:20,borderWidth:1,borderColor:'rgba(255,214,10,0.25)',padding:18,marginBottom:14,alignItems:'center'}}>
        <Text style={{fontSize:40,marginBottom:6}}>🏅</Text>
        <Text style={{fontSize:22,fontWeight:'900',color:'#ffd60a'}}>{earnedList.length} / {ACHIEVEMENTS.length}</Text>
        <Text style={{fontSize:11,color:t.muted}}>Achievements Unlocked</Text>
        <View style={{marginTop:10,width:'100%'}}>
          <ProgressBar value={earnedList.length} max={ACHIEVEMENTS.length} color='#ffd60a' t={t} height={8}/>
        </View>
      </View>

      {/* Earned */}
      {earnedList.length>0&&<>
        <Text style={{fontSize:12,fontWeight:'800',color:'#ffd60a',marginBottom:10}}>🏆 UNLOCKED ({earnedList.length})</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:14}}>
          {earnedList.map(a=>(
            <View key={a.id} style={{backgroundColor:'rgba(255,214,10,0.12)',borderRadius:16,borderWidth:1,borderColor:'rgba(255,214,10,0.3)',padding:14,alignItems:'center',width:(SW-52)/2-5}}>
              <Text style={{fontSize:36,marginBottom:6}}>{a.icon}</Text>
              <Text style={{fontSize:12,fontWeight:'800',color:'#ffd60a',textAlign:'center'}}>{a.name}</Text>
              <Text style={{fontSize:9,color:t.muted,textAlign:'center',marginTop:3}}>{a.desc}</Text>
            </View>
          ))}
        </View>
      </>}

      {/* Pending */}
      {pendingList.length>0&&<>
        <Text style={{fontSize:12,fontWeight:'800',color:t.muted,marginBottom:10}}>🔒 LOCKED ({pendingList.length})</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
          {pendingList.map(a=>(
            <View key={a.id} style={{backgroundColor:t.card,borderRadius:16,borderWidth:1,borderColor:t.cardB,padding:14,alignItems:'center',width:(SW-52)/2-5,opacity:0.5}}>
              <Text style={{fontSize:36,marginBottom:6,filter:'grayscale(1)'}}>🔒</Text>
              <Text style={{fontSize:12,fontWeight:'800',color:t.muted,textAlign:'center'}}>{a.name}</Text>
              <Text style={{fontSize:9,color:t.muted,textAlign:'center',marginTop:3}}>{a.desc}</Text>
            </View>
          ))}
        </View>
      </>}
      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ─── SETTINGS DRAWER ──────────────────────────────────────────────────────────
function Drawer({show, onClose, theme, setTheme, bets, bookies, setBookies, t, showToast, setBets, currency, setCurrency, onShowImport, onShowTemplates, onShowSlip}) {
  const [managingBookies, setManagingBookies] = useState(false);
  const [newBookie, setNewBookie] = useState('');
  const [showDanger, setShowDanger] = useState(false);

  const exportCSV=async()=>{
    const hdr=['Date','Sport','Match','Market','Selection','BetType','Odds','Stake','Result','PL','Bookie','Confidence','LiveBet','Tags','Notes'];
    const rows=bets.map(b=>[b.date,b.sport,b.match,b.market,b.selection,b.betType||'Single',b.odds,b.stake,b.result,b.profit||0,b.bookie||'',b.confidence||0,b.livebet?'Yes':'No',(b.tags||[]).join('|'),b.notes||'']);
    const csv=[hdr,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    await Share.share({message:csv,title:'BetTracker Pro — Bets Export'});
    showToast('📥 CSV exported!','success');
  };

  const exportJSON=async()=>{
    await Share.share({message:JSON.stringify({bets,version:1,exported:new Date().toISOString()}),title:'BetTracker Pro — JSON Backup'});
    showToast('💾 JSON backup shared!','success');
  };

  const clearAllBets=()=>{
    Alert.alert('Delete ALL Bets?','This action cannot be undone. All your betting history will be lost.',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete All',style:'destructive',onPress:()=>{setBets([]);store.set('bets',[]);showToast('🗑️ All bets cleared','error');onClose();}}
    ]);
  };

  const addBookie=()=>{
    const b=newBookie.trim();
    if(!b||bookies.includes(b))return;
    setBookies([...bookies,b]);
    store.set('bookies',[...bookies,b]);
    setNewBookie('');
    showToast('✅ Bookie added!');
  };

  const removeBookie=bk=>{
    const updated=bookies.filter(b=>b!==bk);
    setBookies(updated);
    store.set('bookies',updated);
  };

  const stats = useMemo(()=>computeStats(bets),[bets]);

  return (
    <Modal visible={show} animationType="slide" transparent>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.55)',flexDirection:'row',justifyContent:'flex-end'}}>
        <TouchableOpacity style={{flex:1}} onPress={()=>{setManagingBookies(false);setShowDanger(false);onClose();}}/>
        <View style={{width:'78%',maxWidth:320,backgroundColor:t.bg2,borderLeftWidth:1,borderColor:t.cardB,paddingBottom:40}}>
          <SafeAreaView>
            <View style={{padding:20,borderBottomWidth:1,borderColor:t.cardB}}>
              <Text style={{fontSize:20,fontWeight:'900',color:t.text,marginBottom:4}}>🏆 BetTracker Pro</Text>
              <Text style={{fontSize:11,color:t.muted,marginBottom:10}}>{bets.length} bets · {fcs(stats.tPL)} all time</Text>
              {/* Theme selector */}
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:5}}>
                {Object.entries({amoled:'⚫',dark:'🌙',light:'☀️',forest:'🌿'}).map(([k,icon])=>(
                  <GlossyPill
                    key={k}
                    t={t}
                    icon={icon}
                    label={k}
                    onPress={()=>{setTheme(k);store.set('theme',k);}}
                    tone="#0a84ff"
                    active={theme===k}
                    size='xs'
                    style={{flex:1}}
                    textStyle={{textTransform:'capitalize'}}
                  />
                ))}
              </View>
            </View>

              {/* Currency switcher */}
              <View style={{paddingHorizontal:14,paddingTop:14}}>
                <CurrencySwitcher currency={currency} setCurrency={setCurrency} t={t}/>
              </View>

              <View style={{height:1,backgroundColor:t.cardB,marginHorizontal:14,marginBottom:8}}/>

              {managingBookies ? (
              <ScrollView style={{padding:14}}>
                <GlossyPill t={t} icon="‹" label="Back" onPress={()=>setManagingBookies(false)} tone="#0a84ff" variant='ghost' size='sm' style={{alignSelf:'flex-start',marginBottom:14}} />
                <Text style={{fontSize:14,fontWeight:'800',color:t.text,marginBottom:12}}>⚙️ Manage Bookies</Text>
                <View style={{flexDirection:'row',gap:8,marginBottom:14}}>
                  <TextInput value={newBookie} onChangeText={setNewBookie} style={{flex:1,backgroundColor:t.inp,borderRadius:10,borderWidth:1,borderColor:t.inpB,color:t.text,fontSize:12,padding:9}} placeholder="Add new bookie..." placeholderTextColor={t.muted}/>
                  <GlossyPill t={t} label="Add" onPress={addBookie} tone="#0a84ff" active size='sm' style={{justifyContent:'center'}} />
                </View>
                {bookies.map(bk=>(
                  <View key={bk} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:t.inp,borderRadius:10,borderWidth:1,borderColor:t.inpB,padding:12,marginBottom:7}}>
                    <Text style={{color:t.text,fontSize:13}}>🎰 {bk}</Text>
                    <GlossyPill t={t} icon="✕" onPress={()=>removeBookie(bk)} tone="#ff453a" destructive variant='ghost' size='xs' style={{minWidth:26}} />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <ScrollView style={{padding:12}}>
                {[
                  {icon:'📥',label:'Export CSV',fn:()=>{exportCSV();onClose();}},
                  {icon:'💾',label:'JSON Backup',fn:()=>{exportJSON();onClose();}},
                  {icon:'📤',label:'Import CSV',fn:()=>{onShowImport();onClose();}},
                  {icon:'📋',label:'Bet Templates',fn:()=>{onShowTemplates();onClose();}},
                  {icon:'🎫',label:'Bet Slip',fn:()=>{onShowSlip();onClose();}},
                  {icon:'⚙️',label:'Manage Bookies',fn:()=>setManagingBookies(true)},
                ].map((item,i)=>(
                  <GlossyPill
                    key={i}
                    t={t}
                    icon={item.icon}
                    label={item.label}
                    onPress={item.fn}
                    tone="#0a84ff"
                    variant='ghost'
                    size='md'
                    style={{marginBottom:8}}
                    contentStyle={{justifyContent:'flex-start'}}
                    textStyle={{color:t.sub}}
                  />
                ))}

                {/* Danger zone */}
                <GlossyPill
                  t={t}
                  icon="⚠️"
                  label={`Danger Zone ${showDanger?'▲':'▼'}`}
                  onPress={()=>setShowDanger(p=>!p)}
                  tone="#ff453a"
                  destructive
                  variant='ghost'
                  size='md'
                  style={{marginTop:10,marginBottom:showDanger?8:0}}
                  contentStyle={{justifyContent:'flex-start'}}
                />
                {showDanger&&<GlossyPill t={t} icon="🗑️" label="Delete All Bets" onPress={clearAllBets} tone="#ff453a" destructive active size='md' style={{marginHorizontal:4}} contentStyle={{justifyContent:'flex-start'}} />}

                {/* Stats summary */}
                <View style={{backgroundColor:t.inp,borderRadius:14,borderWidth:1,borderColor:t.inpB,padding:12,marginTop:14}}>
                  <Text style={{fontSize:10,color:t.muted,fontWeight:'700',marginBottom:8}}>📊 QUICK STATS</Text>
                  {[['Total Bets',String(bets.length)],['All-time P&L',fcs(stats.tPL)],['Win Rate',pct(stats.wr,0)],['Best Streak',`${stats.maxW}🔥`]].map(([l,v])=>(
                    <View key={l} style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
                      <Text style={{fontSize:10,color:t.muted}}>{l}</Text>
                      <Text style={{fontSize:10,color:t.text,fontWeight:'700'}}>{v}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

// ─── HELPER COMPONENTS ────────────────────────────────────────────────────────
function Row({children}) { return <View style={{flexDirection:'row',marginBottom:10}}>{children}</View>; }
function Label({t,children}) { return <Text style={{fontSize:9,color:t.muted,marginBottom:4,textTransform:'uppercase',letterSpacing:0.6,fontWeight:'700'}}>{children}</Text>; }

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = {
  inp: t => ({ backgroundColor:t.inp, borderWidth:1, borderColor:t.inpB, borderRadius:11, color:t.text, fontSize:13, padding:10, marginBottom:10 }),
};

// ─── NAV TAB ITEM ─────────────────────────────────────────────────────────────
// ─── SVG ICONS FOR NAV ────────────────────────────────────────────────────────
const NAV_ICONS = {
  'Home': ({color}) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Path d="M4 10.5L12 4L20 10.5V20C20 20.55 19.55 21 19 21H15V15H9V21H5C4.45 21 4 20.55 4 20V10.5Z" fill={color}/>
    </Svg>
  ),
  'Insights': ({color}) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Path d="M4 20V14" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      <Path d="M9 20V8"  stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      <Path d="M14 20V12" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      <Path d="M19 20V5"  stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    </Svg>
  ),
  'Bets': ({color}) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="14" rx="2.5" stroke={color} strokeWidth="1.8" fill="none"/>
      <Path d="M3 9H21" stroke={color} strokeWidth="1.8"/>
      <Path d="M7 13H9M11 13H13M15 13H17" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </Svg>
  ),
  'Profile': ({color}) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8" fill="none"/>
      <Path d="M4 20C4 17 7.58 14 12 14C16.42 14 20 17 20 20" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    </Svg>
  ),
};

function NavTabItem({icon, name, active, onPress, t, accent}) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale,{toValue:0.82,duration:65,useNativeDriver:true}),
      Animated.spring(scale,{toValue:1,tension:340,friction:10,useNativeDriver:true}),
    ]).start();
    onPress();
  };
  const IconComp = NAV_ICONS[name];
  const iconColor = active ? '#fff' : t.muted;
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}
      style={{
        alignItems:'center',justifyContent:'center',flex:1,
        paddingVertical:6, paddingHorizontal:4,
        borderRadius:32,
        minWidth:44,
        backgroundColor: active ? (isLightTheme(t) ? 'rgba(255,255,255,0.22)' : withAlpha(accent, 0.22)) : 'transparent',
        borderWidth: active ? 1 : 0,
        borderColor: active ? 'rgba(255,255,255,0.14)' : 'transparent',
        shadowColor: active ? accent : '#000',
        shadowOpacity: active ? 0.24 : 0,
        shadowRadius: active ? 14 : 0,
        shadowOffset:{width:0,height:6},
        elevation: active ? 8 : 0,
        overflow:'hidden',
      }}>
      <Animated.View style={{alignItems:'center',gap:3,transform:[{scale}],width:'100%'}}>
        {active && <View pointerEvents="none" style={{position:'absolute',top:0,left:'18%',right:'18%',height:1,backgroundColor:'rgba(255,255,255,0.32)',borderRadius:1}}/>}
        {IconComp
          ? <IconComp color={iconColor}/>
          : <Text style={{fontSize:20,lineHeight:24}}>{icon}</Text>
        }
        <Text style={{
          fontSize:9.5,
          color: active ? '#fff' : t.muted,
          fontWeight: active ? '700' : '500',
          letterSpacing:0.2,
        }}>{name}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── core state ──────────────────────────────────────────────────────────────
  const [bets,setBets]           = useState([]);
  const [bookies,setBookies]     = useState(BOOKIES);
  const [tab,setTab]             = useState(0);
  const [theme,setTheme]         = useState('amoled');
  const [currency,setCurrency]   = useState('INR');
  const [loaded,setLoaded]       = useState(false);
  const [unlocked,setUnlocked]   = useState(false);

  // ── modal visibility ────────────────────────────────────────────────────────
  const [showModal,setShowModal]         = useState(false);
  const [showQuick,setShowQuick]         = useState(false);
  const [showDrawer,setShowDrawer]       = useState(false);
  const [showFab,setShowFab]             = useState(false);
  const [showSlip,setShowSlip]           = useState(false);
  const [showImport,setShowImport]       = useState(false);
  const [showTemplates,setShowTemplates] = useState(false);

  // ── other state ─────────────────────────────────────────────────────────────
  const [editBet,setEditBet] = useState(null);
  const [toast,setToast]     = useState(null);
  const [undo,setUndo]       = useState(null);

  // ── bankroll limits (needed for pre-bet warning) ─────────────────────────
  const [dailyLim,setDailyLimApp]   = useState(2000);
  const [weeklyLim,setWeeklyLimApp] = useState(8000);

  const t = THEMES[theme]||THEMES.amoled;

  // ── load everything from storage ────────────────────────────────────────────
  useEffect(()=>{
    Promise.all([
      store.get('bets',[]),
      store.get('bookies',BOOKIES),
      store.get('theme','amoled'),
      store.get('currency','INR'),
      store.get('dailyLim',2000),
      store.get('weeklyLim',8000),
    ]).then(([b,bk,th,cur,dl,wl])=>{
      setBets(b);
      setBookies(bk);
      setTheme(th);
      setCurrency(cur);
      setCurrencyGlobal(cur);
      setDailyLimApp(dl);
      setWeeklyLimApp(wl);
      setLoaded(true);
    });
  },[]);

  useEffect(()=>{if(loaded)store.set('bets',bets);},[bets,loaded]);
  useEffect(()=>{if(loaded)store.set('bookies',bookies);},[bookies,loaded]);
  useEffect(()=>{if(loaded){store.set('theme',theme);}},[theme,loaded]);
  useEffect(()=>{if(loaded){store.set('currency',currency);setCurrencyGlobal(currency);}},[currency,loaded]);

  const showToast=(msg,type='success')=>{setToast(null);setTimeout(()=>setToast({msg,type}),50);};

  // ── bet handlers ────────────────────────────────────────────────────────────
  const handleSave = b => {
    setBets(prev=>editBet
      ? prev.map(x=>x.id===editBet.id?{...b,id:editBet.id}:x)
      : [{...b,id:Date.now()},...prev]);
    setShowModal(false);setEditBet(null);
    showToast(editBet?'✏️ Bet updated!':'✅ Bet added!');
  };
  const handleEdit      = bet=>{setEditBet(bet);setShowModal(true);};
  const handleDuplicate = bet=>{setBets(prev=>[{...bet,id:Date.now(),date:today(),result:'pending',profit:0},...prev]);showToast('📋 Bet duplicated!');};
  const handleDelete    = id=>{
    const bet=bets.find(b=>b.id===id);
    setBets(prev=>prev.filter(b=>b.id!==id));
    if(undo)clearTimeout(undo.timer);
    const timer=setTimeout(()=>setUndo(null),5000);
    setUndo({bet,timer});
  };
  const handleMarkResult = (id,result)=>{
    setBets(prev=>prev.map(b=>{
      if(b.id!==id) return b;
      const profit = result==='won'?Math.round(b.stake*(b.odds-1)):result==='lost'?-b.stake:0;
      return{...b,result,profit};
    }));
    if(result==='won') Vibration.vibrate([0,100,50,100]);
    showToast(result==='won'?'🎉 Marked as WON!':'❌ Marked as LOST',result==='won'?'success':'error');
  };

  // ── daily/weekly loss for pre-bet warning ───────────────────────────────────
  const todayLoss = Math.abs(bets.filter(b=>b.date===today()&&(b.profit||0)<0).reduce((s,b)=>s+(b.profit||0),0));
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate()-weekStart.getDay());
  const weeklyLoss = Math.abs(bets.filter(b=>new Date(b.date)>=weekStart&&(b.profit||0)<0).reduce((s,b)=>s+(b.profit||0),0));
  const showLimitWarning = (todayLoss/dailyLim)>=0.8 || (weeklyLoss/weeklyLim)>=0.8;

  // ── swipe-to-navigate ───────────────────────────────────────────────────────
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_,g)=>Math.abs(g.dx)>14&&Math.abs(g.dy)<40,
    onPanResponderMove: (_,g)=>{ swipeAnim.setValue(g.dx); },
    onPanResponderRelease: (_,g)=>{
      const THRESH=SW*0.28;
      if(g.dx<-THRESH){
        setTab(prev=>{
          const next=Math.min(prev+1,TABS.length-1);
          if(next!==prev){Animated.timing(swipeAnim,{toValue:-SW,duration:180,useNativeDriver:true}).start(()=>swipeAnim.setValue(0));}
          else{Animated.spring(swipeAnim,{toValue:0,tension:200,friction:20,useNativeDriver:true}).start();}
          return next;
        });
      } else if(g.dx>THRESH){
        setTab(prev=>{
          const next=Math.max(prev-1,0);
          if(next!==prev){Animated.timing(swipeAnim,{toValue:SW,duration:180,useNativeDriver:true}).start(()=>swipeAnim.setValue(0));}
          else{Animated.spring(swipeAnim,{toValue:0,tension:200,friction:20,useNativeDriver:true}).start();}
          return next;
        });
      } else {
        Animated.spring(swipeAnim,{toValue:0,tension:200,friction:20,useNativeDriver:true}).start();
      }
    },
  })).current;

  // ── splash / loading screen ─────────────────────────────────────────────────
  if(!loaded) return (
    <View style={{flex:1,backgroundColor:'#000',justifyContent:'center',alignItems:'center'}}>
      <Text style={{fontSize:60,marginBottom:16}}>🏆</Text>
      <Text style={{color:'#fff',fontSize:20,fontWeight:'800'}}>BetTracker Pro</Text>
      <Text style={{color:'rgba(255,255,255,0.4)',fontSize:12,marginTop:6}}>Loading...</Text>
    </View>
  );

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={theme==='light'?'dark-content':'light-content'} backgroundColor={t.bg}/>
      <View style={{flex:1,backgroundColor:t.bg}}>
        <AmbientBackground t={t}/>

        {/* ── PIN Lock overlay ─────────────────────────────────────────── */}
        {!unlocked&&<PINLock onUnlock={()=>setUnlocked(true)} t={t}/>}

        {/* ── Toast ────────────────────────────────────────────────────── */}
        {toast&&<Toast key={toast.msg+Date.now()} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

        {/* ── Pre-Bet Warning Banner ────────────────────────────────────── */}
        {showLimitWarning&&(
          <View style={{position:'absolute',top:0,left:0,right:0,zIndex:8000,paddingTop:60,paddingHorizontal:16}}>
            <PreBetWarningCard
              show={showLimitWarning}
              dailyLim={dailyLim} weeklyLim={weeklyLim}
              todayLoss={todayLoss} weeklyLoss={weeklyLoss}
              t={t}
              onProceed={()=>{setEditBet(null);setShowModal(true);}}
              onCancel={()=>{}}
            />
          </View>
        )}

        {/* ── Undo delete bar ───────────────────────────────────────────── */}
        {undo&&(
          <View style={{position:'absolute',bottom:118,left:16,right:16,zIndex:9000,backgroundColor:'rgba(30,30,40,0.97)',borderRadius:16,borderWidth:1,borderColor:'rgba(255,255,255,0.12)',padding:12,flexDirection:'row',alignItems:'center',gap:10,shadowColor:'#000',shadowOpacity:0.5,shadowRadius:20}}>
            <Text style={{fontSize:12,color:'rgba(255,255,255,0.8)',flex:1}}>🗑️ Bet deleted</Text>
            <TouchableOpacity onPress={()=>{
              clearTimeout(undo.timer);
              setBets(prev=>[...prev,undo.bet].sort((a,b)=>new Date(b.date)-new Date(a.date)));
              setUndo(null);
              showToast('↩️ Bet restored!','success');
            }} style={{backgroundColor:'rgba(10,132,255,0.25)',borderRadius:9,borderWidth:1,borderColor:'rgba(10,132,255,0.4)',paddingHorizontal:14,paddingVertical:6}}>
              <Text style={{color:'#0a84ff',fontSize:12,fontWeight:'700'}}>Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>{clearTimeout(undo.timer);setUndo(null);}} style={{padding:4}}>
              <Text style={{color:'rgba(255,255,255,0.4)',fontSize:14}}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Main content — swipeable ──────────────────────────────────── */}
        <SafeAreaView style={{flex:1}} edges={['top']}>
          <Animated.View
            style={{flex:1,paddingHorizontal:14,paddingBottom:92,transform:[{translateX:swipeAnim}]}}
            {...panResponder.panHandlers}
          >
            {tab===0&&<Dashboard bets={bets} t={t}
              onAddBet={()=>{setEditBet(null);setShowModal(true);}}
              onQuickAdd={()=>setShowQuick(true)}
              onSettlePending={()=>setTab(3)}
              onGoToBets={()=>setTab(3)}
              onGoToStats={()=>setTab(1)}
            />}
            {tab===1&&<StatsTab bets={bets} t={t}/>}
            {tab===2&&<BetsTab bets={bets} onEdit={handleEdit} onDelete={handleDelete} onDuplicate={handleDuplicate} onMarkResult={handleMarkResult} t={t}/>}
            {tab===3&&<BetsTab bets={bets} onEdit={handleEdit} onDelete={handleDelete} onDuplicate={handleDuplicate} onMarkResult={handleMarkResult} t={t}/>}
            {tab===4&&<ProfileTab bets={bets} t={t} theme={theme} setTheme={setTheme} showToast={showToast}/>}
          </Animated.View>
        </SafeAreaView>

        {/* ── FAB backdrop — dark blur overlay ─────────────────────────── */}
        {showFab&&(
          <TouchableOpacity
            style={{
              position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:200,
              overflow:'hidden',
            }}
            activeOpacity={1}
            onPress={()=>setShowFab(false)}
          >
            {BlurView && (
              <BlurView
                style={StyleSheet.absoluteFillObject}
                blurType={getBlurType(t)}
                blurAmount={Platform.OS === 'android' ? 28 : 22}
                reducedTransparencyFallbackColor={t.bg2}
              />
            )}
            <View style={{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.42)'}}/>
          </TouchableOpacity>
        )}

        {/* ── FAB action cards ──────────────────────────────────────────── */}
        {showFab&&(
          <View style={{
            position:'absolute',bottom:108,left:16,right:16,
            zIndex:300,gap:10,
          }}>
            {[
              {icon:'➕',label:'Add Bet',    sub:'Track a new bet',        color:'#30d158', bg:'rgba(48,209,88,0.10)',   border:'rgba(48,209,88,0.25)',   fn:()=>{setEditBet(null);setShowModal(true);setShowFab(false);}},
              {icon:'⚡',label:'Quick Add',  sub:'Fast entry mode',         color:'#0a84ff', bg:'rgba(10,132,255,0.10)',  border:'rgba(10,132,255,0.25)',  fn:()=>{setShowQuick(true);setShowFab(false);}},
              {icon:'🎫',label:'Bet Slip',   sub:'Multi-bet accumulator',   color:'#ffd60a', bg:'rgba(255,214,10,0.10)',  border:'rgba(255,214,10,0.25)',  fn:()=>{setShowSlip(true);setShowFab(false);}},
              {icon:'📋',label:'Templates',  sub:'Use saved templates',     color:'#bf5af2', bg:'rgba(191,90,242,0.10)', border:'rgba(191,90,242,0.25)', fn:()=>{setShowTemplates(true);setShowFab(false);}},
            ].reverse().map((item,i)=>(
              <TouchableOpacity key={i} onPress={item.fn} activeOpacity={0.82}
                style={{
                  flexDirection:'row', alignItems:'center', gap:16,
                  backgroundColor:'rgba(18,18,22,0.96)',
                  borderRadius:22,
                  borderWidth:1,
                  borderColor: item.border,
                  paddingHorizontal:18, paddingVertical:15,
                  shadowColor: item.color,
                  shadowOpacity:0.25,
                  shadowRadius:16,
                  shadowOffset:{width:0,height:6},
                  // subtle left accent border
                  borderLeftWidth:3,
                  borderLeftColor: item.color,
                }}>
                {/* Icon bubble */}
                <View style={{
                  width:48, height:48, borderRadius:15,
                  backgroundColor: item.bg,
                  borderWidth:1, borderColor: item.border,
                  justifyContent:'center', alignItems:'center',
                }}>
                  <Text style={{fontSize:22}}>{item.icon}</Text>
                </View>
                {/* Text */}
                <View style={{flex:1}}>
                  <Text style={{fontSize:15, fontWeight:'800', color:'#fff', letterSpacing:-0.2}}>{item.label}</Text>
                  <Text style={{fontSize:11, color:'rgba(255,255,255,0.38)', marginTop:2, fontWeight:'500'}}>{item.sub}</Text>
                </View>
                {/* Chevron */}
                <Text style={{fontSize:14, color: item.color, fontWeight:'700', opacity:0.8}}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Bottom nav pill — 5 tabs ──────────────────────────────────── */}
        <SafeAreaView edges={['bottom']} style={{position:'absolute',bottom:0,left:0,right:0,zIndex:100}}>
          <View style={{paddingHorizontal:12,paddingBottom:10,paddingTop:6}}>
            <View style={getDepthStyle('nav', isLightTheme(t) ? 'rgba(90,110,255,0.34)' : '#000')}>
              <View style={{borderRadius:44,overflow:'hidden'}}>
                <GlassLayer t={t} surface='nav' borderRadius={44} blurAmount={30} tone={t.accent}/>
                <View pointerEvents="none" style={{position:'absolute',top:0,left:24,right:24,height:1,backgroundColor:isLightTheme(t)?'rgba(255,255,255,0.52)':'rgba(255,255,255,0.16)',zIndex:2}}/>
                <View style={{
                  flexDirection:'row', alignItems:'center', justifyContent:'space-around',
                  paddingVertical:7, paddingHorizontal:6,
                }}>
              {/* Home */}
              <NavTabItem icon="🏠" name="Home" active={tab===0} onPress={()=>setTab(0)} t={t} accent={t.accent}/>

              {/* Insights */}
              <NavTabItem icon="📊" name="Insights" active={tab===1} onPress={()=>setTab(1)} t={t} accent={t.accent}/>

              {/* Center FAB — Add */}
              <View style={{width:56,alignItems:'center',justifyContent:'center'}}>
                <TouchableOpacity
                  onPress={()=>setShowFab(p=>!p)}
                  activeOpacity={0.85}
                  style={{
                    width:50, height:50, borderRadius:25,
                    backgroundColor: showFab ? withAlpha('#ff453a', 0.92) : withAlpha(t.accent, 0.92),
                    justifyContent:'center', alignItems:'center',
                    borderWidth:2.5, borderColor:'rgba(255,255,255,0.2)',
                    overflow:'hidden',
                    ...getDepthStyle('fab', showFab ? '#ff453a' : t.accent),
                  }}
                >
                  <GlassLayer t={t} surface='button' borderRadius={25} blurAmount={18} tone={showFab ? '#ff453a' : t.accent}/>
                  <View pointerEvents="none" style={{position:'absolute',top:3,left:7,right:7,height:10,borderRadius:8,backgroundColor:'rgba(255,255,255,0.26)'}}/>
                  <Text style={{color:'#fff',fontSize:26,fontWeight:'200',lineHeight:30,includeFontPadding:false}}>
                    {showFab ? '✕' : '＋'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Bets */}
              <NavTabItem icon="📋" name="Bets" active={tab===3} onPress={()=>setTab(3)} t={t} accent={t.accent}/>

              {/* Profile */}
              <NavTabItem icon="👤" name="Profile" active={tab===4} onPress={()=>setTab(4)} t={t} accent={t.accent}/>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>

        {/* ── All modals ────────────────────────────────────────────────── */}
        <BetModal
          show={showModal}
          onClose={()=>{setShowModal(false);setEditBet(null);}}
          onSave={handleSave}
          editBet={editBet}
          t={t}
          bookies={bookies}
        />
        <QuickAddModal
          show={showQuick}
          onClose={()=>setShowQuick(false)}
          onSave={b=>{setBets(prev=>[b,...prev]);setShowQuick(false);showToast('⚡ Bet added!');}}
          t={t}
          bookies={bookies}
        />
        <BetSlipModal
          show={showSlip}
          onClose={()=>setShowSlip(false)}
          t={t}
          bookies={bookies}
          onSaveAll={b=>{setBets(prev=>[{...b,id:Date.now()+Math.random()},...prev]);showToast('🎫 Slip bet added!');}}
        />
        <CSVImportModal
          show={showImport}
          onClose={()=>setShowImport(false)}
          onImport={imported=>{setBets(prev=>[...imported,...prev]);showToast(`📥 ${imported.length} bets imported!`);}}
          t={t}
        />
        <TemplatesModal
          show={showTemplates}
          onClose={()=>setShowTemplates(false)}
          onApply={tmpl=>{
            setEditBet(null);
            setShowModal(true);
            // pass template as pre-fill via editBet shape
            setTimeout(()=>setEditBet({
              id:null,
              date:today(),
              sport:tmpl.sport||'cricket',
              match:tmpl.match||'',
              market:tmpl.market||SPORTS[tmpl.sport||'cricket']?.markets[0]||'Match Winner',
              selection:tmpl.selection||'',
              odds:parseFloat(tmpl.odds)||2.0,
              stake:parseFloat(tmpl.stake)||100,
              result:'pending',profit:0,
              bookie:'',confidence:tmpl.confidence||3,
              livebet:false,betType:tmpl.betType||'Single',
              tags:tmpl.tags||[],notes:'',estWinProb:0,
              _isTemplate:true,
            }),80);
          }}
          t={t}
        />
        <Drawer
          show={showDrawer}
          onClose={()=>setShowDrawer(false)}
          theme={theme} setTheme={setTheme}
          bets={bets} bookies={bookies} setBookies={setBookies}
          t={t} showToast={showToast} setBets={setBets}
          currency={currency} setCurrency={setCurrency}
          onShowImport={()=>setShowImport(true)}
          onShowTemplates={()=>setShowTemplates(true)}
          onShowSlip={()=>setShowSlip(true)}
        />
      </View>
    </SafeAreaProvider>
  );
}
