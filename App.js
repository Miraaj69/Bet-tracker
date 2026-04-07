import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, Alert, Dimensions, Platform,
  StatusBar, FlatList, Share
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Polygon, Line, Circle, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width: SW } = Dimensions.get('window');

// ─── THEMES ──────────────────────────────────────────────────────────────────
const THEMES = {
  amoled: { bg:'#000', bg2:'#080808', card:'rgba(255,255,255,0.06)', cardB:'rgba(255,255,255,0.09)', text:'#fff', sub:'rgba(255,255,255,0.52)', muted:'rgba(255,255,255,0.28)', inp:'rgba(255,255,255,0.07)', inpB:'rgba(255,255,255,0.14)', nav:'rgba(0,0,0,0.97)' },
  dark:   { bg:'#0c0c1e', bg2:'#1a1a2e', card:'rgba(255,255,255,0.07)', cardB:'rgba(255,255,255,0.11)', text:'#fff', sub:'rgba(255,255,255,0.52)', muted:'rgba(255,255,255,0.3)', inp:'rgba(255,255,255,0.09)', inpB:'rgba(255,255,255,0.14)', nav:'rgba(8,8,20,0.97)' },
  light:  { bg:'#eef2ff', bg2:'#fff', card:'rgba(255,255,255,0.82)', cardB:'rgba(0,0,0,0.07)', text:'#08081a', sub:'rgba(0,0,0,0.52)', muted:'rgba(0,0,0,0.33)', inp:'rgba(0,0,0,0.045)', inpB:'rgba(0,0,0,0.1)', nav:'rgba(232,238,255,0.97)' },
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SPORTS = {
  cricket:  { icon:'🏏', name:'Cricket',  color:'#30d158', markets:['Match Winner','Toss Winner','1st Innings Score','6 Over Score','10 Over Score','20 Over Score','Player Runs O/U','Fours O/U','Sixes O/U','Man of Match'], teams:['MI','CSK','RCB','KKR','DC','SRH','PBKS','RR','GT','LSG','India','Australia','England','Pakistan','New Zealand','South Africa','West Indies'] },
  football: { icon:'⚽', name:'Football', color:'#0a84ff', markets:['Match Winner','BTTS','Total Goals O/U','Correct Score','First Goalscorer','Asian Handicap','Half Time Result','Clean Sheet','Double Chance'], teams:['Man City','Arsenal','Liverpool','Chelsea','Man United','Real Madrid','Barcelona','Bayern Munich','PSG','Juventus','Inter Milan'] },
  tennis:   { icon:'🎾', name:'Tennis',   color:'#ffd60a', markets:['Match Winner','Set Betting','Total Games O/U','First Set Winner','Handicap Games','Aces O/U','Double Faults O/U'], teams:['Djokovic','Alcaraz','Sinner','Medvedev','Zverev','Swiatek','Sabalenka','Gauff','Rybakina'] },
};
const RESULTS   = ['pending','won','lost','void','half-won','half-lost'];
const BET_TYPES = ['Single','Double','Treble','Accumulator','System','Each Way','Asian Handicap','Live Bet','Lay Bet'];
const BOOKIES   = ['Betfair','Dream11','Parimatch','10Cric','Bet365','1xBet','Dafabet','Sportsbet.io','Stake','Unibet'];
const TABS      = [['📊','Dash'],['🏆','Bets'],['📈','Stats'],['📅','Cal'],['💰','Bank'],['🧮','Calc'],['📋','Report']];

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const store = {
  get: async (k, def) => { try { const v = await AsyncStorage.getItem('bt_'+k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: async (k, v) => { try { await AsyncStorage.setItem('bt_'+k, JSON.stringify(v)); } catch {} },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fc    = n => '₹' + Math.abs(Math.round(n||0)).toLocaleString('en-IN');
const fcs   = n => (n>=0?'+':'-') + fc(n);
const pct   = (n,d=1) => (n||0).toFixed(d)+'%';
const today = () => new Date().toISOString().slice(0,10);
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
const getDOW = ds => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(ds).getDay()];
const getMon = ds => new Date(ds).toLocaleString('en-IN',{month:'short'});
const calcEV = (odds,stake,prob) => Math.round(stake*((clamp(prob/100,0,1)*(odds-1))-((1-clamp(prob/100,0,1))*1)));

function computeStats(bets) {
  const settled = bets.filter(b=>['won','lost','half-won','half-lost'].includes(b.result));
  const won  = bets.filter(b=>b.result==='won').length;
  const lost = bets.filter(b=>b.result==='lost').length;
  const tPL  = bets.reduce((s,b)=>s+(b.profit||0),0);
  const tStake = bets.reduce((s,b)=>s+(b.stake||0),0);
  const roi  = tStake>0?(tPL/tStake)*100:0;
  const wr   = settled.length>0?(won/settled.length)*100:0;
  const avgOdds = bets.length?bets.reduce((s,b)=>s+(b.odds||0),0)/bets.length:0;

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

  return {settled,won,lost,tPL,tStake,roi,wr,avgOdds,curStreak,maxW,maxL,runData,maxDD,stdDev,kelly};
}

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
function Card({t, children, style, onPress}) {
  const C = onPress ? TouchableOpacity : View;
  return (
    <C onPress={onPress} style={[{backgroundColor:t.card, borderRadius:20, borderWidth:1, borderColor:t.cardB, padding:16, marginBottom:10}, style]}>
      {children}
    </C>
  );
}

function SectionHead({title, sub, t}) {
  return (
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
      <View>
        <Text style={{fontSize:13,fontWeight:'800',color:t.text}}>{title}</Text>
        {sub && <Text style={{fontSize:10,color:t.muted,marginTop:2}}>{sub}</Text>}
      </View>
    </View>
  );
}

function StatCard({label, value, sub, color, icon, t}) {
  return (
    <View style={{backgroundColor:t.card,borderRadius:18,borderWidth:1,borderColor:t.cardB,padding:14,flex:1,marginHorizontal:3}}>
      <Text style={{position:'absolute',top:-4,right:4,fontSize:36,opacity:0.07}}>{icon}</Text>
      <Text style={{fontSize:9,color:t.muted,letterSpacing:0.8,textTransform:'uppercase',marginBottom:6,fontWeight:'700'}}>{label}</Text>
      <Text style={{fontSize:22,fontWeight:'800',color,letterSpacing:-0.5}}>{value}</Text>
      {sub && <Text style={{fontSize:10,color:t.sub,marginTop:4}}>{sub}</Text>}
      <View style={{position:'absolute',bottom:0,left:0,right:0,height:3,backgroundColor:color,opacity:0.4,borderBottomLeftRadius:18,borderBottomRightRadius:18}}/>
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
  useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[]);
  const bg = type==='success'?'#30d158':type==='warn'?'#ff9f0a':'#ff453a';
  return (
    <View style={{position:'absolute',top:60,left:20,right:20,zIndex:9999,backgroundColor:bg,borderRadius:16,padding:14,alignItems:'center',shadowColor:'#000',shadowOpacity:0.4,shadowRadius:20}}>
      <Text style={{color:'#fff',fontWeight:'800',fontSize:13}}>{msg}</Text>
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

// ─── PICKER COMPONENT (replaces <select>) ─────────────────────────────────────
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

  useEffect(()=>{
    if(show) setForm(editBet?{...blank(bookies),...editBet,odds:String(editBet.odds),stake:String(editBet.stake),profit:String(editBet.profit||''),estWinProb:String(editBet.estWinProb||'')}:{...blank(bookies)});
  },[show]);

  const calcP=(r,s,o)=>{const sv=parseFloat(s),ov=parseFloat(o);if(!sv||!ov)return'';if(r==='won')return String(Math.round(sv*(ov-1)));if(r==='lost')return String(-sv);if(r==='half-won')return String(Math.round(sv*(ov-1)/2));if(r==='half-lost')return String(-Math.round(sv/2));return'';};
  const ch=(k,v)=>{const u={...form,[k]:v};if(['result','stake','odds'].includes(k))u.profit=calcP(u.result,u.stake,u.odds);if(k==='sport'){u.market=SPORTS[v].markets[0];u.match='';u.selection='';}setForm(u);};
  const sport=SPORTS[form.sport];
  const implP=parseFloat(form.odds)>0?Math.round(100/parseFloat(form.odds)):null;
  const ev=parseFloat(form.stake)&&parseFloat(form.odds)&&parseFloat(form.estWinProb)?calcEV(parseFloat(form.odds),parseFloat(form.stake),parseFloat(form.estWinProb)):null;

  const handleMatch=v=>{
    ch('match',v);
    const all=sport.teams.flatMap(a=>sport.teams.filter(b=>b!==a).map(b=>`${a} vs ${b}`));
    setSug(v.length>1?all.filter(s=>s.toLowerCase().includes(v.toLowerCase())).slice(0,4):[]);
  };

  const handleSave=async()=>{
    if(!form.match||!form.odds||!form.stake){Alert.alert('Missing fields','Match, Odds & Stake required');return;}
    await store.set('lastStake',form.stake);
    await store.set('lastBookie',form.bookie);
    onSave({...form,odds:parseFloat(form.odds)||0,stake:parseFloat(form.stake)||0,profit:parseFloat(form.profit)||0,estWinProb:parseFloat(form.estWinProb)||0,tags:form.tags||[]});
  };

  return (
    <Modal visible={show} animationType="slide" transparent>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'flex-end'}}>
        <View style={{backgroundColor:t.bg2,borderTopLeftRadius:26,borderTopRightRadius:26,maxHeight:'94%'}}>
          <View style={{padding:20,borderBottomWidth:1,borderColor:t.cardB,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
            <View>
              <Text style={{fontSize:17,fontWeight:'800',color:t.text}}>{editBet?'✏️ Edit Bet':'➕ New Bet'}</Text>
              <Text style={{fontSize:10,color:t.muted,marginTop:2}}>Fill in the details below</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{backgroundColor:t.inp,borderRadius:20,width:30,height:30,justifyContent:'center',alignItems:'center'}}>
              <Text style={{color:t.sub,fontSize:14}}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{padding:18}} keyboardShouldPersistTaps="handled">
            {/* Sport selector */}
            <View style={{flexDirection:'row',gap:8,marginBottom:16}}>
              {Object.entries(SPORTS).map(([k,v])=>(
                <TouchableOpacity key={k} onPress={()=>ch('sport',k)} style={{flex:1,backgroundColor:form.sport===k?v.color+'25':t.inp,borderRadius:12,borderWidth:1,borderColor:form.sport===k?v.color+'60':t.inpB,padding:10,alignItems:'center'}}>
                  <Text style={{fontSize:20,marginBottom:2}}>{v.icon}</Text>
                  <Text style={{fontSize:9,color:form.sport===k?v.color:t.sub,fontWeight:'700'}}>{v.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

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
            <TextInput value={form.match} onChangeText={handleMatch} style={styles.inp(t)} placeholder={`${sport.teams[0]} vs ${sport.teams[1]}`} placeholderTextColor={t.muted}/>
            {sug.length>0&&<View style={{backgroundColor:t.bg2,borderRadius:12,borderWidth:1,borderColor:t.cardB,marginBottom:8}}>
              {sug.map((s,i)=><TouchableOpacity key={i} onPress={()=>{ch('match',s);setSug([]);}} style={{padding:12,borderBottomWidth:i<sug.length-1?1:0,borderColor:t.cardB}}>
                <Text style={{fontSize:12,color:t.text}}>{sport.icon} {s}</Text>
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
                <Label t={t}>Est. Win Prob %</Label>
                <TextInput value={form.estWinProb} onChangeText={v=>ch('estWinProb',v)} style={styles.inp(t)} placeholder="55" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
                {ev!==null&&<Text style={{fontSize:9,marginTop:2,fontWeight:'700',color:ev>=0?'#30d158':'#ff453a'}}>EV: {ev>=0?'+':''}{fc(ev)}</Text>}
              </View>
              <View style={{flex:1,marginLeft:6}}>
                <Label t={t}>Result</Label>
                <Picker value={form.result} options={RESULTS} onChange={v=>ch('result',v)} t={t}/>
              </View>
            </Row>

            <Row>
              <View style={{flex:1,marginRight:6}}>
                <Label t={t}>P&L (₹)</Label>
                <TextInput value={form.profit} onChangeText={v=>ch('profit',v)} style={[styles.inp(t),{color:parseFloat(form.profit||0)>=0?'#30d158':'#ff453a'}]} placeholder="Auto-calc" keyboardType="numbers-and-punctuation" placeholderTextColor={t.muted}/>
              </View>
              <View style={{flex:1,marginLeft:6}}>
                <Label t={t}>Bookie</Label>
                <Picker value={form.bookie} options={bookies} onChange={v=>ch('bookie',v)} t={t}/>
              </View>
            </Row>

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

            <Label t={t}>Notes</Label>
            <TextInput value={form.notes} onChangeText={v=>ch('notes',v)} style={[styles.inp(t),{height:60,textAlignVertical:'top'}]} placeholder="Strategy, reason, observations..." placeholderTextColor={t.muted} multiline/>

            <View style={{flexDirection:'row',gap:10,marginTop:20,marginBottom:30}}>
              <TouchableOpacity onPress={onClose} style={{flex:1,backgroundColor:t.inp,borderRadius:14,padding:14,alignItems:'center'}}>
                <Text style={{color:t.sub,fontWeight:'600',fontSize:13}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={{flex:2,backgroundColor:sport.color,borderRadius:14,padding:14,alignItems:'center'}}>
                <Text style={{color:'#fff',fontWeight:'800',fontSize:14}}>{editBet?'Save Changes':`Add ${sport.icon} Bet`}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── QUICK ADD MODAL ──────────────────────────────────────────────────────────
function QuickAddModal({show, onClose, onSave, t, bookies}) {
  const [form, setForm] = useState({sport:'cricket',match:'',odds:'',stake:'',bookie:bookies[0]||'Betfair'});
  const ch=(k,v)=>setForm(f=>({...f,[k]:v}));
  return (
    <Modal visible={show} animationType="slide" transparent>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.55)',justifyContent:'flex-end'}}>
        <View style={{backgroundColor:t.bg2,borderTopLeftRadius:26,borderTopRightRadius:26,padding:22,paddingBottom:36}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <Text style={{fontSize:16,fontWeight:'800',color:t.text}}>⚡ Quick Add</Text>
            <View style={{flexDirection:'row',gap:6}}>
              {Object.entries(SPORTS).map(([k,v])=>(
                <TouchableOpacity key={k} onPress={()=>ch('sport',k)} style={{backgroundColor:form.sport===k?v.color+'30':t.inp,borderRadius:9,borderWidth:1,borderColor:form.sport===k?v.color+'50':t.inpB,padding:6}}>
                  <Text style={{fontSize:14}}>{v.icon}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TextInput value={form.match} onChangeText={v=>ch('match',v)} style={[styles.inp(t),{marginBottom:9}]} placeholder={`Match — e.g. ${SPORTS[form.sport].teams[0]} vs ${SPORTS[form.sport].teams[1]}`} placeholderTextColor={t.muted}/>
          <View style={{flexDirection:'row',gap:9,marginBottom:9}}>
            <TextInput value={form.odds} onChangeText={v=>ch('odds',v)} style={[styles.inp(t),{flex:1}]} placeholder="Odds 2.00" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
            <TextInput value={form.stake} onChangeText={v=>ch('stake',v)} style={[styles.inp(t),{flex:1}]} placeholder="Stake ₹" keyboardType="decimal-pad" placeholderTextColor={t.muted}/>
          </View>
          <Picker value={form.bookie} options={bookies} onChange={v=>ch('bookie',v)} t={t} style={{marginBottom:14}}/>
          <TouchableOpacity onPress={()=>{
            if(!form.match||!form.odds||!form.stake)return;
            onSave({id:Date.now(),date:today(),sport:form.sport,match:form.match,market:SPORTS[form.sport].markets[0],selection:form.match,odds:parseFloat(form.odds),stake:parseFloat(form.stake),result:'pending',profit:0,bookie:form.bookie,notes:'',confidence:3,livebet:false,betType:'Single',estWinProb:0,tags:[]});
            onClose();
          }} style={{backgroundColor:'#0a84ff',borderRadius:14,padding:14,alignItems:'center'}}>
            <Text style={{color:'#fff',fontWeight:'800',fontSize:14}}>⚡ Add Bet Instantly</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({bets, t}) {
  const stats = useMemo(()=>computeStats(bets),[bets]);
  const {won,lost,tPL,tStake,roi,wr,avgOdds,curStreak,runData,maxDD,stdDev,kelly,maxW,maxL}=stats;
  const plC=tPL>=0?'#30d158':'#ff453a';
  const pending=bets.filter(b=>b.result==='pending').length;
  const todayBets=bets.filter(b=>b.date===today());
  const todayPL=todayBets.reduce((s,b)=>s+(b.profit||0),0);

  if(bets.length===0) return (
    <View style={{alignItems:'center',justifyContent:'center',padding:40}}>
      <Text style={{fontSize:70,marginBottom:16}}>🏏</Text>
      <Text style={{fontSize:22,fontWeight:'900',color:t.text,marginBottom:8}}>No bets yet</Text>
      <Text style={{fontSize:13,color:t.muted,lineHeight:22,textAlign:'center',marginBottom:24}}>Track your first bet to see stats,{'\n'}streaks and insights here</Text>
      <View style={{flexDirection:'row',gap:10}}>
        <View style={{backgroundColor:'rgba(10,132,255,0.1)',borderRadius:14,padding:14,alignItems:'center',borderWidth:1,borderColor:'rgba(10,132,255,0.25)'}}>
          <Text style={{fontSize:20,marginBottom:4}}>➕</Text>
          <Text style={{fontSize:11,color:'#0a84ff',fontWeight:'700'}}>Add Bet</Text>
        </View>
        <View style={{backgroundColor:'rgba(48,209,88,0.1)',borderRadius:14,padding:14,alignItems:'center',borderWidth:1,borderColor:'rgba(48,209,88,0.25)'}}>
          <Text style={{fontSize:20,marginBottom:4}}>⚡</Text>
          <Text style={{fontSize:11,color:'#30d158',fontWeight:'700'}}>Quick Add</Text>
        </View>
      </View>
    </View>
  );

  const strC=curStreak.tp==='won'?'#30d158':curStreak.tp==='lost'?'#ff453a':'#636366';

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Today bar */}
      <View style={{flexDirection:'row',gap:8,marginBottom:12}}>
        {[{label:'Today',value:todayBets.length+' bets',sub:fcs(todayPL),color:todayPL>=0?'#30d158':'#ff453a'},{label:'Pending',value:String(pending),sub:'to settle',color:'#ffd60a'},{label:'All Time',value:String(bets.length),sub:'total bets',color:'#0a84ff'}].map((item,i)=>(
          <View key={i} style={{flex:1,backgroundColor:t.card,borderRadius:14,borderWidth:1,borderColor:t.cardB,padding:10,alignItems:'center'}}>
            <Text style={{fontSize:8,color:t.muted,textTransform:'uppercase',letterSpacing:0.5,fontWeight:'700',marginBottom:4}}>{item.label}</Text>
            <Text style={{fontSize:15,fontWeight:'900',color:item.color,marginBottom:2}}>{item.value}</Text>
            <Text style={{fontSize:9,color:t.muted}}>{item.sub}</Text>
          </View>
        ))}
      </View>

      {/* Hero P&L */}
      <View style={{backgroundColor:plC+'18',borderRadius:26,borderWidth:1,borderColor:plC+'35',padding:22,marginBottom:12}}>
        <Text style={{fontSize:10,color:t.muted,letterSpacing:1,textTransform:'uppercase',fontWeight:'700',marginBottom:10}}>Total Profit / Loss</Text>
        <Text style={{fontSize:44,fontWeight:'900',color:plC,letterSpacing:-1,marginBottom:10}}>{tPL>=0?'+':''}{fc(tPL)}</Text>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <View style={{flexDirection:'row',gap:16}}>
            <Text style={{fontSize:11,color:t.muted}}>ROI <Text style={{fontWeight:'700',color:plC}}>{pct(roi)}</Text></Text>
            <Text style={{fontSize:11,color:t.muted}}>Staked <Text style={{fontWeight:'700',color:t.sub}}>{fc(tStake)}</Text></Text>
          </View>
          <View style={{backgroundColor:plC+'22',borderRadius:14,padding:10,alignItems:'center',borderWidth:1,borderColor:plC+'44'}}>
            <Text style={{fontSize:9,color:t.muted,textTransform:'uppercase',marginBottom:2}}>Win Rate</Text>
            <Text style={{fontSize:24,fontWeight:'900',color:plC}}>{pct(wr,0)}</Text>
            <Text style={{fontSize:10,color:t.muted}}>{won}W · {lost}L · {pending}⏳</Text>
          </View>
        </View>
      </View>

      {/* Streak */}
      {curStreak.c>1&&(
        <View style={{backgroundColor:strC+'20',borderRadius:16,borderWidth:1,borderColor:strC+'40',padding:12,marginBottom:12,flexDirection:'row',alignItems:'center',gap:10}}>
          <Text style={{fontSize:26}}>{curStreak.tp==='won'?'🔥':'💀'}</Text>
          <View style={{flex:1}}>
            <Text style={{fontSize:13,fontWeight:'800',color:strC}}>{curStreak.c} {curStreak.tp==='won'?'Win':'Loss'} Streak!</Text>
            <Text style={{fontSize:10,color:t.muted}}>{curStreak.tp==='won'?'Keep it up! You\'re on fire 🔥':'Take a break, review your strategy'}</Text>
          </View>
          <View style={{backgroundColor:strC+'25',borderRadius:10,padding:10,alignItems:'center'}}>
            <Text style={{fontSize:20,fontWeight:'900',color:strC}}>{curStreak.c}</Text>
            <Text style={{fontSize:8,color:t.muted,textTransform:'uppercase'}}>streak</Text>
          </View>
        </View>
      )}

      {/* Stat cards */}
      <View style={{flexDirection:'row',marginBottom:12,marginHorizontal:-3}}>
        <StatCard label="Avg Odds" value={avgOdds.toFixed(2)} sub="Per bet" color="#bf5af2" icon="📊" t={t}/>
        <StatCard label="Best Streak" value={`${maxW}🔥`} sub="Wins in row" color="#30d158" icon="⚡" t={t}/>
        <StatCard label="Worst" value={`${maxL}💀`} sub="Loss streak" color="#ff453a" icon="📉" t={t}/>
      </View>

      {/* Chart */}
      {runData.length>=2&&<Card t={t} style={{marginBottom:12}}>
        <SectionHead title="📈 Running P&L" sub={`Max DD: ${fc(maxDD)}`} t={t}/>
        <LineChart data={runData} t={t} height={90}/>
      </Card>}

      {/* Risk metrics */}
      {bets.length>=5&&<Card t={t} style={{marginBottom:12}}>
        <SectionHead title="📐 Risk Metrics" t={t}/>
        <View style={{flexDirection:'row',gap:8}}>
          {[['Std Dev',fc(stdDev),'Volatility','#ff9f0a'],['Max DD',fc(maxDD),'From peak','#ff453a'],['Kelly %',pct(Math.max(0,kelly)),'Bet size','#0a84ff']].map(([l,v,s,c])=>(
            <View key={l} style={{flex:1,backgroundColor:t.inp,borderRadius:12,borderWidth:1,borderColor:t.inpB,padding:10}}>
              <Text style={{fontSize:8,color:t.muted,textTransform:'uppercase',marginBottom:4,fontWeight:'700'}}>{l}</Text>
              <Text style={{fontSize:14,fontWeight:'800',color:c,marginBottom:2}}>{v}</Text>
              <Text style={{fontSize:8,color:t.muted}}>{s}</Text>
            </View>
          ))}
        </View>
      </Card>}

      {/* Recent bets */}
      {bets.length>0&&<Card t={t}>
        <SectionHead title="⚡ Recent Bets" sub="Last 3" t={t}/>
        {bets.slice(0,3).map(b=>{
          const rc=b.result==='won'?'#30d158':b.result==='lost'?'#ff453a':b.result==='pending'?'#ffd60a':'#636366';
          return (
            <View key={b.id} style={{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:t.inp,borderRadius:12,borderWidth:1,borderColor:t.cardB,borderLeftWidth:3,borderLeftColor:rc,padding:10,marginBottom:8}}>
              <Text style={{fontSize:18}}>{SPORTS[b.sport]?.icon||'🎲'}</Text>
              <View style={{flex:1}}>
                <Text style={{fontSize:12,fontWeight:'700',color:t.text}} numberOfLines={1}>{b.match}</Text>
                <Text style={{fontSize:10,color:t.muted}}>{b.selection} @ {b.odds} · {b.date}</Text>
              </View>
              <View style={{alignItems:'flex-end'}}>
                <Text style={{fontSize:13,fontWeight:'800',color:(b.profit||0)>=0?'#30d158':'#ff453a'}}>{fcs(b.profit||0)}</Text>
                <View style={{backgroundColor:rc+'22',borderRadius:6,paddingHorizontal:6,paddingVertical:1}}>
                  <Text style={{fontSize:9,color:rc,fontWeight:'700',textTransform:'uppercase'}}>{b.result}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </Card>}
      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ─── BETS TAB ─────────────────────────────────────────────────────────────────
function BetsTab({bets, onEdit, onDelete, onDuplicate, onMarkResult, t}) {
  const [filter, setFilter] = useState('all');
  const [sport, setSport]   = useState('all');
  const [sort, setSort]     = useState('date');
  const [search, setSearch] = useState('');

  const filtered = useMemo(()=>bets
    .filter(b=>filter==='all'||b.result===filter)
    .filter(b=>sport==='all'||b.sport===sport)
    .filter(b=>!search||[b.match,b.selection,b.bookie||'',b.market].some(v=>v&&v.toLowerCase().includes(search.toLowerCase())))
    .sort((a,b)=>sort==='date'?new Date(b.date)-new Date(a.date):sort==='profit'?(b.profit||0)-(a.profit||0):b.odds-a.odds)
  ,[bets,filter,sport,sort,search]);

  return (
    <View style={{flex:1}}>
      <Card t={t} style={{marginBottom:8}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>
          <View style={{flexDirection:'row',gap:5}}>
            {[['all','All'],...Object.entries(SPORTS).map(([k,v])=>[k,v.icon+' '+v.name])].map(([k,label])=>(
              <TouchableOpacity key={k} onPress={()=>setSport(k)} style={{backgroundColor:sport===k?'rgba(10,132,255,0.22)':t.inp,borderRadius:9,borderWidth:1,borderColor:sport===k?'rgba(10,132,255,0.5)':t.inpB,paddingHorizontal:11,paddingVertical:5}}>
                <Text style={{color:sport===k?'#0a84ff':t.sub,fontSize:11,fontWeight:'700'}}>{label} ({k==='all'?bets.length:bets.filter(b=>b.sport===k).length})</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>
          <View style={{flexDirection:'row',gap:4}}>
            {['all','pending','won','lost','void'].map(f=>(
              <TouchableOpacity key={f} onPress={()=>setFilter(f)} style={{backgroundColor:filter===f?'rgba(10,132,255,0.22)':t.inp,borderRadius:8,borderWidth:1,borderColor:filter===f?'rgba(10,132,255,0.5)':t.inpB,paddingHorizontal:9,paddingVertical:4}}>
                <Text style={{color:filter===f?'#0a84ff':t.sub,fontSize:9,fontWeight:'700',textTransform:'capitalize'}}>{f} ({f==='all'?bets.length:bets.filter(b=>b.result===f).length})</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <TextInput value={search} onChangeText={setSearch} style={styles.inp(t)} placeholder="🔍 Search match, pick, bookie..." placeholderTextColor={t.muted}/>
      </Card>

      <FlatList data={filtered} keyExtractor={b=>String(b.id)} showsVerticalScrollIndicator={false}
        ListEmptyComponent={<View style={{alignItems:'center',paddingVertical:56}}><Text style={{fontSize:40,marginBottom:10}}>🏆</Text><Text style={{fontSize:13,color:t.muted}}>No bets found</Text></View>}
        renderItem={({item:b})=>{
          const rc=b.result==='won'?'#30d158':b.result==='lost'?'#ff453a':b.result==='pending'?'#ffd60a':b.result==='void'?'#636366':'#34aadc';
          const pc=(b.profit||0)>=0?'#30d158':'#ff453a';
          return (
            <View style={{backgroundColor:t.card,borderRadius:18,borderWidth:1,borderColor:t.cardB,marginBottom:10,overflow:'hidden'}}>
              <View style={{position:'absolute',left:0,top:0,bottom:0,width:4,backgroundColor:rc}}/>
              <View style={{padding:14,paddingLeft:18}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                  <View style={{flex:1,marginRight:10}}>
                    <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:4}}>
                      <Text style={{fontSize:16}}>{SPORTS[b.sport]?.icon||'🎲'}</Text>
                      <Text style={{fontSize:13,fontWeight:'800',color:t.text,flex:1}} numberOfLines={1}>{b.match}</Text>
                    </View>
                    <View style={{flexDirection:'row',gap:5,flexWrap:'wrap'}}>
                      <View style={{backgroundColor:rc+'22',borderRadius:8,paddingHorizontal:8,paddingVertical:2,borderWidth:1,borderColor:rc+'44'}}>
                        <Text style={{fontSize:9,color:rc,fontWeight:'800',textTransform:'uppercase'}}>{b.result}</Text>
                      </View>
                      {b.livebet&&<View style={{backgroundColor:'rgba(255,69,58,0.2)',borderRadius:8,paddingHorizontal:8,paddingVertical:2}}>
                        <Text style={{fontSize:9,color:'#ff453a',fontWeight:'800'}}>🔴 LIVE</Text>
                      </View>}
                      {b.bookie&&<View style={{backgroundColor:t.inp,borderRadius:8,paddingHorizontal:8,paddingVertical:2}}>
                        <Text style={{fontSize:9,color:t.muted}}>{b.bookie}</Text>
                      </View>}
                    </View>
                  </View>
                  <View style={{backgroundColor:pc+'18',borderRadius:12,padding:10,alignItems:'center',borderWidth:1,borderColor:pc+'35'}}>
                    <Text style={{fontSize:16,fontWeight:'900',color:pc}}>{fcs(b.profit||0)}</Text>
                    <Text style={{fontSize:8,color:t.muted,fontWeight:'600',textTransform:'uppercase',marginTop:2}}>P&L</Text>
                  </View>
                </View>
                <View style={{flexDirection:'row',gap:12,marginBottom:10,flexWrap:'wrap'}}>
                  {[['Pick',b.selection||'—','#0a84ff'],['Odds',String(b.odds),'#ffd60a'],['Stake',fc(b.stake),t.sub],['Market',b.market,t.muted]].map(([l,v,c])=>(
                    <View key={l}>
                      <Text style={{fontSize:8,color:t.muted,textTransform:'uppercase',marginBottom:2,fontWeight:'700'}}>{l}</Text>
                      <Text style={{fontSize:11,color:c,fontWeight:'700'}} numberOfLines={1}>{v}</Text>
                    </View>
                  ))}
                </View>
                <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                    <Text style={{fontSize:9,color:t.muted}}>📅 {b.date}</Text>
                    <Stars value={b.confidence||0} size={10}/>
                  </View>
                  <View style={{flexDirection:'row',gap:5}}>
                    {b.result==='pending'&&<>
                      <TouchableOpacity onPress={()=>onMarkResult(b.id,'won')} style={{backgroundColor:'rgba(48,209,88,0.15)',borderRadius:8,borderWidth:1,borderColor:'rgba(48,209,88,0.3)',paddingHorizontal:10,paddingVertical:5}}>
                        <Text style={{color:'#30d158',fontSize:10,fontWeight:'700'}}>✓ Won</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={()=>onMarkResult(b.id,'lost')} style={{backgroundColor:'rgba(255,69,58,0.15)',borderRadius:8,borderWidth:1,borderColor:'rgba(255,69,58,0.3)',paddingHorizontal:10,paddingVertical:5}}>
                        <Text style={{color:'#ff453a',fontSize:10,fontWeight:'700'}}>✗ Lost</Text>
                      </TouchableOpacity>
                    </>}
                    <TouchableOpacity onPress={()=>onEdit(b)} style={{backgroundColor:'rgba(10,132,255,0.15)',borderRadius:8,borderWidth:1,borderColor:'rgba(10,132,255,0.28)',paddingHorizontal:10,paddingVertical:5}}>
                      <Text style={{color:'#0a84ff',fontSize:10,fontWeight:'700'}}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>onDuplicate(b)} style={{backgroundColor:'rgba(191,90,242,0.15)',borderRadius:8,borderWidth:1,borderColor:'rgba(191,90,242,0.28)',paddingHorizontal:10,paddingVertical:5}}>
                      <Text style={{color:'#bf5af2',fontSize:10,fontWeight:'700'}}>📋</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>Alert.alert('Delete bet?','This cannot be undone',[{text:'Cancel'},{text:'Delete',style:'destructive',onPress:()=>onDelete(b.id)}])} style={{backgroundColor:'rgba(255,69,58,0.15)',borderRadius:8,borderWidth:1,borderColor:'rgba(255,69,58,0.28)',paddingHorizontal:10,paddingVertical:5}}>
                      <Text style={{color:'#ff453a',fontSize:10,fontWeight:'700'}}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {b.notes&&<View style={{marginTop:7,backgroundColor:t.inp,borderRadius:8,padding:8}}>
                  <Text style={{fontSize:10,color:t.sub,fontStyle:'italic'}}>📝 {b.notes}</Text>
                </View>}
              </View>
            </View>
          );
        }}
        contentContainerStyle={{paddingBottom:20}}
      />
    </View>
  );
}

// ─── STATS TAB ────────────────────────────────────────────────────────────────
function StatsTab({bets, t}) {
  const [sf, setSf] = useState('all');
  const fb = sf==='all'?bets:bets.filter(b=>b.sport===sf);
  const stats = useMemo(()=>computeStats(fb),[fb]);

  const mMap={}, dMap={Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0};
  fb.forEach(b=>{const m=getMon(b.date);if(!mMap[m])mMap[m]=0;mMap[m]+=(b.profit||0);dMap[getDOW(b.date)]+=(b.profit||0);});
  const monthData=Object.entries(mMap).map(([label,value])=>({label,value}));
  const dowData=Object.entries(dMap).map(([label,value])=>({label,value}));

  const bkMap={};
  fb.forEach(b=>{const bk=b.bookie||'Other';if(!bkMap[bk])bkMap[bk]={pl:0,won:0,total:0};bkMap[bk].pl+=(b.profit||0);if(['won','lost'].includes(b.result))bkMap[bk].total++;if(b.result==='won')bkMap[bk].won++;});

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
        <View style={{flexDirection:'row',gap:5}}>
          {[['all','All'],['cricket','🏏'],['football','⚽'],['tennis','🎾']].map(([k,l])=>(
            <TouchableOpacity key={k} onPress={()=>setSf(k)} style={{backgroundColor:sf===k?'rgba(10,132,255,0.22)':t.inp,borderRadius:9,borderWidth:1,borderColor:sf===k?'rgba(10,132,255,0.5)':t.inpB,paddingHorizontal:13,paddingVertical:5}}>
              <Text style={{color:sf===k?'#0a84ff':t.sub,fontSize:11,fontWeight:'700'}}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

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

      {Object.keys(bkMap).length>=2&&<Card t={t} style={{marginBottom:10}}>
        <SectionHead title="🎰 By Bookie" t={t}/>
        {Object.entries(bkMap).sort((a,b)=>b[1].pl-a[1].pl).map(([bk,d])=>{
          const wr=d.total>0?Math.round(d.won/d.total*100):0;
          return(
            <View key={bk} style={{backgroundColor:t.inp,borderRadius:12,borderWidth:1,borderColor:t.inpB,padding:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
              <View><Text style={{fontSize:12,fontWeight:'700',color:t.text}}>🎰 {bk}</Text><Text style={{fontSize:9,color:t.muted}}>{d.total} bets · {wr}% WR</Text></View>
              <Text style={{fontSize:15,fontWeight:'800',color:d.pl>=0?'#30d158':'#ff453a'}}>{fcs(d.pl)}</Text>
            </View>
          );
        })}
      </Card>}
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
  bets.forEach(b=>{const d=new Date(b.date);if(d.getFullYear()===vd.y&&d.getMonth()===vd.m){const k=d.getDate();if(!dMap[k])dMap[k]={pl:0,c:0};dMap[k].pl+=(b.profit||0);dMap[k].c++;}});
  const mPL=Object.values(dMap).reduce((s,d)=>s+d.pl,0);
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
            <Text style={{fontSize:11,fontWeight:'700',color:mPL>=0?'#30d158':'#ff453a'}}>{fcs(mPL)}</Text>
          </View>
          <TouchableOpacity onPress={()=>setVd(v=>{let m=v.m+1,y=v.y;if(m>11){m=0;y++;}return{y,m};})} style={{backgroundColor:t.inp,borderRadius:10,borderWidth:1,borderColor:t.inpB,paddingHorizontal:14,paddingVertical:8}}>
            <Text style={{color:t.text,fontSize:16}}>›</Text>
          </TouchableOpacity>
        </View>
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
        <SectionHead title={`${selDay} ${mName}`} sub={`${selBets.length} bet(s)`} t={t}/>
        {selBets.map(b=>(
          <View key={b.id} style={{backgroundColor:t.inp,borderRadius:12,borderWidth:1,borderColor:t.inpB,padding:12,marginBottom:7}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:3}}>
              <Text style={{fontSize:12,fontWeight:'700',color:t.text}}>{SPORTS[b.sport]?.icon||'🎲'} {b.match}</Text>
              <Text style={{fontSize:13,fontWeight:'800',color:(b.profit||0)>=0?'#30d158':'#ff453a'}}>{fcs(b.profit||0)}</Text>
            </View>
            <Text style={{fontSize:10,color:t.sub}}>{b.selection} @ {b.odds} · {fc(b.stake)} · {b.result}</Text>
          </View>
        ))}
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
  const [editing,setEditing]=useState(false);

  useEffect(()=>{
    store.get('bankroll',10000).then(v=>setBankroll(v));
    store.get('target',5000).then(v=>setTarget(v));
    store.get('dailyLim',2000).then(v=>setDailyLim(v));
  },[]);
  useEffect(()=>{store.set('bankroll',bankroll);},[bankroll]);
  useEffect(()=>{store.set('target',target);},[target]);
  useEffect(()=>{store.set('dailyLim',dailyLim);},[dailyLim]);

  const {tPL,wr,avgOdds,maxW,maxL,maxDD,stdDev,kelly}=useMemo(()=>computeStats(bets),[bets]);
  const cur=bankroll+tPL, growth=(tPL/bankroll)*100;
  const now=new Date();
  const thisMonth=bets.filter(b=>{const d=new Date(b.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
  const mPL=thisMonth.reduce((s,b)=>s+(b.profit||0),0);
  const mPct=clamp((mPL/target)*100,0,100);
  const todayLoss=Math.abs(bets.filter(b=>b.date===today()).reduce((s,b)=>(b.profit||0)<0?s+(b.profit||0):s,0));
  const dlPct=clamp((todayLoss/dailyLim)*100,0,100);
  const kellySug=Math.max(0,kelly/100)*cur;

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
        {editing&&<View style={{flexDirection:'row',gap:8}}>
          {[['Starting (₹)',bankroll,setBankroll],['Target (₹)',target,setTarget],['Loss Limit (₹)',dailyLim,setDailyLim]].map(([lbl,val,fn])=>(
            <View key={lbl} style={{flex:1}}>
              <Text style={{fontSize:8,color:t.muted,marginBottom:3,textTransform:'uppercase'}}>{lbl}</Text>
              <TextInput value={String(val)} onChangeText={v=>fn(parseFloat(v)||0)} style={styles.inp(t)} keyboardType="decimal-pad"/>
            </View>
          ))}
        </View>}
      </Card>

      <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
        <Card t={t} style={{flex:1,alignItems:'center',marginBottom:0}}><Text style={{fontSize:9,color:t.muted,textTransform:'uppercase',marginBottom:4}}>🏆 Best Win</Text><Text style={{fontSize:26,fontWeight:'800',color:'#30d158'}}>{maxW}</Text></Card>
        <Card t={t} style={{flex:1,alignItems:'center',marginBottom:0}}><Text style={{fontSize:9,color:t.muted,textTransform:'uppercase',marginBottom:4}}>💀 Worst Loss</Text><Text style={{fontSize:26,fontWeight:'800',color:'#ff453a'}}>{maxL}</Text></Card>
        <Card t={t} style={{flex:1,alignItems:'center',marginBottom:0}}><Text style={{fontSize:9,color:t.muted,textTransform:'uppercase',marginBottom:4}}>📉 Max DD</Text><Text style={{fontSize:14,fontWeight:'800',color:'#ff9f0a'}}>{fc(maxDD)}</Text></Card>
      </View>

      <Card t={t} style={{marginBottom:10}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
          <Text style={{fontSize:12,fontWeight:'700',color:t.text}}>🎯 Monthly Target</Text>
          <Text style={{fontSize:11,color:t.sub}}>{fc(mPL)} / {fc(target)}</Text>
        </View>
        <View style={{height:10,backgroundColor:t.inp,borderRadius:6,overflow:'hidden',marginBottom:4}}>
          <View style={{height:'100%',width:`${mPct}%`,backgroundColor:mPL>=0?'#30d158':'#ff453a',borderRadius:6}}/>
        </View>
        <Text style={{fontSize:10,color:t.muted}}>{mPct.toFixed(0)}% achieved · {thisMonth.length} bets this month</Text>
      </Card>

      <Card t={t} style={{marginBottom:10}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
          <Text style={{fontSize:12,fontWeight:'700',color:t.text}}>⚠️ Daily Loss Limit</Text>
          <Text style={{fontSize:11,color:dlPct>=80?'#ff453a':t.sub}}>{fc(todayLoss)} / {fc(dailyLim)}</Text>
        </View>
        <View style={{height:10,backgroundColor:t.inp,borderRadius:6,overflow:'hidden',marginBottom:4}}>
          <View style={{height:'100%',width:`${dlPct}%`,backgroundColor:dlPct>=80?'#ff453a':dlPct>=50?'#ffd60a':'#30d158',borderRadius:6}}/>
        </View>
        {dlPct>=80&&<Text style={{fontSize:10,color:'#ff453a',fontWeight:'700',marginTop:4}}>🛑 STOP! Daily loss limit almost reached!</Text>}
      </Card>

      <Card t={t}>
        <SectionHead title="📐 Kelly Criterion" sub="Optimal bet sizing" t={t}/>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
          {[['Win Rate',pct(wr,0),'#30d158'],['Avg Odds',avgOdds.toFixed(2),'#ffd60a'],['Kelly %',pct(Math.max(0,kelly)),'#0a84ff'],['Suggested',fc(kellySug),'#bf5af2'],['Std Dev',fc(stdDev),'#ff9f0a']].map(([l,v,c])=>(
            <View key={l} style={{flex:1,minWidth:70,backgroundColor:t.inp,borderRadius:12,borderWidth:1,borderColor:t.inpB,padding:10}}>
              <Text style={{fontSize:8,color:t.muted,textTransform:'uppercase',marginBottom:2}}>{l}</Text>
              <Text style={{fontSize:13,fontWeight:'800',color:c}}>{v}</Text>
            </View>
          ))}
        </View>
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
  const bProfit=parseFloat(stake)&&parseFloat(odds)?Math.round(parseFloat(stake)*(parseFloat(odds)-1)):null;
  const lLiab=parseFloat(layForm.lo)&&parseFloat(layForm.ls)?Math.round(parseFloat(layForm.ls)*(parseFloat(layForm.lo)-1)):null;
  const lProfit=parseFloat(layForm.ls)&&parseFloat(layForm.comm)?Math.round(parseFloat(layForm.ls)*(1-parseFloat(layForm.comm)/100)):null;
  const pOdds=legs.reduce((a,o)=>parseFloat(o)?a*parseFloat(o):a,1);
  const pProfit=parseFloat(stake)&&pOdds>1?Math.round(parseFloat(stake)*(pOdds-1)):null;
  const implP=parseFloat(odds)>0?Math.round(100/parseFloat(odds)):null;
  const ev=parseFloat(stake)&&parseFloat(odds)&&parseFloat(prob)?calcEV(parseFloat(odds),parseFloat(stake),parseFloat(prob)):null;
  const beWR=parseFloat(odds)>1?(1/parseFloat(odds)*100).toFixed(1):null;

  const Inp=({value,onChange,placeholder,style})=>(
    <TextInput value={value} onChangeText={onChange} style={[styles.inp(t),style]} placeholder={placeholder} placeholderTextColor={t.muted} keyboardType="decimal-pad"/>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
        <View style={{flexDirection:'row',gap:5}}>
          {[['back','🔵 Back'],['lay','🟠 Lay'],['parlay','🔗 Parlay'],['ev','📊 EV'],['breakeven','⚖️ B/E']].map(([m,l])=>(
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
            <View style={{flex:1}}><Label t={t}>Comm %</Label><Inp value={layForm.comm} onChange={v=>setLayForm({...layForm,comm:v})} placeholder="5"/></View>
          </View>
          {lLiab!==null&&<View style={{flexDirection:'row',gap:9}}>
            <View style={{flex:1,backgroundColor:'rgba(48,209,88,0.1)',borderRadius:14,borderWidth:1,borderColor:'rgba(48,209,88,0.28)',padding:14,alignItems:'center'}}>
              <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>LOSES</Text>
              <Text style={{fontSize:20,fontWeight:'800',color:'#30d158'}}>+{fc(lProfit)}</Text>
            </View>
            <View style={{flex:1,backgroundColor:'rgba(255,69,58,0.1)',borderRadius:14,borderWidth:1,borderColor:'rgba(255,69,58,0.28)',padding:14,alignItems:'center'}}>
              <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>WINS</Text>
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
          {ev!==null&&<View style={{flexDirection:'row',gap:9}}>
            {[['Expected Value',ev>=0?'+'+fc(ev):'-'+fc(Math.abs(ev)),ev>=0?'#30d158':'#ff453a'],['Edge',implP&&prob?((parseFloat(prob)-implP)/implP*100).toFixed(1)+'%':'—','#0a84ff']].map(([l,v,c])=>(
              <View key={l} style={{flex:1,backgroundColor:t.inp,borderRadius:14,borderWidth:1,borderColor:t.inpB,padding:14,alignItems:'center'}}>
                <Text style={{fontSize:9,color:t.muted,marginBottom:3}}>{l}</Text>
                <Text style={{fontSize:20,fontWeight:'800',color:c}}>{v}</Text>
              </View>
            ))}
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
  const tPL=pb.reduce((s,b)=>s+(b.profit||0),0);
  const tStake=pb.reduce((s,b)=>s+(b.stake||0),0);
  const roi=tStake>0?(tPL/tStake)*100:0;
  const wr=settled.length>0?(won/settled.length)*100:0;
  const plC=tPL>=0?'#30d158':'#ff453a';
  const labels={week:'This Week',month:'This Month',year:'This Year',all:'All Time'};

  const exportReport=async()=>{
    const txt=[`BetTracker Pro — ${labels[period]} Report`,`Generated: ${new Date().toLocaleDateString('en-IN')}`,'',`Total Bets: ${pb.length}  Won: ${won}  Lost: ${settled.length-won}`,`Win Rate: ${wr.toFixed(1)}%`,`Total P&L: ${tPL>=0?'+':''}₹${Math.round(tPL)}`,`ROI: ${roi.toFixed(1)}%`,`Total Staked: ₹${Math.round(tStake)}`].join('\n');
    await Share.share({message:txt,title:`BetTracker Pro — ${labels[period]} Report`});
    showToast('📋 Report shared!','success');
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
          <View style={{backgroundColor:plC+'18',borderRadius:26,borderWidth:1,borderColor:plC+'35',padding:22,marginBottom:12}}>
            <Text style={{fontSize:9,color:t.muted,letterSpacing:1,textTransform:'uppercase',fontWeight:'700',marginBottom:6}}>📋 {labels[period]} Report</Text>
            <Text style={{fontSize:40,fontWeight:'900',color:plC,letterSpacing:-1,marginBottom:10}}>{tPL>=0?'+':''}{fc(tPL)}</Text>
            <View style={{flexDirection:'row',gap:14,flexWrap:'wrap'}}>
              {[['ROI',`${roi.toFixed(1)}%`,plC],['Win Rate',`${wr.toFixed(0)}%`,'#0a84ff'],['Bets',String(pb.length),t.sub],['Staked',fc(tStake),t.muted]].map(([l,v,c])=>(
                <View key={l}><Text style={{fontSize:10,color:t.muted}}>{l} </Text><Text style={{fontSize:12,fontWeight:'700',color:c}}>{v}</Text></View>
              ))}
            </View>
          </View>
          <TouchableOpacity onPress={exportReport} style={{backgroundColor:'#0a84ff',borderRadius:16,padding:14,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:8}}>
            <Text style={{fontSize:16}}>📤</Text>
            <Text style={{color:'#fff',fontWeight:'800',fontSize:14}}>Share {labels[period]} Report</Text>
          </TouchableOpacity>
        </View>
      }
      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ─── SETTINGS DRAWER ──────────────────────────────────────────────────────────
function Drawer({show, onClose, theme, setTheme, bets, bookies, setBookies, t, showToast}) {
  const exportCSV=async()=>{
    const hdr=['Date','Sport','Match','Market','Selection','BetType','Odds','Stake','Result','PL','Bookie','Confidence','LiveBet','Notes'];
    const rows=bets.map(b=>[b.date,b.sport,b.match,b.market,b.selection,b.betType||'Single',b.odds,b.stake,b.result,b.profit||0,b.bookie||'',b.confidence||0,b.livebet?'Yes':'No',b.notes||'']);
    const csv=[hdr,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    await Share.share({message:csv,title:'BetTracker Pro — Bets Export'});
    showToast('📥 CSV shared!','success');
  };

  return (
    <Modal visible={show} animationType="slide" transparent>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.55)',flexDirection:'row',justifyContent:'flex-end'}}>
        <TouchableOpacity style={{flex:1}} onPress={onClose}/>
        <View style={{width:'78%',maxWidth:320,backgroundColor:t.bg2,borderLeftWidth:1,borderColor:t.cardB,paddingBottom:40}}>
          <SafeAreaView>
            <View style={{padding:20,borderBottomWidth:1,borderColor:t.cardB}}>
              <Text style={{fontSize:20,fontWeight:'900',color:t.text,marginBottom:4}}>🏆 BetTracker Pro</Text>
              <Text style={{fontSize:11,color:t.muted,marginBottom:14}}>{bets.length} bets tracked</Text>
              <View style={{flexDirection:'row',gap:6}}>
                {Object.entries({amoled:'⚫',dark:'🌙',light:'☀️'}).map(([k,icon])=>(
                  <TouchableOpacity key={k} onPress={()=>{setTheme(k);store.set('theme',k);}} style={{flex:1,backgroundColor:theme===k?'rgba(10,132,255,0.2)':'transparent',borderRadius:10,borderWidth:1,borderColor:theme===k?'rgba(10,132,255,0.4)':t.cardB,padding:8,alignItems:'center'}}>
                    <Text style={{fontSize:14,marginBottom:2}}>{icon}</Text>
                    <Text style={{fontSize:9,color:theme===k?'#0a84ff':t.sub,fontWeight:'700',textTransform:'capitalize'}}>{k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <ScrollView style={{padding:12}}>
              {[{icon:'📥',label:'Export CSV',fn:exportCSV}].map((item,i)=>(
                <TouchableOpacity key={i} onPress={()=>{item.fn();onClose();}} style={{flexDirection:'row',alignItems:'center',gap:14,padding:14,borderRadius:12}}>
                  <Text style={{fontSize:22,width:32,textAlign:'center'}}>{item.icon}</Text>
                  <Text style={{fontSize:14,fontWeight:'600',color:t.sub}}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [bets,setBets]       = useState([]);
  const [bookies,setBookies] = useState(BOOKIES);
  const [tab,setTab]         = useState(0);
  const [theme,setTheme]     = useState('amoled');
  const [showModal,setShowModal]   = useState(false);
  const [showQuick,setShowQuick]   = useState(false);
  const [showDrawer,setShowDrawer] = useState(false);
  const [showFab,setShowFab]       = useState(false);
  const [editBet,setEditBet]       = useState(null);
  const [toast,setToast]           = useState(null);
  const [loaded,setLoaded]         = useState(false);
  const t = THEMES[theme];

  // Load from storage
  useEffect(()=>{
    Promise.all([store.get('bets',[]),store.get('bookies',BOOKIES),store.get('theme','amoled')])
      .then(([b,bk,th])=>{setBets(b);setBookies(bk);setTheme(th);setLoaded(true);});
  },[]);

  useEffect(()=>{if(loaded)store.set('bets',bets);},[bets,loaded]);
  useEffect(()=>{if(loaded)store.set('bookies',bookies);},[bookies,loaded]);

  const showToast=(msg,type='success')=>setToast({msg,type});
  const handleSave=b=>{
    setBets(prev=>editBet?prev.map(x=>x.id===editBet.id?{...b,id:editBet.id}:x):[{...b,id:Date.now()},...prev]);
    setShowModal(false);setEditBet(null);
    showToast(editBet?'✏️ Bet updated!':'✅ Bet added!');
  };
  const handleEdit=bet=>{setEditBet(bet);setShowModal(true);};
  const handleDelete=id=>{setBets(prev=>prev.filter(b=>b.id!==id));showToast('🗑️ Bet deleted','warn');};
  const handleDuplicate=bet=>{setBets(prev=>[{...bet,id:Date.now(),date:today(),result:'pending',profit:0},...prev]);showToast('📋 Bet duplicated!');};
  const handleMarkResult=(id,result)=>{
    setBets(prev=>prev.map(b=>{if(b.id!==id)return b;const profit=result==='won'?Math.round(b.stake*(b.odds-1)):result==='lost'?-b.stake:0;return{...b,result,profit};}));
    showToast(result==='won'?'🎉 Marked as WON!':'❌ Marked as LOST',result==='won'?'success':'error');
  };

  if(!loaded) return (
    <View style={{flex:1,backgroundColor:'#000',justifyContent:'center',alignItems:'center'}}>
      <Text style={{fontSize:60,marginBottom:16}}>🏆</Text>
      <Text style={{color:'#fff',fontSize:20,fontWeight:'800'}}>BetTracker Pro</Text>
      <Text style={{color:'rgba(255,255,255,0.4)',fontSize:12,marginTop:6}}>Loading...</Text>
    </View>
  );

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={t.bg}/>
      <View style={{flex:1,backgroundColor:t.bg}}>
        {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

        {/* Main content */}
        <SafeAreaView style={{flex:1}} edges={['top']}>
          <View style={{flex:1,paddingHorizontal:14}}>
            {tab===0&&<Dashboard bets={bets} t={t}/>}
            {tab===1&&<BetsTab bets={bets} onEdit={handleEdit} onDelete={handleDelete} onDuplicate={handleDuplicate} onMarkResult={handleMarkResult} t={t}/>}
            {tab===2&&<StatsTab bets={bets} t={t}/>}
            {tab===3&&<CalendarTab bets={bets} t={t}/>}
            {tab===4&&<BankrollTab bets={bets} t={t}/>}
            {tab===5&&<CalcTab t={t}/>}
            {tab===6&&<ReportTab bets={bets} t={t} showToast={showToast}/>}
          </View>
        </SafeAreaView>

        {/* FAB menu */}
        {showFab&&(
          <>
            <TouchableOpacity style={{position:'absolute',inset:0,zIndex:200}} onPress={()=>setShowFab(false)}/>
            <View style={{position:'absolute',bottom:90,right:20,zIndex:300,gap:10}}>
              {[{icon:'⚡',label:'Quick Add',color:'#0a84ff',fn:()=>{setShowQuick(true);setShowFab(false);}},{icon:'➕',label:'Add Bet',color:'#30d158',fn:()=>{setEditBet(null);setShowModal(true);setShowFab(false);}}].map((item,i)=>(
                <View key={i} style={{flexDirection:'row',alignItems:'center',gap:10}}>
                  <View style={{backgroundColor:t.nav,borderRadius:10,borderWidth:1,borderColor:t.cardB,paddingHorizontal:12,paddingVertical:6}}>
                    <Text style={{color:t.text,fontSize:12,fontWeight:'700'}}>{item.label}</Text>
                  </View>
                  <TouchableOpacity onPress={item.fn} style={{width:46,height:46,borderRadius:14,backgroundColor:item.color,justifyContent:'center',alignItems:'center',shadowColor:item.color,shadowOpacity:0.5,shadowRadius:10}}>
                    <Text style={{fontSize:20}}>{item.icon}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Bottom nav */}
        <SafeAreaView edges={['bottom']} style={{backgroundColor:t.nav}}>
          <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:10,paddingVertical:6,borderTopWidth:1,borderColor:t.cardB,gap:8}}>
            <View style={{flex:1,flexDirection:'row',gap:1}}>
              {TABS.map(([icon,name],i)=>(
                <TouchableOpacity key={i} onPress={()=>setTab(i)} style={{flex:1,backgroundColor:tab===i?'rgba(10,132,255,0.22)':'transparent',borderRadius:14,paddingVertical:6,alignItems:'center',borderWidth:1,borderColor:tab===i?'rgba(10,132,255,0.32)':'transparent'}}>
                  <Text style={{fontSize:13}}>{icon}</Text>
                  <Text style={{fontSize:tab===i?8:7,color:tab===i?'#0a84ff':t.muted,fontWeight:tab===i?'700':'500'}}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{gap:5}}>
              <TouchableOpacity onPress={()=>setShowFab(p=>!p)} style={{width:48,height:48,borderRadius:14,backgroundColor:showFab?'rgba(255,69,58,0.9)':'#0a84ff',justifyContent:'center',alignItems:'center',shadowColor:'#0a84ff',shadowOpacity:0.5,shadowRadius:10}}>
                <Text style={{color:'#fff',fontSize:20}}>{showFab?'✕':'＋'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>setShowDrawer(true)} style={{width:48,height:30,borderRadius:10,backgroundColor:t.nav,borderWidth:1,borderColor:t.cardB,justifyContent:'center',alignItems:'center'}}>
                <Text style={{color:t.sub,fontSize:14}}>☰</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        <BetModal show={showModal} onClose={()=>{setShowModal(false);setEditBet(null);}} onSave={handleSave} editBet={editBet} t={t} bookies={bookies}/>
        <QuickAddModal show={showQuick} onClose={()=>setShowQuick(false)} onSave={b=>{setBets(prev=>[b,...prev]);showToast('⚡ Bet added!');}} t={t} bookies={bookies}/>
        <Drawer show={showDrawer} onClose={()=>setShowDrawer(false)} theme={theme} setTheme={setTheme} bets={bets} bookies={bookies} setBookies={setBookies} t={t} showToast={showToast}/>
      </View>
    </SafeAreaProvider>
  );
}
