import { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Platform,
  SafeAreaView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

const { height } = Dimensions.get('window');

function SplashScreen({ onFinish }) {
  const logoScale    = useRef(new Animated.Value(0.55)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const glowScale    = useRef(new Animated.Value(0.4)).current;
  const glowOpacity  = useRef(new Animated.Value(0)).current;
  const titleY       = useRef(new Animated.Value(18)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const tagY         = useRef(new Animated.Value(12)).current;
  const tagOpacity   = useRef(new Animated.Value(0)).current;
  const dotsOpacity  = useRef(new Animated.Value(0)).current;
  const ring1Scale   = useRef(new Animated.Value(0.6)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring2Scale   = useRef(new Animated.Value(0.5)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;
  const slideY       = useRef(new Animated.Value(0)).current;
  const exitOpacity  = useRef(new Animated.Value(1)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const sp = (v, to, d=0, t=80, f=9) =>
      Animated.spring(v, { toValue:to, tension:t, friction:f, delay:d, useNativeDriver:true });
    const ea = (v, to, dur=420, d=0, e=Easing.out(Easing.cubic)) =>
      Animated.timing(v, { toValue:to, duration:dur, delay:d, easing:e, useNativeDriver:true });

    Animated.sequence([
      Animated.parallel([
        ea(glowOpacity,0.55,600,0), sp(glowScale,1.15,0,40,12),
        ea(logoOpacity,1,400,80),   sp(logoScale,1,80,90,10),
        ea(ring1Opacity,0.22,500,120), sp(ring1Scale,1.4,120,30,14),
        ea(ring2Opacity,0.12,600,200), sp(ring2Scale,1.9,200,25,16),
      ]),
      Animated.parallel([
        ea(titleOpacity,1,320,0), sp(titleY,0,0,90,11),
        ea(tagOpacity,1,320,100), sp(tagY,0,100,90,11),
        ea(dotsOpacity,1,280,180),
      ]),
      Animated.delay(900),
      Animated.parallel([
        ea(slideY,-height*0.06,480,0,Easing.inOut(Easing.cubic)),
        ea(exitOpacity,0,400,80,Easing.in(Easing.cubic)),
      ]),
    ]).start(() => onFinish());

    const pulse = (dot, delay) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(dot,{toValue:1,duration:340,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      Animated.timing(dot,{toValue:0.3,duration:340,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
    ])).start();
    setTimeout(() => { pulse(dot1,0); pulse(dot2,180); pulse(dot3,360); }, 1200);
  }, []);

  return (
    <Animated.View style={[styles.splash, { opacity:exitOpacity, transform:[{translateY:slideY}] }]}>
      <View style={styles.orb1} /><View style={styles.orb2} /><View style={styles.orb3} />
      <Animated.View style={[styles.ring,{width:240,height:240,borderRadius:120,opacity:ring1Opacity,transform:[{scale:ring1Scale}]}]} />
      <Animated.View style={[styles.ring,{width:340,height:340,borderRadius:170,opacity:ring2Opacity,transform:[{scale:ring2Scale}]}]} />
      <Animated.View style={[styles.glow,{opacity:glowOpacity,transform:[{scale:glowScale}]}]} />
      <Animated.View style={[styles.logoWrap,{opacity:logoOpacity,transform:[{scale:logoScale}]}]}>
        <Text style={styles.logoEmoji}>🏆</Text>
      </Animated.View>
      <Animated.Text style={[styles.splashTitle,{opacity:titleOpacity,transform:[{translateY:titleY}]}]}>
        BetTracker Pro
      </Animated.Text>
      <Animated.Text style={[styles.splashTag,{opacity:tagOpacity,transform:[{translateY:tagY}]}]}>
        Smart · Fast · Disciplined
      </Animated.Text>
      <Animated.View style={[styles.dotsRow,{opacity:dotsOpacity}]}>
        {[dot1,dot2,dot3].map((d,i) => <Animated.View key={i} style={[styles.dot,{opacity:d}]} />)}
      </Animated.View>
    </Animated.View>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [html, setHtml] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // Load the asset (now 3MB with React inlined)
        const asset = Asset.fromModule(require('./assets/index.html'));
        await asset.downloadAsync();
        // Read as string and pass directly — no file:// URI issues
        const content = await FileSystem.readAsStringAsync(asset.localUri);
        setHtml(content);
      } catch(e) {
        console.error('Load error:', e);
      }
    })();
  }, []);

  if (Platform.OS === 'web') {
    return <View style={styles.root}><Text style={{color:'#fff'}}>BetTracker Pro</Text></View>;
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.container}>
        {html ? (
          <WebView
            source={{ html, baseUrl: '' }}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            mixedContentMode="always"
            startInLoadingState={false}
            style={{ flex:1, backgroundColor:'#000' }}
          />
        ) : (
          <View style={styles.container} />
        )}
      </SafeAreaView>
      {!splashDone && <SplashScreen onFinish={() => setSplashDone(true)} />}
    </View>
  );
}

const BLUE = '#0a84ff';
const styles = StyleSheet.create({
  root:      { flex:1, backgroundColor:'#000' },
  container: { flex:1, backgroundColor:'#000' },
  splash: { ...StyleSheet.absoluteFillObject, backgroundColor:'#000', alignItems:'center', justifyContent:'center', zIndex:999 },
  orb1: { position:'absolute', top:-60, left:-60, width:300, height:300, borderRadius:150, backgroundColor:'rgba(10,132,255,0.12)' },
  orb2: { position:'absolute', bottom:80, right:-80, width:260, height:260, borderRadius:130, backgroundColor:'rgba(48,209,88,0.08)' },
  orb3: { position:'absolute', top:height*0.55, left:'20%', width:200, height:200, borderRadius:100, backgroundColor:'rgba(191,90,242,0.06)' },
  ring: { position:'absolute', borderWidth:1, borderColor:'rgba(10,132,255,0.35)' },
  glow: { position:'absolute', width:180, height:180, borderRadius:90, backgroundColor:'rgba(10,132,255,0.18)' },
  logoWrap: { width:100, height:100, borderRadius:28, backgroundColor:'rgba(255,255,255,0.06)', borderWidth:1, borderColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center', marginBottom:28, shadowColor:BLUE, shadowOffset:{width:0,height:0}, shadowOpacity:0.6, shadowRadius:28, elevation:20 },
  logoEmoji:   { fontSize:52 },
  splashTitle: { fontSize:30, fontWeight:'800', color:'#fff', letterSpacing:-0.8, marginBottom:8 },
  splashTag:   { fontSize:13, fontWeight:'500', color:'rgba(255,255,255,0.42)', letterSpacing:1.4, textTransform:'uppercase', marginBottom:52 },
  dotsRow: { flexDirection:'row', gap:8, position:'absolute', bottom:72 },
  dot:     { width:6, height:6, borderRadius:3, backgroundColor:BLUE },
});
