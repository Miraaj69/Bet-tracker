import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, Alert, Dimensions, Platform,
  StatusBar, FlatList, Share, Animated, Vibration, PanResponder
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Polygon, Line, Circle, Rect, Defs, LinearGradient, Stop, Path, Text as SvgText } from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── THEMES ──────────────────────────────────────────────────────────────────
const THEMES = {
  amoled: { bg:'#000', bg2:'#080808', card:'rgba(255,255,255,0.06)', cardB:'rgba(255,255,255,0.09)', text:'#fff', sub:'rgba(255,255,255,0.52)', muted:'rgba(255,255,255,0.28)', inp:'rgba(255,255,255,0.07)', inpB:'rgba(255,255,255,0.14)', nav:'rgba(0,0,0,0.97)', accent:'#0a84ff' },
  dark:   { bg:'#0c0c1e', bg2:'#1a1a2e', card:'rgba(255,255,255,0.07)', cardB:'rgba(255,255,255,0.11)', text:'#fff', sub:'rgba(255,255,255,0.52)', muted:'rgba(255,255,255,0.3)', inp:'rgba(255,255,255,0.09)', inpB:'rgba(255,255,255,0.14)', nav:'rgba(8,8,20,0.97)', accent:'#5e5ce6' },
  light:  { bg:'#eef2ff', bg2:'#fff', card:'rgba(255,255,255,0.82)', cardB:'rgba(0,0,0,0.07)', text:'#08081a', sub:'rgba(0,0,0,0.52)', muted:'rgba(0,0,0,0.33)', inp:'rgba(0,0,0,0.045)', inpB:'rgba(0,0,0,0.1)', nav:'rgba(232,238,255,0.97)', accent:'#0a84ff' },
  forest: { bg:'#0a1a0f', bg2:'#0f2318', card:'rgba(48,209,88,0.07)', cardB:'rgba(48,209,88,0.14)', text:'#e8ffe8', sub:'rgba(200,255,200,0.52)', muted:'rgba(150,210,150,0.35)', inp:'rgba(48,209,88,0.07)', inpB:'rgba(48,209,88,0.18)', nav:'rgba(8,22,12,0.97)', accent:'#30d158' },
};

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
    <Animated.View style={[{transform:[{scale}]}, style]}>
      <TouchableOpacity
        onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}
        activeOpacity={1} disabled={!onPress}
        style={{
          backgroundColor: t.card,
          borderRadius:22, borderWidth:1, borderColor: t.cardB,
          padding:16, marginBottom:10,
          shadowColor: glowColor || '#000',
          shadowOpacity: glowColor ? 0.18 : 0.1,
          shadowRadius: glowColor ? 18 : 8,
          shadowOffset:{width:0,height:4},
        }}
      >
        {children}
      </TouchableOpacity>
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
      backgroundColor:t.card, borderRadius:20, borderWidth:1, borderColor:t.cardB,
      padding:14, flex:1, marginHorizontal:3,
      shadowColor:color, shadowOpacity:0.14, shadowRadius:14, shadowOffset:{width:0,height:4},
    }}>
      <Text style={{position:'absolute',top:-4,right:4,fontSize:36,opacity:0.06}}>{icon}</Text>
      <Text style={{fontSize:9,color:t.muted,letterSpacing:1,textTransform:'uppercase',marginBottom:6,fontWeight:'800'}}>{label}</Text>
      <Text style={{fontSize:22,fontWeight:'900',color,letterSpacing:-0.5}}>{value}</Text>
      {sub && <Text style={{fontSize:10,color:t.sub,marginTop:4}}>{sub}</Text>}
      <View style={{position:'absolute',bottom:0,left:0,right:0,height:3,backgroundColor:color,opacity:0.5,borderBottomLeftRadius:20,borderBottomRightRadius:20}}/>
    </View>
  );
}

function Stars({value, onChange, size=14}) {
  return (
    <View style={{flexDirection:'row',gap:3}}>
      {[1,2,3,4,5].map(i=>(
        <TouchableOpacity key={i} onPress={()=>onChange&&onChange(i===value?0:i)}>
          <Text style={{fontSize:size,color:'#ffd60a',opacity:i<=value?1:0.22}}>★</Text>
        </TouchableOpacity>
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
    <TouchableOpacity onPress={onPress} style={{backgroundColor:selected?c+'30':t.inp,borderRadius:20,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:selected?c+'60':t.inpB,marginRight:5,marginBottom:5}}>
      <Text style={{color:selected?c:t.muted,fontSize:10,fontWeight:'700'}}>{tag}</Text>
    </TouchableOpacity>
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
        <View style={{backgroundColor:t.bg2,borderTopLeftRadius:28,borderTopRightRadius:28,maxHeight:'95%'}}>

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
              <TouchableOpacity onPress={()=>setStep(s=>s-1)} style={{flex:1,backgroundColor:t.inp,borderRadius:14,padding:14,alignItems:'center'}}>
                <Text style={{color:t.sub,fontWeight:'700',fontSize:13}}>← Back</Text>
              </TouchableOpacity>
            )}
            {(!STEPS||step===STEPS.length-1)?(
              <TouchableOpacity onPress={handleSave} style={{flex:2,backgroundColor:sport.color,borderRadius:14,padding:14,alignItems:'center'}}>
                <Text style={{color:'#fff',fontWeight:'800',fontSize:14}}>{editBet?'Save Changes':`Add ${sport.icon} Bet`}</Text>
              </TouchableOpacity>
            ):(
              <TouchableOpacity onPress={()=>{if(canNext())setStep(s=>s+1);}} style={{flex:2,backgroundColor:canNext()?sport.color:'rgba(255,255,255,0.08)',borderRadius:14,padding:14,alignItems:'center'}}>
                <Text style={{color:canNext()?'#fff':t.muted,fontWeight:'800',fontSize:14}}>Continue →</Text>
              </TouchableOpacity>
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
        <View style={{backgroundColor:t.bg2,borderTopLeftRadius:26,borderTopRightRadius:26,padding:22,paddingBottom:36}}>
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
          <TouchableOpacity onPress={()=>{
            if(!form.match||!form.odds||!form.stake){Alert.alert('Missing','Match, Odds & Stake required');return;}
            onSave({id:Date.now(),date:today(),sport:form.sport,match:form.match,market:SPORTS[form.sport].markets[0],selection:form.selection||form.match,odds:parseFloat(form.odds),stake:parseFloat(form.stake),result:'pending',profit:0,bookie:form.bookie,notes:'',confidence:form.confidence||3,livebet:form.livebet||false,betType:'Single',estWinProb:0,tags:[]});
            onClose();
          }} style={{backgroundColor:'#0a84ff',borderRadius:14,padding:14,alignItems:'center'}}>
            <Text style={{color:'#fff',fontWeight:'800',fontSize:14}}>⚡ Add Instantly</Text>
          </TouchableOpacity>
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
        <Animated.View style={{transform:[{translateY:slideAnim}],backgroundColor:t.bg2,borderTopLeftRadius:28,borderTopRightRadius:28,borderWidth:1,borderColor:t.cardB,paddingHorizontal:20,paddingBottom:40,maxHeight:'85%'}}>
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
                  <TouchableOpacity onPress={()=>setAdding(false)} style={{flex:1,backgroundColor:t.inp,borderRadius:10,padding:10,alignItems:'center'}}><Text style={{color:t.muted,fontWeight:'700'}}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={addToSlip} style={{flex:2,backgroundColor:'#0a84ff',borderRadius:10,padding:10,alignItems:'center'}}><Text style={{color:'#fff',fontWeight:'800'}}>Add to Slip ✓</Text></TouchableOpacity>
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
              <TouchableOpacity onPress={()=>{
                slipBets.forEach(b=>{
                  onSaveAll({id:Date.now()+Math.random(),date:today(),sport:b.sport,match:b.match||'Slip Bet',market:SPORTS[b.sport]?.markets[0]||'Winner',selection:b.selection,odds:b.odds,stake:parseFloat(totalStake)/slipBets.length,result:'pending',profit:0,bookie:bookies[0]||'',confidence:3,livebet:false,betType:'Single',tags:['Slip'],notes:'From bet slip'});
                });
                setSlipBets([]);onClose();
              }} style={{backgroundColor:'#30d158',borderRadius:16,padding:16,alignItems:'center'}}>
                <Text style={{color:'#fff',fontWeight:'900',fontSize:15}}>🎫 Place All {slipBets.length} Bets</Text>
              </TouchableOpacity>
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
        <Animated.View style={{transform:[{translateY:slideAnim}],backgroundColor:t.bg2,borderTopLeftRadius:28,borderTopRightRadius:28,borderWidth:1,borderColor:t.cardB,padding:20,paddingBottom:40,maxHeight:'90%'}}>
          <View style={{width:44,height:4,backgroundColor:t.muted,borderRadius:2,alignSelf:'center',marginBottom:16,opacity:0.4}}/>
          <Text style={{fontSize:18,fontWeight:'900',color:t.text,marginBottom:4}}>📥 Import CSV</Text>
          <Text style={{fontSize:10,color:t.muted,marginBottom:14}}>Paste CSV data below. Columns: date, sport, match, selection, odds, stake, result, bookie, tags</Text>
          <TextInput value={csvText} onChangeText={setCsvText} style={[styles.inp(t),{height:110,textAlignVertical:'top',fontFamily:Platform.OS==='ios'?'Courier':'monospace',fontSize:11}]} placeholder={`date,sport,match,selection,odds,stake,result,bookie\n2024-01-15,cricket,MI vs CSK,CSK,1.85,500,won,Betfair`} placeholderTextColor={t.muted} multiline/>
          {error&&<Text style={{color:'#ff453a',fontSize:11,marginBottom:8}}>⚠️ {error}</Text>}
          <View style={{flexDirection:'row',gap:8,marginBottom:14}}>
            <TouchableOpacity onPress={parseCSV} style={{flex:1,backgroundColor:'rgba(10,132,255,0.2)',borderRadius:12,borderWidth:1,borderColor:'rgba(10,132,255,0.4)',padding:12,alignItems:'center'}}>
              <Text style={{color:'#0a84ff',fontWeight:'800'}}>Preview ({preview.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{flex:1,backgroundColor:t.inp,borderRadius:12,borderWidth:1,borderColor:t.inpB,padding:12,alignItems:'center'}}>
              <Text style={{color:t.muted,fontWeight:'700'}}>Cancel</Text>
            </TouchableOpacity>
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
              <TouchableOpacity onPress={()=>{onImport(preview);setPreview([]);setCsvText('');onClose();}} style={{backgroundColor:'#30d158',borderRadius:16,padding:14,alignItems:'center',marginTop:8}}>
                <Text style={{color:'#fff',fontWeight:'900',fontSize:14}}>📥 Import {preview.length} Bets</Text>
              </TouchableOpacity>
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
            <TouchableOpacity onPress={addTipster} style={{backgroundColor:'#0a84ff',borderRadius:12,padding:12,alignItems:'center'}}><Text style={{color:'#fff',fontWeight:'800'}}>Add Tipster</Text></TouchableOpacity>
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
        <TouchableOpacity onPress={onCancel} style={{flex:1,backgroundColor:t.inp,borderRadius:12,padding:12,alignItems:'center'}}><Text style={{color:t.sub,fontWeight:'700'}}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity onPress={onProceed} style={{flex:2,backgroundColor:'#ff9f0a',borderRadius:12,padding:12,alignItems:'center'}}><Text style={{color:'#fff',fontWeight:'900'}}>Proceed Anyway</Text></TouchableOpacity>
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
            <TouchableOpacity onPress={()=>setShowAdd(false)} style={{flex:1,backgroundColor:t.inp,borderRadius:12,padding:12,alignItems:'center'}}><Text style={{color:t.muted,fontWeight:'700'}}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={addGoal} style={{flex:2,backgroundColor:'#30d158',borderRadius:12,padding:12,alignItems:'center'}}><Text style={{color:'#fff',fontWeight:'900'}}>Set Goal 🎯</Text></TouchableOpacity>
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
        <Animated.View style={{transform:[{translateY:slideAnim}],backgroundColor:t.bg2,borderTopLeftRadius:28,borderTopRightRadius:28,borderWidth:1,borderColor:t.cardB,padding:20,paddingBottom:40,maxHeight:'85%'}}>
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
              <TouchableOpacity onPress={saveTemplate} style={{backgroundColor:'#0a84ff',borderRadius:12,padding:12,alignItems:'center',marginTop:4}}><Text style={{color:'#fff',fontWeight:'800'}}>Save Template</Text></TouchableOpacity>
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
                <TouchableOpacity onPress={()=>{onApply(tmpl);onClose();}} style={{backgroundColor:'rgba(10,132,255,0.15)',borderRadius:10,borderWidth:1,borderColor:'rgba(10,132,255,0.3)',padding:9,alignItems:'center',marginTop:8}}><Text style={{color:'#0a84ff',fontWeight:'800',fontSize:12}}>⚡ Use Template</Text></TouchableOpacity>
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
            <TouchableOpacity key={k} onPress={()=>{setCurrency(k);setCurrencyGlobal(k);store.set('currency',k);}} style={{backgroundColor:currency===k?'rgba(255,214,10,0.2)':t.inp,borderRadius:10,borderWidth:1,borderColor:currency===k?'rgba(255,214,10,0.5)':t.inpB,paddingHorizontal:14,paddingVertical:8,alignItems:'center'}}>
              <Text style={{fontSize:16,marginBottom:2}}>{v.symbol}</Text>
              <Text style={{fontSize:9,color:currency===k?'#ffd60a':t.muted,fontWeight:'700'}}>{k}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
// ─── HERO CARD ────────────────────────────────────────────────────────────────
function HeroCard({tPL, roi, wr, won, lost, pending, t}) {
  const isProfit = tPL >= 0;
  const plC = isProfit ? '#30d158' : '#ff453a';

  // Count-up animation
  const animVal = useRef(new Animated.Value(0)).current;
  const [displayNum, setDisplayNum] = useState(0);
  useEffect(() => {
    animVal.setValue(0);
    Animated.timing(animVal, {toValue:1, duration:1200, useNativeDriver:false}).start();
    const id = animVal.addListener(({value}) => setDisplayNum(Math.round(value * tPL)));
    return () => animVal.removeListener(id);
  }, [tPL]);

  // Subtle breathe pulse on profit
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isProfit) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, {toValue:1.018, duration:1800, useNativeDriver:true}),
      Animated.timing(pulseAnim, {toValue:1,     duration:1800, useNativeDriver:true}),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isProfit]);

  const sign = displayNum >= 0 ? '+' : '-';
  const absStr = '₹' + Math.abs(displayNum).toLocaleString('en-IN');

  return (
    <Animated.View style={{
      borderRadius:28, marginBottom:16,
      transform:[{scale: pulseAnim}],
      // Outer glow layer
      shadowColor: plC, shadowOpacity: 0.45, shadowRadius:36, shadowOffset:{width:0, height:10},
    }}>
      {/* Main card body */}
      <View style={{
        borderRadius:28, padding:24,
        backgroundColor: isProfit ? 'rgba(30,50,35,0.95)' : 'rgba(50,22,22,0.95)',
        borderWidth:1.5, borderColor: plC + '45',
        overflow:'hidden',
      }}>
        {/* Background radial glow */}
        <View style={{position:'absolute',top:-40,left:-30,width:200,height:200,borderRadius:100,backgroundColor:plC,opacity:0.07}}/>
        <View style={{position:'absolute',bottom:-60,right:-20,width:160,height:160,borderRadius:80,backgroundColor:plC,opacity:0.05}}/>

        {/* Header row */}
        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
          <Text style={{fontSize:11, color:'rgba(255,255,255,0.38)', fontWeight:'800', letterSpacing:1.8, textTransform:'uppercase'}}>Total P&L</Text>
          <View style={{flexDirection:'row',gap:8}}>
            <View style={{backgroundColor: plC+'28', borderRadius:10, paddingHorizontal:10, paddingVertical:4, borderWidth:1, borderColor:plC+'40'}}>
              <Text style={{fontSize:10, color:plC, fontWeight:'800', letterSpacing:0.3}}>ROI {pct(roi)}</Text>
            </View>
            <View style={{backgroundColor:'rgba(255,255,255,0.08)',borderRadius:10,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:'rgba(255,255,255,0.12)'}}>
              <Text style={{fontSize:10,color:'rgba(255,255,255,0.55)',fontWeight:'700'}}>WR {pct(wr,0)}</Text>
            </View>
          </View>
        </View>

        {/* Big P&L number */}
        <Text style={{fontSize:52, fontWeight:'900', color:plC, letterSpacing:-2.5, marginBottom:20, includeFontPadding:false, lineHeight:58}}>
          {sign}{absStr}
        </Text>

        {/* Divider line */}
        <View style={{height:1,backgroundColor:'rgba(255,255,255,0.08)',marginBottom:14}}/>

        {/* Bottom stats row */}
        <View style={{flexDirection:'row'}}>
          {[
            {label:'Won',     value:String(won),    color:'#30d158', icon:'✓'},
            {label:'Lost',    value:String(lost),   color:'#ff453a', icon:'✕'},
            {label:'Pending', value:String(pending), color:'#ffd60a', icon:'⏳'},
            {label:'Win Rate',value:pct(wr,0),       color:'#0a84ff', icon:'%'},
          ].map((item,i) => (
            <View key={i} style={{flex:1, alignItems:'center', gap:2}}>
              <Text style={{fontSize:19, fontWeight:'900', color:item.color, letterSpacing:-0.5}}>{item.value}</Text>
              <Text style={{fontSize:8.5, color:'rgba(255,255,255,0.3)', fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase'}}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
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
            <TouchableOpacity key={k} onPress={()=>setTheme(k)} activeOpacity={0.8}
              style={{flex:1, backgroundColor:theme===k?t.accent+'22':t.inp, borderRadius:12, borderWidth:1, borderColor:theme===k?t.accent+'55':t.inpB, paddingVertical:12, alignItems:'center', gap:4}}>
              <Text style={{fontSize:20}}>{ico}</Text>
              <Text style={{fontSize:9, color:theme===k?t.accent:t.muted, fontWeight:theme===k?'700':'500', textTransform:'capitalize'}}>{k}</Text>
            </TouchableOpacity>
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
            <TouchableOpacity key={k} onPress={()=>{setTab(k);setTooltip(null);}}
              style={{backgroundColor:tab===k?'rgba(10,132,255,0.22)':t.inp,borderRadius:10,borderWidth:1,borderColor:tab===k?'rgba(10,132,255,0.5)':t.inpB,paddingHorizontal:12,paddingVertical:5}}>
              <Text style={{color:tab===k?'#0a84ff':t.muted,fontSize:10,fontWeight:'700'}}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <ChartWithTooltip data={data} height={110}/>
      {!tooltip&&<Text style={{fontSize:9,color:t.muted,textAlign:'center',marginTop:6}}>Tap chart for details</Text>}
    </Card>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({bets, t, onAddBet, onQuickAdd, onSettlePending, onGoToBets, onGoToStats}) {
  const stats = useMemo(()=>computeStats(bets),[bets]);
  const {won,lost,tPL,roi,wr,avgOdds,curStreak,runData,maxDD,maxW,maxL}=stats;
  const pending=bets.filter(b=>b.result==='pending').length;
  const todayBets=bets.filter(b=>b.date===today());
  const todayPL=todayBets.reduce((s,b)=>s+(b.profit||0),0);
  const hour=new Date().getHours();
  const greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';

  const weeklyData = useMemo(()=>{
    const wMap={};
    bets.filter(b=>b.result!=='pending').forEach(b=>{const w=getWeekKey(b.date);if(!wMap[w])wMap[w]=0;wMap[w]+=(b.profit||0);});
    return Object.entries(wMap).sort().slice(-8).map(([label,value])=>({label,value}));
  },[bets]);

  const sportBreakdown = useMemo(()=>Object.entries(SPORTS).map(([k,v])=>{
    const sb=bets.filter(b=>b.sport===k);
    const spl=sb.reduce((s,b)=>s+(b.profit||0),0);
    const sw=sb.filter(b=>b.result==='won').length;
    const ss=sb.filter(b=>['won','lost'].includes(b.result)).length;
    return {key:k,...v,bets:sb.length,pl:spl,wr:ss>0?(sw/ss)*100:0};
  }).filter(s=>s.bets>0),[bets]);

  if(bets.length===0) return (
    <View style={{alignItems:'center',justifyContent:'center',padding:40,flex:1}}>
      <Text style={{fontSize:70,marginBottom:16}}>🏏</Text>
      <Text style={{fontSize:22,fontWeight:'900',color:t.text,marginBottom:8}}>No bets yet</Text>
      <Text style={{fontSize:13,color:t.muted,lineHeight:22,textAlign:'center',marginBottom:24}}>Track your first bet to see stats,{'\n'}streaks and insights here</Text>
      <QuickActions onAddBet={onAddBet} onQuickAdd={onQuickAdd} onStats={onGoToStats} onExport={()=>{}} t={t}/>
    </View>
  );

  const strC=curStreak.tp==='won'?'#30d158':curStreak.tp==='lost'?'#ff453a':'#636366';

  return (
    <ScrollView showsVerticalScrollIndicator={false}>

      {/* ── Greeting + Profile ── */}
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20,marginTop:6}}>
        <View>
          <Text style={{fontSize:12,color:'rgba(255,255,255,0.32)',fontWeight:'700',letterSpacing:0.5}}>{greeting} 👋</Text>
          <Text style={{fontSize:26,fontWeight:'900',color:t.text,letterSpacing:-1,lineHeight:30}}>BetTracker Pro</Text>
        </View>
        <View style={{alignItems:'center',gap:4}}>
          <View style={{
            width:46,height:46,borderRadius:23,
            backgroundColor:'rgba(10,132,255,0.15)',
            borderWidth:1.5,borderColor:'rgba(10,132,255,0.32)',
            justifyContent:'center',alignItems:'center',
            shadowColor:'#0a84ff',shadowOpacity:0.2,shadowRadius:10,shadowOffset:{width:0,height:3},
          }}>
            <Text style={{fontSize:22}}>👤</Text>
          </View>
          <View style={{backgroundColor:'rgba(48,209,88,0.15)',borderRadius:6,paddingHorizontal:7,paddingVertical:2,borderWidth:1,borderColor:'rgba(48,209,88,0.25)'}}>
            <Text style={{fontSize:8,color:'#30d158',fontWeight:'800',letterSpacing:0.5}}>{bets.length} BETS</Text>
          </View>
        </View>
      </View>

      {/* ── Pending reminder ── */}
      <PendingReminderCard bets={bets} onSettleTap={onSettlePending} t={t}/>

      {/* ── Hero P&L Card ── */}
      <HeroCard tPL={tPL} roi={roi} wr={wr} won={won} lost={lost} pending={pending} t={t}/>

      {/* ── Quick Actions ── */}
      <QuickActions onAddBet={onAddBet} onQuickAdd={onQuickAdd} onStats={onGoToStats} onExport={()=>{}} t={t}/>

      {/* ── Mini Stats Row — Premium Pill Cards ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:20}} contentContainerStyle={{gap:8,flexDirection:'row',paddingRight:4}}>
        {[
          { label:'Win Rate', value:pct(wr,0), color:'#30d158', bg:'rgba(48,209,88,0.1)', border:'rgba(48,209,88,0.22)', icon:'🏆' },
          { label:'ROI', value:(roi>=0?'+':'')+pct(roi,1), color:roi>=0?'#30d158':'#ff453a', bg:roi>=0?'rgba(48,209,88,0.1)':'rgba(255,69,58,0.1)', border:roi>=0?'rgba(48,209,88,0.22)':'rgba(255,69,58,0.22)', icon:'📈' },
          { label:'Streak', value:`${curStreak.c>0?curStreak.c:'-'}${curStreak.tp==='won'?' W':curStreak.tp==='lost'?' L':''}`, color:curStreak.tp==='won'?'#30d158':curStreak.tp==='lost'?'#ff453a':'#636366', bg:curStreak.tp==='won'?'rgba(48,209,88,0.1)':curStreak.tp==='lost'?'rgba(255,69,58,0.1)':'rgba(99,99,102,0.1)', border:curStreak.tp==='won'?'rgba(48,209,88,0.22)':curStreak.tp==='lost'?'rgba(255,69,58,0.22)':'rgba(99,99,102,0.2)', icon:curStreak.tp==='won'?'🔥':'💀' },
          { label:'Avg Odds', value:avgOdds.toFixed(2), color:'#bf5af2', bg:'rgba(191,90,242,0.1)', border:'rgba(191,90,242,0.22)', icon:'🎲' },
          { label:'Today', value:fcs(todayPL), color:todayPL>=0?'#30d158':'#ff453a', bg:todayPL>=0?'rgba(48,209,88,0.1)':'rgba(255,69,58,0.1)', border:todayPL>=0?'rgba(48,209,88,0.22)':'rgba(255,69,58,0.22)', icon:'📅' },
        ].map((s,i)=>(
          <View key={i} style={{
            backgroundColor:s.bg, borderRadius:20, borderWidth:1, borderColor:s.border,
            paddingHorizontal:16, paddingVertical:14, alignItems:'center', minWidth:84,
            shadowColor:s.color, shadowOpacity:0.12, shadowRadius:10, shadowOffset:{width:0,height:3},
          }}>
            <Text style={{fontSize:18,marginBottom:5}}>{s.icon}</Text>
            <Text style={{fontSize:16,fontWeight:'900',color:s.color,letterSpacing:-0.4}}>{s.value}</Text>
            <Text style={{fontSize:8.5,color:'rgba(255,255,255,0.32)',marginTop:3,fontWeight:'800',letterSpacing:0.8,textTransform:'uppercase'}}>{s.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* ── Streak banner ── */}
      {curStreak.c>1&&(
        <View style={{
          backgroundColor:strC+'18', borderRadius:20, borderWidth:1.5, borderColor:strC+'45',
          padding:14, marginBottom:16, flexDirection:'row', alignItems:'center', gap:12,
          shadowColor:strC, shadowOpacity:0.2, shadowRadius:16, shadowOffset:{width:0,height:5},
        }}>
          <Text style={{fontSize:30}}>{curStreak.tp==='won'?'🔥':'💀'}</Text>
          <View style={{flex:1}}>
            <Text style={{fontSize:14,fontWeight:'900',color:strC,letterSpacing:-0.3}}>{curStreak.c} {curStreak.tp==='won'?'Win':'Loss'} Streak!</Text>
            <Text style={{fontSize:10,color:t.muted,marginTop:2}}>{curStreak.tp==='won'?'Keep it up! You\'re on fire 🔥':'Take a break, review your strategy'}</Text>
          </View>
          <View style={{backgroundColor:strC+'28',borderRadius:12,padding:10,alignItems:'center',minWidth:40}}>
            <Text style={{fontSize:22,fontWeight:'900',color:strC,letterSpacing:-1}}>{curStreak.c}</Text>
            <Text style={{fontSize:7.5,color:t.muted,textTransform:'uppercase',fontWeight:'800',letterSpacing:0.8}}>streak</Text>
          </View>
        </View>
      )}

      {/* ── Performance Chart — Tabbed + Tooltip ── */}
      {runData.length>=2&&<ChartTabCard bets={bets} runData={runData} maxDD={maxDD} t={t}/>}

      {/* ── Weekly Trend ── */}
      {weeklyData.length>=2&&<Card t={t} style={{marginBottom:12}}>
        <SectionHead title="📅 Weekly Trend" t={t}/>
        <BarChart data={weeklyData} labelKey="label" valueKey="value" t={t} height={60}/>
      </Card>}

      {/* ── Recent Bets ── */}
      {bets.length>0&&<Card t={t} style={{marginBottom:14}} glowColor='rgba(10,132,255,0.3)'>
        <SectionHead title="⚡ Recent Bets" sub="Last 3" t={t}
          right={
            <TouchableOpacity onPress={onGoToBets} style={{backgroundColor:'rgba(10,132,255,0.14)',borderRadius:10,paddingHorizontal:12,paddingVertical:5,borderWidth:1,borderColor:'rgba(10,132,255,0.28)'}}>
              <Text style={{fontSize:10,color:'#0a84ff',fontWeight:'800',letterSpacing:0.3}}>See All →</Text>
            </TouchableOpacity>
          }
        />
        {bets.slice(0,3).map(b=>{
          const rc=b.result==='won'?'#30d158':b.result==='lost'?'#ff453a':b.result==='pending'?'#ffd60a':'#636366';
          return (
            <View key={b.id} style={{
              flexDirection:'row', alignItems:'center', gap:12,
              backgroundColor:'rgba(255,255,255,0.04)', borderRadius:16,
              borderWidth:1, borderColor:'rgba(255,255,255,0.07)',
              borderLeftWidth:3.5, borderLeftColor:rc,
              padding:12, marginBottom:8,
            }}>
              <Text style={{fontSize:20}}>{SPORTS[b.sport]?.icon||'🎲'}</Text>
              <View style={{flex:1}}>
                <Text style={{fontSize:12,fontWeight:'800',color:t.text,letterSpacing:-0.2}} numberOfLines={1}>{b.match}</Text>
                <Text style={{fontSize:10,color:t.muted,marginTop:1}}>{b.selection} @ <Text style={{fontWeight:'700',color:t.sub}}>{b.odds}</Text> · {b.date}</Text>
                {b.tags&&b.tags.length>0&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:3,marginTop:4}}>
                  {b.tags.slice(0,3).map(tag=><Text key={tag} style={{fontSize:8,color:'#bf5af2',backgroundColor:'rgba(191,90,242,0.12)',borderRadius:6,paddingHorizontal:5,paddingVertical:1,fontWeight:'700'}}>{tag}</Text>)}
                </View>}
              </View>
              <View style={{alignItems:'flex-end',gap:4}}>
                <Text style={{fontSize:14,fontWeight:'900',color:(b.profit||0)>=0?'#30d158':'#ff453a',letterSpacing:-0.3}}>{fcs(b.profit||0)}</Text>
                <View style={{backgroundColor:rc+'20',borderRadius:7,paddingHorizontal:7,paddingVertical:2,borderWidth:1,borderColor:rc+'35'}}>
                  <Text style={{fontSize:8.5,color:rc,fontWeight:'800',textTransform:'uppercase',letterSpacing:0.5}}>{b.result}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </Card>}

      {/* ── Sport Breakdown ── */}
      {sportBreakdown.length>=2&&<Card t={t} style={{marginBottom:12}}>
        <SectionHead title="🏅 By Sport" t={t}/>
        {sportBreakdown.map(s=>(
          <View key={s.key} style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:10}}>
            <Text style={{fontSize:22,width:30}}>{s.icon}</Text>
            <View style={{flex:1}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:3}}>
                <Text style={{fontSize:11,fontWeight:'700',color:t.text}}>{s.name}</Text>
                <Text style={{fontSize:12,fontWeight:'800',color:s.pl>=0?'#30d158':'#ff453a'}}>{fcs(s.pl)}</Text>
              </View>
              <ProgressBar value={s.wr} max={100} color={s.color} t={t} height={4}/>
              <Text style={{fontSize:9,color:t.muted,marginTop:2}}>{s.bets} bets · {s.wr.toFixed(0)}% WR</Text>
            </View>
          </View>
        ))}
      </Card>}

      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ─── BETS TAB — Premium Redesign ─────────────────────────────────────────────
function SwipeBetCard({b, onEdit, onDelete, onDuplicate, onMarkResult, t}) {
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
              <Stars value={b.confidence||0} size={9}/>
            </View>
            {b.result==='pending'&&(
              <View style={{flexDirection:'row',gap:5}}>
                <TouchableOpacity onPress={()=>onMarkResult(b.id,'won')} style={{backgroundColor:'rgba(48,209,88,0.15)',borderRadius:8,borderWidth:1,borderColor:'rgba(48,209,88,0.35)',paddingHorizontal:10,paddingVertical:5}}>
                  <Text style={{color:'#30d158',fontSize:10,fontWeight:'700'}}>✓ Won</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>onMarkResult(b.id,'lost')} style={{backgroundColor:'rgba(255,69,58,0.15)',borderRadius:8,borderWidth:1,borderColor:'rgba(255,69,58,0.35)',paddingHorizontal:10,paddingVertical:5}}>
                  <Text style={{color:'#ff453a',fontSize:10,fontWeight:'700'}}>✗ Lost</Text>
                </TouchableOpacity>
              </View>
            )}
            {b.result!=='pending'&&(
              <View style={{flexDirection:'row',gap:4}}>
                <TouchableOpacity onPress={()=>onEdit(b)} style={{backgroundColor:'rgba(10,132,255,0.12)',borderRadius:8,paddingHorizontal:8,paddingVertical:5}}><Text style={{color:'#0a84ff',fontSize:10,fontWeight:'700'}}>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>onDuplicate(b)} style={{backgroundColor:'rgba(191,90,242,0.12)',borderRadius:8,paddingHorizontal:8,paddingVertical:5}}><Text style={{color:'#bf5af2',fontSize:10,fontWeight:'700'}}>📋</Text></TouchableOpacity>
              </View>
            )}
          </View>

          {b.notes&&<View style={{marginTop:7,backgroundColor:t.inp,borderRadius:8,padding:8}}>
            <Text style={{fontSize:10,color:t.sub,fontStyle:'italic'}}>📝 {b.notes}</Text>
          </View>}
        </View>
      </Animated.View>
    </View>
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
        {search.length>0&&<TouchableOpacity onPress={()=>setSearch('')}><Text style={{color:t.muted,fontSize:14}}>✕</Text></TouchableOpacity>}
      </View>

      {/* Result filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}} contentContainerStyle={{gap:6,paddingRight:8}}>
        {['all','pending','won','lost','void','half-won','half-lost'].map(f=>{
          const count=f==='all'?bets.length:bets.filter(b=>b.result===f).length;
          const active=filter===f;
          const col=resultColors[f]||'#0a84ff';
          return (
            <TouchableOpacity key={f} onPress={()=>setFilter(f)}
              style={{backgroundColor:active?col+'25':t.inp,borderRadius:20,borderWidth:1,borderColor:active?col+'55':t.inpB,paddingHorizontal:12,paddingVertical:6,flexDirection:'row',alignItems:'center',gap:4}}>
              <Text style={{color:active?col:t.muted,fontSize:10,fontWeight:'800',textTransform:'capitalize'}}>{f}</Text>
              <View style={{backgroundColor:active?col+'35':'rgba(255,255,255,0.08)',borderRadius:8,paddingHorizontal:5,paddingVertical:1}}>
                <Text style={{color:active?col:t.muted,fontSize:9,fontWeight:'700'}}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sport chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}} contentContainerStyle={{gap:6,paddingRight:8}}>
        {[['all','All ⚽'],['cricket','🏏'],['football','⚽'],['tennis','🎾'],['basketball','🏀'],['other','🎲']].map(([k,l])=>(
          <TouchableOpacity key={k} onPress={()=>setSport(k)}
            style={{backgroundColor:sport===k?'rgba(94,92,230,0.25)':t.inp,borderRadius:20,borderWidth:1,borderColor:sport===k?'rgba(94,92,230,0.55)':t.inpB,paddingHorizontal:12,paddingVertical:6}}>
            <Text style={{color:sport===k?'#5e5ce6':t.muted,fontSize:10,fontWeight:'700'}}>{l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tag chips (if any) */}
      {allTags.length>0&&(
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}} contentContainerStyle={{gap:6,paddingRight:8}}>
          <TouchableOpacity onPress={()=>setTagFilter('')}
            style={{backgroundColor:!tagFilter?'rgba(191,90,242,0.2)':t.inp,borderRadius:20,borderWidth:1,borderColor:!tagFilter?'rgba(191,90,242,0.5)':t.inpB,paddingHorizontal:12,paddingVertical:6}}>
            <Text style={{color:!tagFilter?'#bf5af2':t.muted,fontSize:10,fontWeight:'700'}}>All tags</Text>
          </TouchableOpacity>
          {allTags.map(tag=>(
            <TouchableOpacity key={tag} onPress={()=>setTagFilter(tagFilter===tag?'':tag)}
              style={{backgroundColor:tagFilter===tag?'rgba(191,90,242,0.2)':t.inp,borderRadius:20,borderWidth:1,borderColor:tagFilter===tag?'rgba(191,90,242,0.5)':t.inpB,paddingHorizontal:12,paddingVertical:6}}>
              <Text style={{color:tagFilter===tag?'#bf5af2':t.muted,fontSize:10,fontWeight:'700'}}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Sort row + summary */}
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:5}}>
          {[['date','Date'],['profit','P&L'],['odds','Odds'],['stake','Stake']].map(([k,l])=>(
            <TouchableOpacity key={k} onPress={()=>setSort(k)}
              style={{backgroundColor:sort===k?'rgba(255,214,10,0.15)':t.inp,borderRadius:8,borderWidth:1,borderColor:sort===k?'rgba(255,214,10,0.4)':t.inpB,paddingHorizontal:10,paddingVertical:4}}>
              <Text style={{color:sort===k?'#ffd60a':t.muted,fontSize:9,fontWeight:'700'}}>{l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {filtered.length>0&&<Text style={{fontSize:10,fontWeight:'700',color:totalPL>=0?'#30d158':'#ff453a',marginLeft:8}}>{fcs(totalPL)}</Text>}
      </View>

      {/* Swipe hint */}
      <Text style={{fontSize:9,color:t.muted,textAlign:'center',marginBottom:8}}>← Swipe left to delete  ·  Swipe right to edit →</Text>

      <FlatList data={filtered} keyExtractor={b=>String(b.id)} showsVerticalScrollIndicator={false}
        ListEmptyComponent={<View style={{alignItems:'center',paddingVertical:56}}><Text style={{fontSize:40,marginBottom:10}}>🔍</Text><Text style={{fontSize:13,color:t.muted}}>No bets found</Text></View>}
        renderItem={({item:b})=>(
          <SwipeBetCard key={b.id} b={b} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} onMarkResult={onMarkResult} t={t}/>
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
            <TouchableOpacity key={k} onPress={()=>setSf(k)} style={{backgroundColor:sf===k?'rgba(10,132,255,0.22)':t.inp,borderRadius:9,borderWidth:1,borderColor:sf===k?'rgba(10,132,255,0.5)':t.inpB,paddingHorizontal:13,paddingVertical:5}}>
              <Text style={{color:sf===k?'#0a84ff':t.sub,fontSize:11,fontWeight:'700'}}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Section tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
        <View style={{flexDirection:'row',gap:5}}>
          {sections.map(([k,l])=>(
            <TouchableOpacity key={k} onPress={()=>setSection(k)} style={{backgroundColor:section===k?'rgba(255,214,10,0.2)':t.inp,borderRadius:9,borderWidth:1,borderColor:section===k?'rgba(255,214,10,0.5)':t.inpB,paddingHorizontal:12,paddingVertical:6}}>
              <Text style={{color:section===k?'#ffd60a':t.sub,fontSize:11,fontWeight:'700'}}>{l} {k.charAt(0).toUpperCase()+k.slice(1)}</Text>
            </TouchableOpacity>
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
                  <TouchableOpacity key={k} onPress={()=>{setTheme(k);store.set('theme',k);}} style={{flex:1,backgroundColor:theme===k?'rgba(10,132,255,0.2)':'transparent',borderRadius:10,borderWidth:1,borderColor:theme===k?'rgba(10,132,255,0.4)':t.cardB,padding:7,alignItems:'center'}}>
                    <Text style={{fontSize:14,marginBottom:2}}>{icon}</Text>
                    <Text style={{fontSize:8,color:theme===k?'#0a84ff':t.sub,fontWeight:'700',textTransform:'capitalize'}}>{k}</Text>
                  </TouchableOpacity>
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
                <TouchableOpacity onPress={()=>setManagingBookies(false)} style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:14}}>
                  <Text style={{color:'#0a84ff',fontSize:13}}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={{fontSize:14,fontWeight:'800',color:t.text,marginBottom:12}}>⚙️ Manage Bookies</Text>
                <View style={{flexDirection:'row',gap:8,marginBottom:14}}>
                  <TextInput value={newBookie} onChangeText={setNewBookie} style={{flex:1,backgroundColor:t.inp,borderRadius:10,borderWidth:1,borderColor:t.inpB,color:t.text,fontSize:12,padding:9}} placeholder="Add new bookie..." placeholderTextColor={t.muted}/>
                  <TouchableOpacity onPress={addBookie} style={{backgroundColor:'#0a84ff',borderRadius:10,paddingHorizontal:14,justifyContent:'center'}}>
                    <Text style={{color:'#fff',fontWeight:'800',fontSize:13}}>Add</Text>
                  </TouchableOpacity>
                </View>
                {bookies.map(bk=>(
                  <View key={bk} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:t.inp,borderRadius:10,borderWidth:1,borderColor:t.inpB,padding:12,marginBottom:7}}>
                    <Text style={{color:t.text,fontSize:13}}>🎰 {bk}</Text>
                    <TouchableOpacity onPress={()=>removeBookie(bk)}>
                      <Text style={{color:'#ff453a',fontSize:13,fontWeight:'700'}}>✕</Text>
                    </TouchableOpacity>
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
                  <TouchableOpacity key={i} onPress={item.fn} style={{flexDirection:'row',alignItems:'center',gap:14,padding:14,borderRadius:12}}>
                    <Text style={{fontSize:22,width:32,textAlign:'center'}}>{item.icon}</Text>
                    <Text style={{fontSize:14,fontWeight:'600',color:t.sub}}>{item.label}</Text>
                  </TouchableOpacity>
                ))}

                {/* Danger zone */}
                <TouchableOpacity onPress={()=>setShowDanger(p=>!p)} style={{flexDirection:'row',alignItems:'center',gap:14,padding:14,borderRadius:12,marginTop:10}}>
                  <Text style={{fontSize:22,width:32,textAlign:'center'}}>⚠️</Text>
                  <Text style={{fontSize:14,fontWeight:'600',color:'#ff453a'}}>Danger Zone {showDanger?'▲':'▼'}</Text>
                </TouchableOpacity>
                {showDanger&&<TouchableOpacity onPress={clearAllBets} style={{flexDirection:'row',alignItems:'center',gap:14,padding:14,borderRadius:12,backgroundColor:'rgba(255,69,58,0.1)',borderWidth:1,borderColor:'rgba(255,69,58,0.3)',marginHorizontal:4}}>
                  <Text style={{fontSize:22,width:32,textAlign:'center'}}>🗑️</Text>
                  <Text style={{fontSize:13,fontWeight:'700',color:'#ff453a'}}>Delete All Bets</Text>
                </TouchableOpacity>}

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
  const iconColor = active ? '#fff' : 'rgba(180,140,140,0.62)';
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}
      style={{
        alignItems:'center',justifyContent:'center',flex:1,
        paddingVertical:6, paddingHorizontal:4,
        borderRadius:32,
        backgroundColor: active ? 'rgba(255,255,255,0.11)' : 'transparent',
        minWidth:44,
      }}>
      <Animated.View style={{alignItems:'center',gap:3,transform:[{scale}]}}>
        {IconComp
          ? <IconComp color={iconColor}/>
          : <Text style={{fontSize:20,lineHeight:24}}>{icon}</Text>
        }
        <Text style={{
          fontSize:9.5,
          color: active ? '#fff' : 'rgba(180,140,140,0.65)',
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
              backgroundColor:'rgba(0,0,0,0.65)',
            }}
            activeOpacity={1}
            onPress={()=>setShowFab(false)}
          />
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
            <View style={{
              flexDirection:'row', alignItems:'center', justifyContent:'space-around',
              backgroundColor:'rgba(20,6,6,0.85)',
              borderRadius:44, borderWidth:1, borderColor:'rgba(255,255,255,0.09)',
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
                    backgroundColor: showFab ? '#ff453a' : t.accent,
                    justifyContent:'center', alignItems:'center',
                    shadowColor: showFab ? '#ff453a' : t.accent,
                    shadowOpacity:0.6, shadowRadius:16, shadowOffset:{width:0,height:4},
                    borderWidth:2.5, borderColor:'rgba(255,255,255,0.2)',
                  }}
                >
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
