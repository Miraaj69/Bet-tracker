import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const THEMES = {
  amoled: { bg:"#000", bg2:"#080808", card:"rgba(255,255,255,0.055)", cardB:"rgba(255,255,255,0.09)", text:"#fff", sub:"rgba(255,255,255,0.52)", muted:"rgba(255,255,255,0.28)", inp:"rgba(255,255,255,0.07)", inpB:"rgba(255,255,255,0.14)", nav:"rgba(0,0,0,0.94)", modal:"rgba(6,6,6,0.99)" },
  dark:   { bg:"linear-gradient(160deg,#0c0c1e 0%,#091525 55%,#0c0f1d 100%)", bg2:"#1a1a2e", card:"rgba(255,255,255,0.072)", cardB:"rgba(255,255,255,0.11)", text:"#fff", sub:"rgba(255,255,255,0.52)", muted:"rgba(255,255,255,0.3)", inp:"rgba(255,255,255,0.085)", inpB:"rgba(255,255,255,0.14)", nav:"rgba(8,8,20,0.94)", modal:"rgba(12,12,26,0.99)" },
  light:  { bg:"linear-gradient(160deg,#eef2ff 0%,#e6eeff 55%,#f2eeff 100%)", bg2:"#fff", card:"rgba(255,255,255,0.82)", cardB:"rgba(0,0,0,0.07)", text:"#08081a", sub:"rgba(0,0,0,0.52)", muted:"rgba(0,0,0,0.33)", inp:"rgba(0,0,0,0.045)", inpB:"rgba(0,0,0,0.1)", nav:"rgba(232,238,255,0.94)", modal:"rgba(246,249,255,0.99)" },
};

const SPORTS = {
  cricket: { icon:"🏏", name:"Cricket", color:"#30d158", markets:["Match Winner","Toss Winner","1st Innings Score","6 Over Score","10 Over Score","20 Over Score","Player Runs O/U","Fall of Wicket","Fours O/U","Sixes O/U","Man of Match"], teams:["MI","CSK","RCB","KKR","DC","SRH","PBKS","RR","GT","LSG","India","Australia","England","Pakistan","New Zealand","South Africa","West Indies"] },
  football: { icon:"⚽", name:"Football", color:"#0a84ff", markets:["Match Winner","BTTS","Total Goals O/U","Correct Score","First Goalscorer","Asian Handicap","Half Time Result","Clean Sheet","Double Chance"], teams:["Man City","Arsenal","Liverpool","Chelsea","Man United","Real Madrid","Barcelona","Bayern Munich","PSG","Juventus","Inter Milan"] },
  tennis: { icon:"🎾", name:"Tennis", color:"#ffd60a", markets:["Match Winner","Set Betting","Total Games O/U","First Set Winner","Handicap Games","Aces O/U","Double Faults O/U"], teams:["Djokovic","Alcaraz","Sinner","Medvedev","Zverev","Swiatek","Sabalenka","Gauff","Rybakina"] },
};

const RESULTS = ["pending","won","lost","void","half-won","half-lost"];
const BET_TYPES = ["Single","Double","Treble","Accumulator","System","Each Way","Asian Handicap","Live Bet","Lay Bet"];
const DEFAULT_BOOKIES = ["Betfair","Dream11","Parimatch","10Cric","Bet365","1xBet","Dafabet","Sportsbet.io","Stake","Unibet"];
const TABS = [["📊","Dash"],["🏆","Bets"],["📈","Stats"],["📅","Cal"],["💰","Bank"],["🧮","Calc"],["📋","Report"]];

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════════════════
const store = {
  get: (k, def) => { try { const v = localStorage.getItem("bt_" + k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem("bt_" + k, JSON.stringify(v)); } catch {} },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const fc = (n) => new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:0 }).format(n || 0);
const pct = (n, d=1) => (n || 0).toFixed(d) + "%";
const today = () => new Date().toISOString().slice(0, 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const getDOW = (ds) => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(ds).getDay()];
const getMon = (ds) => new Date(ds).toLocaleString("en-IN", { month:"short" });
const calcEV = (odds, stake, prob) => Math.round(stake * ((clamp(prob/100,0,1) * (odds-1)) - ((1 - clamp(prob/100,0,1)) * 1)));

function computeStats(bets) {
  const settled = bets.filter(b => ["won","lost","half-won","half-lost"].includes(b.result));
  const won = bets.filter(b => b.result === "won").length;
  const lost = bets.filter(b => b.result === "lost").length;
  const tPL = bets.reduce((s,b) => s + (b.profit||0), 0);
  const tStake = bets.reduce((s,b) => s + (b.stake||0), 0);
  const roi = tStake > 0 ? (tPL / tStake) * 100 : 0;
  const wr = settled.length > 0 ? (won / settled.length) * 100 : 0;
  const avgOdds = bets.length ? bets.reduce((s,b) => s+(b.odds||0), 0) / bets.length : 0;
  const avgStake = bets.length ? tStake / bets.length : 0;

  const ss = [...bets].filter(b => ["won","lost"].includes(b.result)).reverse();
  let curStreak = { c:0, tp:"-" };
  if (ss.length) { let c=1, tp=ss[0].result; for(let i=1;i<ss.length;i++){if(ss[i].result===tp)c++;else break;} curStreak={c,tp}; }

  let maxW=0,maxL=0,cw=0,cl=0;
  [...bets].filter(b=>["won","lost"].includes(b.result)).sort((a,b)=>new Date(a.date)-new Date(b.date))
    .forEach(b=>{if(b.result==="won"){cw++;cl=0;maxW=Math.max(maxW,cw);}else{cl++;cw=0;maxL=Math.max(maxL,cl);}});

  const sorted = [...bets].filter(b=>b.result!=="pending").sort((a,b)=>new Date(a.date)-new Date(b.date));
  let run=0, peak=0, maxDD=0;
  const runData = sorted.map(b => { run+=(b.profit||0); if(run>peak)peak=run; const dd=peak-run; if(dd>maxDD)maxDD=dd; return{date:b.date.slice(5),v:run}; });

  const profits = settled.map(b => b.profit||0);
  const mean = profits.length ? profits.reduce((s,v)=>s+v,0)/profits.length : 0;
  const variance = profits.length ? profits.reduce((s,v)=>s+Math.pow(v-mean,2),0)/profits.length : 0;
  const stdDev = Math.sqrt(variance);
  const winRate2 = settled.length > 0 ? won/settled.length : 0.5;
  const b_ = (avgOdds||2) - 1;
  const kelly = b_ > 0 ? ((winRate2*b_ - (1-winRate2)) / b_) * 100 : 0;

  return { settled, won, lost, tPL, tStake, roi, wr, avgOdds, avgStake, curStreak, maxW, maxL, runData, maxDD, stdDev, kelly };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════
function Glass({ t, children, style={}, onClick }) {
  return (
    <div onClick={onClick} style={{ background:t.card, backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)", border:`1px solid ${t.cardB}`, borderRadius:20, boxShadow:"0 2px 20px rgba(0,0,0,0.1),inset 0 1px 0 rgba(255,255,255,0.06)", padding:"16px 18px", ...style }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, color, icon, t, wide }) {
  const [vis, setVis] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if(e.isIntersecting){setVis(true);obs.disconnect();} }, { threshold:0.2 });
    if(ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ background:t.card, backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)", border:`1px solid ${t.cardB}`, borderRadius:22, padding:wide?"22px 24px":"20px 18px", flex:wide?2:1, minWidth:wide?200:130, position:"relative", overflow:"hidden", opacity:vis?1:0, transform:vis?"translateY(0)":"translateY(14px)", transition:"opacity 0.4s ease, transform 0.4s ease", boxShadow:"0 4px 24px rgba(0,0,0,0.12)" }}>
      <div style={{ position:"absolute", top:-8, right:-8, fontSize:50, opacity:0.06, lineHeight:1 }}>{icon}</div>
      <div style={{ fontSize:10, color:t.muted, letterSpacing:0.8, textTransform:"uppercase", marginBottom:8, fontWeight:700 }}>{label}</div>
      <div style={{ fontSize:wide?30:24, fontWeight:800, color, letterSpacing:-0.8, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:t.sub, marginTop:6, fontWeight:500 }}>{sub}</div>}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${color}70,transparent)` }} />
    </div>
  );
}

function Stars({ value, onChange, t, size=14 }) {
  return (
    <div style={{ display:"flex", gap:2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} onClick={() => onChange && onChange(i===value?0:i)} style={{ fontSize:size, cursor:onChange?"pointer":"default", color:"#ffd60a", opacity:i<=value?1:0.22, transition:"opacity 0.1s" }}>★</span>
      ))}
    </div>
  );
}

function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  const bg = type==="success" ? "linear-gradient(135deg,#30d158,#248a3d)" : type==="warn" ? "linear-gradient(135deg,#ff9f0a,#c93)" : "linear-gradient(135deg,#ff453a,#c00)";
  return <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", zIndex:9999, background:bg, color:"#fff", borderRadius:16, padding:"11px 22px", fontSize:13, fontWeight:700, boxShadow:"0 8px 32px rgba(0,0,0,0.35)", whiteSpace:"nowrap", animation:"fadeDown 0.3s ease" }}>{msg}</div>;
}

function SectionHead({ title, sub, t, action }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
      <div>
        <div style={{ fontSize:13, fontWeight:800, color:t.text, letterSpacing:-0.2 }}>{title}</div>
        {sub && <div style={{ fontSize:10, color:t.muted, marginTop:2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

function LineChart({ data, t, height:h=80 }) {
  if (!data || data.length < 2) return <div style={{ color:t.muted, textAlign:"center", padding:"20px 0", fontSize:11 }}>Add more bets to see chart</div>;
  const vals = data.map(d => d.v);
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const range = mx - mn || 1;
  const W=300, H=h;
  const px = (i) => (i/(data.length-1))*W;
  const py = (v) => H - clamp(((v-mn)/range)*H*0.88+H*0.06, 2, H-2);
  const pts = data.map((d,i) => `${px(i)},${py(d.v)}`).join(" ");
  const lastV = vals[vals.length-1];
  const lc = lastV >= 0 ? "#30d158" : "#ff453a";
  return (
    <div style={{ width:"100%", overflowX:"auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:h, display:"block" }}>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lc} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lc} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {mn<0&&mx>0&&<line x1="0" y1={py(0)} x2={W} y2={py(0)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3,3"/>}
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#lg)" />
        <polyline points={pts} fill="none" stroke={lc} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.length<=30&&data.map((d,i)=><circle key={i} cx={px(i)} cy={py(d.v)} r="2.5" fill={lc} opacity="0.7"/>)}
      </svg>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
        <span style={{ fontSize:8, color:t.muted }}>{data[0]?.date}</span>
        <span style={{ fontSize:9, fontWeight:700, color:lc }}>{lastV>=0?"+":""}{fc(lastV)}</span>
        <span style={{ fontSize:8, color:t.muted }}>{data[data.length-1]?.date}</span>
      </div>
    </div>
  );
}

function BarChart({ data, labelKey, valueKey, t, height:h=72 }) {
  if (!data || !data.length) return <div style={{ color:t.muted, textAlign:"center", padding:"16px 0", fontSize:11 }}>No data yet</div>;
  const mx = Math.max(...data.map(d => Math.abs(d[valueKey])), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:h }}>
      {data.map((d,i) => {
        const v=d[valueKey], barH=Math.max(3, (Math.abs(v)/mx)*(h-14));
        const col = v>=0 ? "rgba(48,209,88,0.85)" : "rgba(255,69,58,0.85)";
        return (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <div style={{ fontSize:7, color:t.muted, fontWeight:600 }}>{v>=0?"+":""}{Math.abs(v)>999?Math.round(v/1000)+"k":Math.round(v)}</div>
            <div style={{ width:"100%", height:barH, background:col, borderRadius:"4px 4px 2px 2px", transition:"height 0.3s ease" }} />
            <div style={{ fontSize:7, color:t.muted, whiteSpace:"nowrap" }}>{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BET MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function BetModal({ show, onClose, onSave, editBet, t, bookies }) {
  const blank = { date:today(), sport:"cricket", match:"", market:"Match Winner", selection:"", odds:"", stake:"", result:"pending", profit:"", bookie:bookies[0]||"Betfair", notes:"", confidence:3, livebet:false, betType:"Single", estWinProb:"", tags:[] };
  const [form, setForm] = useState(blank);
  const [sug, setSug] = useState([]);

  useEffect(() => {
    if (show) setForm(editBet ? { ...blank, ...editBet, odds:String(editBet.odds), stake:String(editBet.stake), profit:String(editBet.profit||""), estWinProb:String(editBet.estWinProb||""), tags:editBet.tags||[] } : { ...blank, stake:store.get("lastStake",""), bookie:store.get("lastBookie",bookies[0]||"Betfair") });
  }, [show]);

  const calcP = (r,s,o) => { const sv=parseFloat(s),ov=parseFloat(o); if(!sv||!ov)return""; if(r==="won")return String(Math.round(sv*(ov-1))); if(r==="lost")return String(-sv); if(r==="half-won")return String(Math.round(sv*(ov-1)/2)); if(r==="half-lost")return String(-Math.round(sv/2)); return""; };
  const ch = (k,v) => { const u={...form,[k]:v}; if(["result","stake","odds"].includes(k))u.profit=calcP(u.result,u.stake,u.odds); if(k==="sport"){u.market=SPORTS[v].markets[0];u.match="";u.selection="";} setForm(u); };
  const sport = SPORTS[form.sport];
  const implP = parseFloat(form.odds)>0 ? Math.round(100/parseFloat(form.odds)) : null;
  const ev = parseFloat(form.stake)&&parseFloat(form.odds)&&parseFloat(form.estWinProb) ? calcEV(parseFloat(form.odds),parseFloat(form.stake),parseFloat(form.estWinProb)) : null;

  const handleMatch = (v) => {
    ch("match",v);
    const all = sport.teams.flatMap(a=>sport.teams.filter(b=>b!==a).map(b=>`${a} vs ${b}`));
    setSug(v.length>1 ? all.filter(s=>s.toLowerCase().includes(v.toLowerCase())).slice(0,5) : []);
  };

  if (!show) return null;
  const iS = { width:"100%", background:t.inp, border:`1px solid ${t.inpB}`, borderRadius:11, color:t.text, fontSize:13, padding:"9px 12px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
  const lS = { fontSize:9, color:t.muted, marginBottom:4, display:"block", textTransform:"uppercase", letterSpacing:0.6, fontWeight:700 };
  const dropStyle = { position:"absolute", top:"100%", left:0, right:0, background:t.modal, border:`1px solid ${t.cardB}`, borderRadius:12, zIndex:20, marginTop:3, overflow:"hidden", boxShadow:"0 8px 28px rgba(0,0,0,0.35)" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(18px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{ background:t.modal, backdropFilter:"blur(48px)", WebkitBackdropFilter:"blur(48px)", border:`1px solid ${t.cardB}`, borderRadius:26, padding:22, width:"100%", maxWidth:520, boxShadow:"0 40px 100px rgba(0,0,0,0.55)", maxHeight:"92vh", overflowY:"auto", animation:"popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:t.text }}>{editBet?"✏️ Edit Bet":"➕ New Bet"}</div>
            <div style={{ fontSize:10, color:t.muted, marginTop:1 }}>Fill in the details below</div>
          </div>
          <button onClick={onClose} style={{ background:t.inp, border:`1px solid ${t.inpB}`, borderRadius:50, color:t.sub, width:30, height:30, cursor:"pointer", fontSize:14 }}>✕</button>
        </div>

        {/* Sport */}
        <div style={{ display:"flex", gap:6, marginBottom:16 }}>
          {Object.entries(SPORTS).map(([k,v]) => (
            <button key={k} onClick={()=>ch("sport",k)} style={{ flex:1, background:form.sport===k?`${v.color}25`:t.inp, border:`1px solid ${form.sport===k?v.color+"60":t.inpB}`, borderRadius:12, color:form.sport===k?v.color:t.sub, padding:"10px 4px", cursor:"pointer", fontSize:12, fontWeight:700, transition:"all 0.15s" }}>
              <div style={{ fontSize:18, marginBottom:2 }}>{v.icon}</div>
              <div style={{ fontSize:9 }}>{v.name}</div>
            </button>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div><label style={lS}>Date</label><input type="date" value={form.date} onChange={e=>ch("date",e.target.value)} style={iS}/></div>
          <div><label style={lS}>Bet Type</label><select value={form.betType} onChange={e=>ch("betType",e.target.value)} style={{...iS,appearance:"none"}}>{BET_TYPES.map(b=><option key={b}>{b}</option>)}</select></div>

          <div style={{ gridColumn:"1/-1", position:"relative" }}>
            <label style={lS}>Match / Event</label>
            <input value={form.match} onChange={e=>handleMatch(e.target.value)} onBlur={()=>setTimeout(()=>setSug([]),160)} style={iS} placeholder={`${sport.teams[0]} vs ${sport.teams[1]}`}/>
            {sug.length>0&&<div style={dropStyle}>{sug.map((s,i)=><div key={i} onClick={()=>{ch("match",s);setSug([]);}} style={{ padding:"9px 14px", cursor:"pointer", fontSize:12, color:t.text, borderBottom:i<sug.length-1?`1px solid ${t.cardB}`:"none" }}>{sport.icon} {s}</div>)}</div>}
          </div>

          <div style={{ gridColumn:"1/-1" }}><label style={lS}>Market</label><select value={form.market} onChange={e=>ch("market",e.target.value)} style={{...iS,appearance:"none"}}>{sport.markets.map(m=><option key={m}>{m}</option>)}</select></div>
          <div style={{ gridColumn:"1/-1" }}><label style={lS}>Selection / Pick</label><input value={form.selection} onChange={e=>ch("selection",e.target.value)} style={iS} placeholder="Who/what are you backing?"/></div>

          <div>
            <label style={lS}>Odds</label>
            <input type="number" step="0.01" value={form.odds} onChange={e=>ch("odds",e.target.value)} style={iS} placeholder="2.00"/>
            {implP&&<div style={{ fontSize:9, color:t.muted, marginTop:3 }}>Implied: {implP}%</div>}
          </div>
          <div><label style={lS}>Stake (₹)</label><input type="number" value={form.stake} onChange={e=>ch("stake",e.target.value)} style={iS} placeholder="500"/></div>

          <div>
            <label style={lS}>Est. Win Prob % (EV)</label>
            <input type="number" min="0" max="100" value={form.estWinProb} onChange={e=>ch("estWinProb",e.target.value)} style={iS} placeholder="55"/>
            {ev!==null&&<div style={{ fontSize:9, marginTop:3, fontWeight:700, color:ev>=0?"#30d158":"#ff453a" }}>EV: {ev>=0?"+":""}{fc(ev)}</div>}
          </div>
          <div><label style={lS}>Result</label><select value={form.result} onChange={e=>ch("result",e.target.value)} style={{...iS,appearance:"none"}}>{RESULTS.map(r=><option key={r}>{r}</option>)}</select></div>
          <div><label style={lS}>P&L (₹)</label><input type="number" value={form.profit} onChange={e=>ch("profit",e.target.value)} style={{...iS,color:parseFloat(form.profit||0)>=0?"#30d158":"#ff453a"}} placeholder="Auto-calc"/></div>
          <div style={{ gridColumn:"1/-1" }}><label style={lS}>Bookie</label><select value={form.bookie} onChange={e=>ch("bookie",e.target.value)} style={{...iS,appearance:"none"}}>{bookies.map(b=><option key={b}>{b}</option>)}</select></div>

          <div style={{ gridColumn:"1/-1" }}>
            <label style={lS}>Confidence</label>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:4 }}>
              <Stars value={form.confidence} onChange={v=>ch("confidence",v)} t={t}/>
              <span style={{ fontSize:10, color:t.muted }}>{["","Very Low","Low","Medium","High","Very High"][form.confidence]||"None"}</span>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <input type="checkbox" id="lb" checked={form.livebet} onChange={e=>ch("livebet",e.target.checked)} style={{ width:16, height:16, cursor:"pointer", accentColor:"#ff453a" }}/>
            <label htmlFor="lb" style={{ fontSize:11, color:"#ff453a", fontWeight:700, cursor:"pointer" }}>🔴 Live / In-Play</label>
          </div>
          <div style={{ gridColumn:"1/-1" }}><label style={lS}>Notes</label><input value={form.notes} onChange={e=>ch("notes",e.target.value)} style={iS} placeholder="Strategy, reason, observations..."/></div>
        </div>

        <div style={{ display:"flex", gap:9, marginTop:18 }}>
          <button onClick={onClose} style={{ flex:1, background:t.inp, border:`1px solid ${t.inpB}`, borderRadius:14, color:t.sub, padding:"12px", fontSize:13, cursor:"pointer", fontWeight:600 }}>Cancel</button>
          <button onClick={() => { store.set("lastStake",form.stake); store.set("lastBookie",form.bookie); onSave({ ...form, odds:parseFloat(form.odds)||0, stake:parseFloat(form.stake)||0, profit:parseFloat(form.profit)||0, estWinProb:parseFloat(form.estWinProb)||0, tags:form.tags||[] }); }} style={{ flex:2, background:`linear-gradient(135deg,${SPORTS[form.sport].color},${SPORTS[form.sport].color}aa)`, border:"none", borderRadius:14, color:"#fff", padding:"12px", fontSize:14, fontWeight:800, cursor:"pointer", boxShadow:`0 4px 20px ${SPORTS[form.sport].color}40` }}>
            {editBet?"Save Changes":`Add ${sport.icon} Bet`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK ADD
// ═══════════════════════════════════════════════════════════════════════════════
function QuickAddModal({ show, onClose, onSave, t, bookies }) {
  const [form, setForm] = useState({ sport:"cricket", match:"", odds:"", stake:store.get("lastStake",""), bookie:store.get("lastBookie",bookies[0]||"Betfair") });
  const ch = (k,v) => setForm(f=>({...f,[k]:v}));
  if (!show) return null;
  const iS = { width:"100%", background:t.inp, border:`1px solid ${t.inpB}`, borderRadius:11, color:t.text, fontSize:14, padding:"11px 13px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(18px)", zIndex:1000, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:12 }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{ background:t.modal, border:`1px solid ${t.cardB}`, borderRadius:26, padding:22, width:"100%", maxWidth:480, boxShadow:"0 40px 100px rgba(0,0,0,0.55)", marginBottom:8, animation:"slideUp 0.38s cubic-bezier(0.34,1.4,0.64,1)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:800, color:t.text }}>⚡ Quick Add</div>
          <div style={{ display:"flex", gap:4 }}>
            {Object.entries(SPORTS).map(([k,v]) => <button key={k} onClick={()=>ch("sport",k)} style={{ background:form.sport===k?`${v.color}30`:t.inp, border:`1px solid ${form.sport===k?v.color+"50":t.inpB}`, borderRadius:9, padding:"5px 10px", cursor:"pointer", fontSize:13 }}>{v.icon}</button>)}
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
          <input value={form.match} onChange={e=>ch("match",e.target.value)} style={iS} placeholder={`Match — e.g. ${SPORTS[form.sport].teams[0]} vs ${SPORTS[form.sport].teams[1]}`}/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
            <input type="number" step="0.01" value={form.odds} onChange={e=>ch("odds",e.target.value)} style={iS} placeholder="Odds 2.00"/>
            <input type="number" value={form.stake} onChange={e=>ch("stake",e.target.value)} style={iS} placeholder="Stake ₹"/>
          </div>
          <select value={form.bookie} onChange={e=>ch("bookie",e.target.value)} style={{...iS,appearance:"none"}}>{bookies.map(b=><option key={b}>{b}</option>)}</select>
        </div>
        <button onClick={() => { if(!form.match||!form.odds||!form.stake)return; onSave({ id:Date.now(), date:today(), sport:form.sport, match:form.match, market:SPORTS[form.sport].markets[0], selection:form.match, odds:parseFloat(form.odds), stake:parseFloat(form.stake), result:"pending", profit:0, bookie:form.bookie, notes:"", confidence:3, livebet:false, betType:"Single", estWinProb:0, tags:[] }); onClose(); }} style={{ width:"100%", marginTop:14, background:"linear-gradient(135deg,#0a84ff,#0055cc)", border:"none", borderRadius:14, color:"#fff", padding:"13px", fontSize:14, fontWeight:800, cursor:"pointer", boxShadow:"0 4px 20px rgba(10,132,255,0.4)" }}>
          ⚡ Add Bet Instantly
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard({ bets, t }) {
  const stats = useMemo(() => computeStats(bets), [bets]);
  const { won, lost, tPL, tStake, roi, wr, avgOdds, curStreak, runData, maxDD, stdDev, kelly, maxW, maxL } = stats;
  const plC = tPL >= 0 ? "#30d158" : "#ff453a";
  const pending = bets.filter(b=>b.result==="pending").length;
  const todayBets = bets.filter(b=>b.date===today());
  const todayPL = todayBets.reduce((s,b)=>s+(b.profit||0),0);

  if (bets.length === 0) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 20px", textAlign:"center", animation:"fadeUp 0.4s ease" }}>
      <div style={{ fontSize:80, marginBottom:16, animation:"pulse 2s infinite" }}>🏏</div>
      <div style={{ fontSize:22, fontWeight:900, color:t.text, marginBottom:8 }}>No bets yet</div>
      <div style={{ fontSize:13, color:t.muted, lineHeight:1.8, marginBottom:24 }}>Track your first bet to see stats,<br/>streaks and insights here</div>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
        <div style={{ background:"rgba(10,132,255,0.1)", border:"1px solid rgba(10,132,255,0.25)", borderRadius:14, padding:"12px 18px", fontSize:12, color:"#0a84ff", fontWeight:700 }}><div style={{ fontSize:20, marginBottom:4 }}>➕</div>Add Bet — tap + below</div>
        <div style={{ background:"rgba(48,209,88,0.1)", border:"1px solid rgba(48,209,88,0.25)", borderRadius:14, padding:"12px 18px", fontSize:12, color:"#30d158", fontWeight:700 }}><div style={{ fontSize:20, marginBottom:4 }}>⚡</div>Quick — fast entry</div>
      </div>
    </div>
  );

  const strC = curStreak.tp==="won"?"#30d158":curStreak.tp==="lost"?"#ff453a":"#636366";

  return (
    <div style={{ animation:"fadeUp 0.35s ease" }}>
      {/* Today quick bar */}
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        {[{label:"Today",value:todayBets.length+" bets",sub:todayPL>=0?`+${fc(todayPL)}`:fc(todayPL),color:todayPL>=0?"#30d158":"#ff453a"},{label:"Pending",value:pending,sub:"to settle",color:"#ffd60a"},{label:"All Time",value:bets.length,sub:"total bets",color:"#0a84ff"}].map((item,i)=>(
          <div key={i} style={{ flex:1, background:t.card, backdropFilter:"blur(20px)", border:`1px solid ${t.cardB}`, borderRadius:14, padding:"10px 12px", textAlign:"center" }}>
            <div style={{ fontSize:8, color:t.muted, textTransform:"uppercase", letterSpacing:0.5, fontWeight:700, marginBottom:4 }}>{item.label}</div>
            <div style={{ fontSize:16, fontWeight:900, color:item.color, lineHeight:1, marginBottom:2 }}>{item.value}</div>
            <div style={{ fontSize:9, color:t.muted }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Hero P&L */}
      <div style={{ background:`linear-gradient(135deg,${plC}18,${plC}08)`, backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)", border:`1px solid ${plC}35`, borderRadius:26, padding:"24px 26px", marginBottom:14, position:"relative", overflow:"hidden", boxShadow:`0 8px 40px ${plC}20` }}>
        <div style={{ position:"absolute", top:-20, right:-20, fontSize:120, opacity:0.04 }}>💰</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
          <div>
            <div style={{ fontSize:10, color:t.muted, letterSpacing:1, textTransform:"uppercase", fontWeight:700, marginBottom:10 }}>Total Profit / Loss</div>
            <div style={{ fontSize:48, fontWeight:900, color:plC, letterSpacing:-2, lineHeight:1 }}>{tPL>=0?"+":""}{fc(tPL)}</div>
            <div style={{ display:"flex", gap:16, marginTop:10, flexWrap:"wrap" }}>
              <div><span style={{ fontSize:11, color:t.muted }}>ROI </span><span style={{ fontSize:13, fontWeight:700, color:plC }}>{pct(roi)}</span></div>
              <div><span style={{ fontSize:11, color:t.muted }}>Staked </span><span style={{ fontSize:13, fontWeight:700, color:t.sub }}>{fc(tStake)}</span></div>
            </div>
          </div>
          <div style={{ background:plC+"22", border:`1px solid ${plC}44`, borderRadius:14, padding:"8px 16px", textAlign:"center" }}>
            <div style={{ fontSize:9, color:t.muted, textTransform:"uppercase", letterSpacing:0.6, marginBottom:3 }}>Win Rate</div>
            <div style={{ fontSize:28, fontWeight:900, color:plC }}>{pct(wr,0)}</div>
            <div style={{ fontSize:10, color:t.muted }}>{won}W · {lost}L · {pending}⏳</div>
          </div>
        </div>
      </div>

      {/* Streak banner */}
      {curStreak.c > 1 && (
        <div style={{ background:`linear-gradient(135deg,${strC}20,${strC}08)`, border:`1px solid ${strC}40`, borderRadius:16, padding:"10px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:26 }}>{curStreak.tp==="won"?"🔥":"💀"}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:800, color:strC }}>{curStreak.c} {curStreak.tp==="won"?"Win":"Loss"} Streak!</div>
            <div style={{ fontSize:10, color:t.muted }}>{curStreak.tp==="won"?"Keep it up! You're on fire 🔥":"Take a break, review your strategy"}</div>
          </div>
          <div style={{ background:strC+"25", border:`1px solid ${strC}50`, borderRadius:10, padding:"6px 12px", textAlign:"center" }}>
            <div style={{ fontSize:20, fontWeight:900, color:strC, lineHeight:1 }}>{curStreak.c}</div>
            <div style={{ fontSize:8, color:t.muted, textTransform:"uppercase" }}>streak</div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
        <StatCard label="Avg Odds" value={avgOdds.toFixed(2)} sub="Per bet" color="#bf5af2" icon="📊" t={t}/>
        <StatCard label="Best Streak" value={`${maxW}🔥`} sub="Wins in row" color="#30d158" icon="⚡" t={t}/>
        <StatCard label="Worst Streak" value={`${maxL}💀`} sub="Losses in row" color="#ff453a" icon="📉" t={t}/>
      </div>

      {/* Running P&L chart */}
      {runData.length >= 2 && (
        <Glass t={t} style={{ marginBottom:14 }}>
          <SectionHead title="📈 Running P&L" sub={`Max Drawdown: ${fc(maxDD)}`} t={t}/>
          <LineChart data={runData} t={t} height={100}/>
        </Glass>
      )}

      {/* Risk metrics */}
      {bets.length >= 5 && (
        <Glass t={t} style={{ marginBottom:14 }}>
          <SectionHead title="📐 Risk Metrics" t={t}/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {[["Std Dev",fc(stdDev),"Volatility","#ff9f0a"],["Max Drawdown",fc(maxDD),"From peak","#ff453a"],["Kelly %",pct(Math.max(0,kelly)),"Suggested size","#0a84ff"]].map(([l,v,s,c])=>(
              <div key={l} style={{ background:t.inp, border:`1px solid ${t.inpB}`, borderRadius:14, padding:"12px 12px" }}>
                <div style={{ fontSize:9, color:t.muted, textTransform:"uppercase", marginBottom:5, fontWeight:700 }}>{l}</div>
                <div style={{ fontSize:16, fontWeight:800, color:c, marginBottom:2 }}>{v}</div>
                <div style={{ fontSize:9, color:t.muted }}>{s}</div>
              </div>
            ))}
          </div>
        </Glass>
      )}

      {/* Recent bets */}
      {bets.length > 0 && (
        <Glass t={t}>
          <SectionHead title="⚡ Recent Bets" sub="Last 3" t={t}/>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {bets.slice(0,3).map((b,i) => {
              const rc = b.result==="won"?"#30d158":b.result==="lost"?"#ff453a":b.result==="pending"?"#ffd60a":"#636366";
              return (
                <div key={b.id} style={{ display:"flex", alignItems:"center", gap:12, background:t.inp, border:`1px solid ${t.cardB}`, borderLeft:`3px solid ${rc}`, borderRadius:12, padding:"10px 14px", animation:`fadeUp 0.3s ease ${i*0.06}s both` }}>
                  <span style={{ fontSize:18 }}>{SPORTS[b.sport]?.icon||"🎲"}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:t.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.match}</div>
                    <div style={{ fontSize:10, color:t.muted }}>{b.selection} @ {b.odds} · {b.date}</div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:(b.profit||0)>=0?"#30d158":"#ff453a" }}>{(b.profit||0)>=0?"+":""}{fc(b.profit||0)}</div>
                    <div style={{ fontSize:9, background:rc+"22", color:rc, borderRadius:6, padding:"1px 6px", fontWeight:700, textTransform:"uppercase" }}>{b.result}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Glass>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BETS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function BetsTab({ bets, onEdit, onDelete, onDuplicate, onMarkResult, t }) {
  const [filter, setFilter] = useState("all");
  const [sport, setSport] = useState("all");
  const [sort, setSort] = useState("date");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => bets
    .filter(b => filter==="all"||b.result===filter)
    .filter(b => sport==="all"||b.sport===sport)
    .filter(b => !search||[b.match,b.selection,b.bookie||"",b.market].some(v=>v&&v.toLowerCase().includes(search.toLowerCase())))
    .sort((a,b) => sort==="date"?new Date(b.date)-new Date(a.date):sort==="profit"?(b.profit||0)-(a.profit||0):b.odds-a.odds)
  , [bets,filter,sport,sort,search]);

  const iS = { width:"100%", background:t.inp, border:`1px solid ${t.inpB}`, borderRadius:10, color:t.text, fontSize:12, padding:"9px 12px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" };

  return (
    <div>
      <Glass t={t} style={{ marginBottom:12 }}>
        <div style={{ display:"flex", gap:5, marginBottom:10, flexWrap:"wrap" }}>
          {[["all","All"],,...Object.entries(SPORTS).map(([k,v])=>[k,v.icon+" "+v.name])].map(([k,label])=>(
            <button key={k} onClick={()=>setSport(k)} style={{ background:sport===k?"rgba(10,132,255,0.22)":t.inp, border:`1px solid ${sport===k?"rgba(10,132,255,0.5)":t.inpB}`, borderRadius:9, color:sport===k?"#0a84ff":t.sub, padding:"5px 11px", fontSize:10, fontWeight:700, cursor:"pointer" }}>{label} ({k==="all"?bets.length:bets.filter(b=>b.sport===k).length})</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:4, marginBottom:10, flexWrap:"wrap" }}>
          {["all","pending","won","lost","void"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?"rgba(10,132,255,0.22)":t.inp, border:`1px solid ${filter===f?"rgba(10,132,255,0.5)":t.inpB}`, borderRadius:8, color:filter===f?"#0a84ff":t.sub, padding:"4px 9px", fontSize:9, fontWeight:700, cursor:"pointer", textTransform:"capitalize" }}>{f} ({f==="all"?bets.length:bets.filter(b=>b.result===f).length})</button>
          ))}
          <select value={sort} onChange={e=>setSort(e.target.value)} style={{ marginLeft:"auto", background:t.inp, border:`1px solid ${t.inpB}`, borderRadius:8, color:t.sub, padding:"4px 9px", fontSize:9, outline:"none" }}>
            <option value="date">Date ↓</option><option value="profit">P&L ↓</option><option value="odds">Odds ↓</option>
          </select>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search match, pick, bookie..." style={iS}/>
      </Glass>

      {filtered.length === 0
        ? <div style={{ textAlign:"center", padding:"56px 0", color:t.muted }}><div style={{ fontSize:40, marginBottom:10 }}>🏆</div><div style={{ fontSize:13 }}>No bets found</div></div>
        : filtered.map((b,i) => {
          const rc = b.result==="won"?"#30d158":b.result==="lost"?"#ff453a":b.result==="pending"?"#ffd60a":b.result==="void"?"#636366":"#34aadc";
          const pc = (b.profit||0)>=0?"#30d158":"#ff453a";
          return (
            <div key={b.id} style={{ background:t.card, backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", border:`1px solid ${t.cardB}`, borderRadius:18, padding:"14px 16px", marginBottom:10, boxShadow:"0 4px 20px rgba(0,0,0,0.12)", position:"relative", overflow:"hidden", animation:`fadeUp 0.3s ease ${i*0.04}s both` }}>
              <div style={{ position:"absolute", left:0, top:0, bottom:0, width:4, background:`linear-gradient(180deg,${rc},${rc}88)`, borderRadius:"18px 0 0 18px" }}/>
              <div style={{ paddingLeft:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ flex:1, minWidth:0, paddingRight:10 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                      <span style={{ fontSize:16 }}>{SPORTS[b.sport]?.icon||"🎲"}</span>
                      <span style={{ fontSize:13, fontWeight:800, color:t.text }}>{b.match}</span>
                    </div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      <span style={{ background:rc+"22", border:`1px solid ${rc}44`, borderRadius:8, color:rc, fontSize:9, fontWeight:800, padding:"2px 8px", textTransform:"uppercase" }}>{b.result}</span>
                      {b.livebet&&<span style={{ background:"rgba(255,69,58,0.2)", border:"1px solid rgba(255,69,58,0.4)", borderRadius:8, color:"#ff453a", fontSize:9, fontWeight:800, padding:"2px 8px" }}>🔴 LIVE</span>}
                      {b.bookie&&<span style={{ background:t.inp, border:`1px solid ${t.cardB}`, borderRadius:8, color:t.muted, fontSize:9, padding:"2px 8px" }}>{b.bookie}</span>}
                    </div>
                  </div>
                  <div style={{ background:pc+"18", border:`1px solid ${pc}35`, borderRadius:12, padding:"8px 12px", textAlign:"center", flexShrink:0 }}>
                    <div style={{ fontSize:18, fontWeight:900, color:pc, letterSpacing:-0.5, lineHeight:1 }}>{(b.profit||0)>=0?"+":""}{fc(b.profit||0)}</div>
                    <div style={{ fontSize:8, color:t.muted, fontWeight:600, textTransform:"uppercase", marginTop:2 }}>P&L</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:12, marginBottom:8, flexWrap:"wrap" }}>
                  {[["Pick",b.selection||"—","#0a84ff"],["Odds",b.odds,"#ffd60a"],["Stake",fc(b.stake),t.sub],["Market",b.market,t.muted]].map(([l,v,c])=>(
                    <div key={l}><div style={{ fontSize:8, color:t.muted, textTransform:"uppercase", marginBottom:2, fontWeight:700 }}>{l}</div><div style={{ fontSize:11, color:c, fontWeight:700, maxWidth:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v}</div></div>
                  ))}
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:9, color:t.muted }}>📅 {b.date}</span>
                    <Stars value={b.confidence||0} t={t} size={10}/>
                  </div>
                  <div style={{ display:"flex", gap:5 }}>
                    {b.result==="pending"&&<><button onClick={()=>onMarkResult(b.id,"won")} style={{ background:"rgba(48,209,88,0.15)", border:"1px solid rgba(48,209,88,0.3)", borderRadius:8, color:"#30d158", fontSize:10, padding:"5px 10px", cursor:"pointer", fontWeight:700 }}>✓ Won</button><button onClick={()=>onMarkResult(b.id,"lost")} style={{ background:"rgba(255,69,58,0.15)", border:"1px solid rgba(255,69,58,0.3)", borderRadius:8, color:"#ff453a", fontSize:10, padding:"5px 10px", cursor:"pointer", fontWeight:700 }}>✗ Lost</button></>}
                    <button onClick={()=>onEdit(b)} style={{ background:"rgba(10,132,255,0.15)", border:"1px solid rgba(10,132,255,0.28)", borderRadius:8, color:"#0a84ff", fontSize:10, padding:"5px 10px", cursor:"pointer", fontWeight:700 }}>✏️</button>
                    <button onClick={()=>onDuplicate(b)} style={{ background:"rgba(191,90,242,0.15)", border:"1px solid rgba(191,90,242,0.28)", borderRadius:8, color:"#bf5af2", fontSize:10, padding:"5px 10px", cursor:"pointer", fontWeight:700 }}>📋</button>
                    <button onClick={()=>onDelete(b.id)} style={{ background:"rgba(255,69,58,0.15)", border:"1px solid rgba(255,69,58,0.28)", borderRadius:8, color:"#ff453a", fontSize:10, padding:"5px 10px", cursor:"pointer", fontWeight:700 }}>🗑️</button>
                  </div>
                </div>
                {b.notes&&<div style={{ marginTop:7, fontSize:10, color:t.sub, fontStyle:"italic", background:t.inp, borderRadius:8, padding:"5px 10px" }}>📝 {b.notes}</div>}
              </div>
            </div>
          );
        })
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function StatsTab({ bets, t }) {
  const [sf, setSf] = useState("all");
  const fb = sf==="all" ? bets : bets.filter(b=>b.sport===sf);
  const stats = useMemo(() => computeStats(fb), [fb]);

  const mMap={}, dMap={Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0};
  fb.forEach(b => { const m=getMon(b.date); if(!mMap[m])mMap[m]=0; mMap[m]+=(b.profit||0); dMap[getDOW(b.date)]+=(b.profit||0); });
  const monthData = Object.entries(mMap).map(([label,value])=>({label,value}));
  const dowData = Object.entries(dMap).map(([label,value])=>({label,value}));

  const oR = [{label:"1.0-1.5",min:1,max:1.5},{label:"1.5-2.0",min:1.5,max:2},{label:"2.0-3.0",min:2,max:3},{label:"3.0+",min:3,max:99}];
  const oddsData = oR.map(r => { const rb=fb.filter(b=>b.odds>=r.min&&b.odds<r.max); return{label:r.label,value:rb.reduce((s,b)=>s+(b.profit||0),0),count:rb.length}; });

  const bkMap = {};
  fb.forEach(b => { const bk=b.bookie||"Other"; if(!bkMap[bk])bkMap[bk]={pl:0,won:0,total:0}; bkMap[bk].pl+=(b.profit||0); if(["won","lost"].includes(b.result))bkMap[bk].total++; if(b.result==="won")bkMap[bk].won++; });

  return (
    <div style={{ animation:"fadeUp 0.35s ease" }}>
      <div style={{ display:"flex", gap:5, marginBottom:12, flexWrap:"wrap" }}>
        {[["all","All"],["cricket","🏏"],["football","⚽"],["tennis","🎾"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSf(k)} style={{ background:sf===k?"rgba(10,132,255,0.22)":t.inp, border:`1px solid ${sf===k?"rgba(10,132,255,0.5)":t.inpB}`, borderRadius:9, color:sf===k?"#0a84ff":t.sub, padding:"5px 13px", fontSize:11, fontWeight:700, cursor:"pointer" }}>{l}</button>
        ))}
      </div>

      {stats.runData.length>=2&&<Glass t={t} style={{marginBottom:12}}><SectionHead title="📈 Running P&L" sub={`Max DD: ${fc(stats.maxDD)}`} t={t}/><LineChart data={stats.runData} t={t} height={100}/></Glass>}

      <Glass t={t} style={{marginBottom:12}}><SectionHead title="📅 Monthly P&L" t={t}/><BarChart data={monthData} labelKey="label" valueKey="value" t={t}/></Glass>
      <Glass t={t} style={{marginBottom:12}}>
        <SectionHead title="📆 Day of Week" t={t}/>
        <BarChart data={dowData} labelKey="label" valueKey="value" t={t}/>
        {dowData.some(d=>d.value!==0)&&<div style={{marginTop:9,display:"flex",gap:12,fontSize:10,color:t.sub}}>
          <span>🏆 Best: <b style={{color:"#30d158"}}>{dowData.reduce((a,b)=>b.value>a.value?b:a).label}</b></span>
          <span>💀 Worst: <b style={{color:"#ff453a"}}>{dowData.reduce((a,b)=>b.value<a.value?b:a).label}</b></span>
        </div>}
      </Glass>

      <Glass t={t} style={{marginBottom:12}}>
        <SectionHead title="🎲 Odds Range" t={t}/>
        <BarChart data={oddsData} labelKey="label" valueKey="value" t={t}/>
        <div style={{display:"flex",gap:7,marginTop:10,flexWrap:"wrap"}}>
          {oddsData.filter(d=>d.count>0).map(d=>(
            <div key={d.label} style={{flex:1,minWidth:70,background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:10,padding:"8px 10px"}}>
              <div style={{fontSize:10,fontWeight:700,color:t.text}}>{d.label}</div>
              <div style={{fontSize:12,fontWeight:800,color:d.value>=0?"#30d158":"#ff453a"}}>{d.value>=0?"+":""}{fc(d.value)}</div>
              <div style={{fontSize:9,color:t.muted}}>{d.count} bets</div>
            </div>
          ))}
        </div>
      </Glass>

      {Object.keys(bkMap).length>=2&&<Glass t={t} style={{marginBottom:12}}>
        <SectionHead title="🎰 By Bookie" t={t}/>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {Object.entries(bkMap).sort((a,b)=>b[1].pl-a[1].pl).map(([bk,d])=>{
            const wr=d.total>0?Math.round(d.won/d.total*100):0;
            return(
              <div key={bk} style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:12,padding:"10px 13px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontSize:12,fontWeight:700,color:t.text}}>🎰 {bk}</div><div style={{fontSize:9,color:t.muted}}>{d.total} bets · {wr}% WR</div></div>
                <div style={{fontSize:15,fontWeight:800,color:d.pl>=0?"#30d158":"#ff453a"}}>{d.pl>=0?"+":""}{fc(d.pl)}</div>
              </div>
            );
          })}
        </div>
      </Glass>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR TAB
// ═══════════════════════════════════════════════════════════════════════════════
function CalendarTab({ bets, t }) {
  const now = new Date();
  const [vd, setVd] = useState({ y:now.getFullYear(), m:now.getMonth() });
  const [selDay, setSelDay] = useState(null);
  const fd = new Date(vd.y,vd.m,1).getDay();
  const dim = new Date(vd.y,vd.m+1,0).getDate();
  const mName = new Date(vd.y,vd.m,1).toLocaleString("en-IN",{month:"long",year:"numeric"});
  const dMap = {};
  bets.forEach(b => { const d=new Date(b.date); if(d.getFullYear()===vd.y&&d.getMonth()===vd.m){const k=d.getDate();if(!dMap[k])dMap[k]={pl:0,c:0};dMap[k].pl+=(b.profit||0);dMap[k].c++;} });
  const mPL = Object.values(dMap).reduce((s,d)=>s+d.pl,0);
  const selBets = selDay ? bets.filter(b=>{const d=new Date(b.date);return d.getFullYear()===vd.y&&d.getMonth()===vd.m&&d.getDate()===selDay;}) : [];
  const todayD = now.getFullYear()===vd.y&&now.getMonth()===vd.m ? now.getDate() : null;

  return (
    <div style={{animation:"fadeUp 0.35s ease"}}>
      <Glass t={t} style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <button onClick={()=>setVd(v=>{let m=v.m-1,y=v.y;if(m<0){m=11;y--;}return{y,m};})} style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:10,color:t.text,padding:"7px 13px",cursor:"pointer",fontSize:15}}>‹</button>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:14,fontWeight:800,color:t.text}}>{mName}</div>
            <div style={{fontSize:10,fontWeight:700,color:mPL>=0?"#30d158":"#ff453a"}}>{mPL>=0?"+":""}{fc(mPL)}</div>
          </div>
          <button onClick={()=>setVd(v=>{let m=v.m+1,y=v.y;if(m>11){m=0;y++;}return{y,m};})} style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:10,color:t.text,padding:"7px 13px",cursor:"pointer",fontSize:15}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:2,marginTop:12}}>
          {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:9,color:t.muted,fontWeight:700,padding:"4px 0"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
          {Array(fd).fill(null).map((_,i)=><div key={`e${i}`}/>)}
          {Array(dim).fill(null).map((_,i)=>{
            const day=i+1,info=dMap[day];
            const isT=todayD===day,isSel=selDay===day;
            const bg=info?(info.pl>0?"rgba(48,209,88,0.2)":info.pl<0?"rgba(255,69,58,0.2)":"rgba(255,214,10,0.14)"):t.inp;
            return(
              <div key={day} onClick={()=>setSelDay(isSel?null:day)} style={{background:bg,border:`${isSel?"2px":"1px"} solid ${isSel?"#0a84ff":isT?t.sub:t.inpB}`,borderRadius:10,padding:"5px 2px",textAlign:"center",cursor:info?"pointer":"default",transition:"all 0.1s"}}>
                <div style={{fontSize:10,fontWeight:isT?800:500,color:isSel?"#0a84ff":t.text}}>{day}</div>
                {info&&<><div style={{fontSize:7,color:info.pl>=0?"#30d158":"#ff453a",fontWeight:700}}>{info.pl>=0?"+":""}{Math.abs(info.pl)>999?Math.round(info.pl/1000)+"k":Math.round(info.pl)}</div><div style={{fontSize:7,color:t.muted}}>{info.c}b</div></>}
              </div>
            );
          })}
        </div>
      </Glass>
      {selDay&&selBets.length>0&&<Glass t={t}><SectionHead title={`${selDay} ${mName}`} sub={`${selBets.length} bet(s)`} t={t}/>{selBets.map(b=>(
        <div key={b.id} style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:12,padding:"10px 13px",marginBottom:7}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,fontWeight:700,color:t.text}}>{SPORTS[b.sport]?.icon||"🎲"} {b.match}</span><span style={{fontSize:13,fontWeight:800,color:(b.profit||0)>=0?"#30d158":"#ff453a"}}>{(b.profit||0)>=0?"+":""}{fc(b.profit)}</span></div>
          <div style={{fontSize:10,color:t.sub}}>{b.selection} @ {b.odds} · {fc(b.stake)} · <span style={{textTransform:"capitalize"}}>{b.result}</span></div>
        </div>
      ))}</Glass>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BANKROLL TAB
// ═══════════════════════════════════════════════════════════════════════════════
function BankrollTab({ bets, t }) {
  const [bankroll, setBankroll] = useState(() => store.get("bankroll", 10000));
  const [target, setTarget] = useState(() => store.get("target", 5000));
  const [dailyLim, setDailyLim] = useState(() => store.get("dailyLim", 2000));
  const [editing, setEditing] = useState(false);
  useEffect(() => { store.set("bankroll",bankroll); store.set("target",target); store.set("dailyLim",dailyLim); }, [bankroll,target,dailyLim]);

  const stats = useMemo(() => computeStats(bets), [bets]);
  const { tPL, wr, avgOdds, maxW, maxL, maxDD, stdDev, kelly } = stats;
  const cur = bankroll + tPL;
  const growth = (tPL/bankroll)*100;
  const now = new Date();
  const thisMonth = bets.filter(b=>{const d=new Date(b.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
  const mPL = thisMonth.reduce((s,b)=>s+(b.profit||0),0);
  const mPct = clamp((mPL/target)*100, 0, 100);
  const todayLoss = Math.abs(bets.filter(b=>b.date===today()).reduce((s,b)=>(b.profit||0)<0?s+(b.profit||0):s, 0));
  const dlPct = clamp((todayLoss/dailyLim)*100, 0, 100);
  const kellySug = Math.max(0,kelly/100)*cur;
  const iS = { width:"100%", background:t.inp, border:`1px solid ${t.inpB}`, borderRadius:10, color:t.text, fontSize:12, padding:"8px 11px", outline:"none", boxSizing:"border-box" };

  return (
    <div style={{animation:"fadeUp 0.35s ease"}}>
      <Glass t={t} style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{fontSize:9,color:t.muted,textTransform:"uppercase",letterSpacing:0.7,marginBottom:4}}>Current Bankroll</div>
            <div style={{fontSize:32,fontWeight:800,color:tPL>=0?"#30d158":"#ff453a",letterSpacing:-1.5}}>{fc(cur)}</div>
            <div style={{fontSize:11,color:t.sub,marginTop:2}}>Started: {fc(bankroll)} · Growth: <b style={{color:growth>=0?"#30d158":"#ff453a"}}>{growth.toFixed(1)}%</b></div>
          </div>
          <button onClick={()=>setEditing(e=>!e)} style={{background:"rgba(10,132,255,0.15)",border:"1px solid rgba(10,132,255,0.3)",borderRadius:11,color:"#0a84ff",padding:"8px 14px",fontSize:11,cursor:"pointer",fontWeight:700}}>{editing?"Done":"⚙️ Edit"}</button>
        </div>
        {editing&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9}}>
          {[["Starting (₹)",bankroll,setBankroll],["Monthly Target (₹)",target,setTarget],["Daily Loss Limit (₹)",dailyLim,setDailyLim]].map(([lbl,val,fn])=>(
            <div key={lbl}><div style={{fontSize:9,color:t.muted,marginBottom:3,textTransform:"uppercase"}}>{lbl}</div><input type="number" value={val} onChange={e=>fn(parseFloat(e.target.value)||0)} style={iS}/></div>
          ))}
        </div>}
      </Glass>

      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <Glass t={t} style={{flex:1,textAlign:"center",padding:"14px"}}><div style={{fontSize:9,color:t.muted,textTransform:"uppercase",marginBottom:4}}>🏆 Best Win Streak</div><div style={{fontSize:28,fontWeight:800,color:"#30d158"}}>{maxW}</div></Glass>
        <Glass t={t} style={{flex:1,textAlign:"center",padding:"14px"}}><div style={{fontSize:9,color:t.muted,textTransform:"uppercase",marginBottom:4}}>💀 Worst Lose Streak</div><div style={{fontSize:28,fontWeight:800,color:"#ff453a"}}>{maxL}</div></Glass>
        <Glass t={t} style={{flex:1,textAlign:"center",padding:"14px"}}><div style={{fontSize:9,color:t.muted,textTransform:"uppercase",marginBottom:4}}>📉 Max Drawdown</div><div style={{fontSize:16,fontWeight:800,color:"#ff9f0a"}}>{fc(maxDD)}</div></Glass>
      </div>

      <Glass t={t} style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{fontSize:12,fontWeight:700,color:t.text}}>🎯 Monthly Target</div><div style={{fontSize:11,color:t.sub}}>{fc(mPL)} / {fc(target)}</div></div>
        <div style={{height:10,background:t.inp,borderRadius:6,overflow:"hidden",marginBottom:4}}>
          <div style={{height:"100%",width:`${mPct}%`,background:mPL>=0?"linear-gradient(90deg,#30d158,#34c759)":"linear-gradient(90deg,#ff453a,#ff6961)",borderRadius:6,transition:"width 0.5s ease"}}/>
        </div>
        <div style={{fontSize:10,color:t.muted}}>{mPct.toFixed(0)}% achieved · {thisMonth.length} bets this month</div>
      </Glass>

      <Glass t={t} style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{fontSize:12,fontWeight:700,color:t.text}}>⚠️ Daily Loss Limit</div><div style={{fontSize:11,color:dlPct>=80?"#ff453a":t.sub}}>{fc(todayLoss)} / {fc(dailyLim)}</div></div>
        <div style={{height:10,background:t.inp,borderRadius:6,overflow:"hidden",marginBottom:4}}>
          <div style={{height:"100%",width:`${dlPct}%`,background:dlPct>=80?"linear-gradient(90deg,#ff453a,#ff6961)":dlPct>=50?"linear-gradient(90deg,#ffd60a,#ff9f0a)":"linear-gradient(90deg,#30d158,#34c759)",borderRadius:6,transition:"width 0.3s"}}/>
        </div>
        {dlPct>=80&&<div style={{fontSize:10,color:"#ff453a",fontWeight:700,marginTop:4}}>🛑 STOP! Daily loss limit almost reached!</div>}
      </Glass>

      <Glass t={t}>
        <SectionHead title="📐 Kelly Criterion" sub="Optimal bet sizing" t={t}/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[["Win Rate",pct(wr,0),"#30d158"],["Avg Odds",avgOdds.toFixed(2),"#ffd60a"],["Kelly %",pct(Math.max(0,kelly)),"#0a84ff"],["Suggested",fc(kellySug),"#bf5af2"],["Std Dev",fc(stdDev),"#ff9f0a"]].map(([l,v,c])=>(
            <div key={l} style={{flex:1,minWidth:72,background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:12,padding:"9px 11px"}}>
              <div style={{fontSize:8,color:t.muted,textTransform:"uppercase",marginBottom:2}}>{l}</div>
              <div style={{fontSize:13,fontWeight:800,color:c}}>{v}</div>
            </div>
          ))}
        </div>
      </Glass>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULATOR TAB
// ═══════════════════════════════════════════════════════════════════════════════
function CalcTab({ t }) {
  const [mode, setMode] = useState("back");
  const [stake, setStake] = useState("");
  const [odds, setOdds] = useState("");
  const [prob, setProb] = useState("");
  const [layForm, setLayForm] = useState({ lo:"", ls:"", comm:"5" });
  const [legs, setLegs] = useState(["","",""]);
  const iS = { width:"100%", background:t.inp, border:`1px solid ${t.inpB}`, borderRadius:11, color:t.text, fontSize:13, padding:"9px 12px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
  const lS = { fontSize:9, color:t.muted, marginBottom:3, display:"block", textTransform:"uppercase", letterSpacing:0.6, fontWeight:700 };
  const bProfit = parseFloat(stake)&&parseFloat(odds) ? Math.round(parseFloat(stake)*(parseFloat(odds)-1)) : null;
  const lLiab = parseFloat(layForm.lo)&&parseFloat(layForm.ls) ? Math.round(parseFloat(layForm.ls)*(parseFloat(layForm.lo)-1)) : null;
  const lProfit = parseFloat(layForm.ls)&&parseFloat(layForm.comm) ? Math.round(parseFloat(layForm.ls)*(1-parseFloat(layForm.comm)/100)) : null;
  const pOdds = legs.reduce((a,o)=>parseFloat(o)?a*parseFloat(o):a,1);
  const pProfit = parseFloat(stake)&&pOdds>1 ? Math.round(parseFloat(stake)*(pOdds-1)) : null;
  const implP = parseFloat(odds)>0 ? Math.round(100/parseFloat(odds)) : null;
  const ev = parseFloat(stake)&&parseFloat(odds)&&parseFloat(prob) ? calcEV(parseFloat(odds),parseFloat(stake),parseFloat(prob)) : null;
  const edge = implP&&parseFloat(prob) ? ((parseFloat(prob)-implP)/implP*100).toFixed(1) : null;
  const beWR = parseFloat(odds)>1 ? (1/parseFloat(odds)*100).toFixed(1) : null;

  return (
    <div style={{animation:"fadeUp 0.35s ease"}}>
      <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
        {[["back","🔵 Back"],["lay","🟠 Lay"],["parlay","🔗 Parlay"],["ev","📊 EV"],["breakeven","⚖️ B/E"]].map(([m,l])=>(
          <button key={m} onClick={()=>setMode(m)} style={{flex:1,background:mode===m?"rgba(10,132,255,0.25)":t.inp,border:`1px solid ${mode===m?"rgba(10,132,255,0.5)":t.inpB}`,borderRadius:11,color:mode===m?"#0a84ff":t.sub,padding:"8px 4px",fontSize:10,fontWeight:700,cursor:"pointer"}}>{l}</button>
        ))}
      </div>
      <Glass t={t}>
        {mode==="back"&&<div>
          <div style={{fontSize:13,fontWeight:800,color:t.text,marginBottom:14}}>🔵 Back Bet Calculator</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div><label style={lS}>Stake (₹)</label><input type="number" value={stake} onChange={e=>setStake(e.target.value)} style={iS} placeholder="500"/></div>
            <div><label style={lS}>Odds</label><input type="number" step="0.01" value={odds} onChange={e=>setOdds(e.target.value)} style={iS} placeholder="2.00"/>{implP&&<div style={{fontSize:9,color:t.muted,marginTop:3}}>Implied: {implP}%</div>}</div>
          </div>
          {bProfit!==null&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            <div style={{background:"rgba(48,209,88,0.1)",border:"1px solid rgba(48,209,88,0.28)",borderRadius:14,padding:"14px",textAlign:"center"}}><div style={{fontSize:9,color:t.muted,marginBottom:3}}>IF WON</div><div style={{fontSize:24,fontWeight:800,color:"#30d158"}}>+{fc(bProfit)}</div><div style={{fontSize:9,color:t.muted}}>Returns {fc(bProfit+parseFloat(stake))}</div></div>
            <div style={{background:"rgba(255,69,58,0.1)",border:"1px solid rgba(255,69,58,0.28)",borderRadius:14,padding:"14px",textAlign:"center"}}><div style={{fontSize:9,color:t.muted,marginBottom:3}}>IF LOST</div><div style={{fontSize:24,fontWeight:800,color:"#ff453a"}}>-{fc(parseFloat(stake))}</div><div style={{fontSize:9,color:t.muted}}>Net loss</div></div>
          </div>}
        </div>}
        {mode==="lay"&&<div>
          <div style={{fontSize:13,fontWeight:800,color:t.text,marginBottom:14}}>🟠 Lay Bet Calculator</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,marginBottom:12}}>
            <div><label style={lS}>Lay Odds</label><input type="number" step="0.01" value={layForm.lo} onChange={e=>setLayForm({...layForm,lo:e.target.value})} style={iS} placeholder="2.0"/></div>
            <div><label style={lS}>Backer Stake</label><input type="number" value={layForm.ls} onChange={e=>setLayForm({...layForm,ls:e.target.value})} style={iS} placeholder="500"/></div>
            <div><label style={lS}>Commission %</label><input type="number" value={layForm.comm} onChange={e=>setLayForm({...layForm,comm:e.target.value})} style={iS} placeholder="5"/></div>
          </div>
          {lLiab!==null&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            <div style={{background:"rgba(48,209,88,0.1)",border:"1px solid rgba(48,209,88,0.28)",borderRadius:14,padding:"14px",textAlign:"center"}}><div style={{fontSize:9,color:t.muted,marginBottom:3}}>SELECTION LOSES</div><div style={{fontSize:22,fontWeight:800,color:"#30d158"}}>+{fc(lProfit)}</div><div style={{fontSize:9,color:t.muted}}>After {layForm.comm}% comm</div></div>
            <div style={{background:"rgba(255,69,58,0.1)",border:"1px solid rgba(255,69,58,0.28)",borderRadius:14,padding:"14px",textAlign:"center"}}><div style={{fontSize:9,color:t.muted,marginBottom:3}}>SELECTION WINS</div><div style={{fontSize:22,fontWeight:800,color:"#ff453a"}}>-{fc(lLiab)}</div><div style={{fontSize:9,color:t.muted}}>Your liability</div></div>
          </div>}
        </div>}
        {mode==="parlay"&&<div>
          <div style={{fontSize:13,fontWeight:800,color:t.text,marginBottom:14}}>🔗 Parlay / Accumulator</div>
          <div style={{marginBottom:10}}><label style={lS}>Total Stake (₹)</label><input type="number" value={stake} onChange={e=>setStake(e.target.value)} style={iS} placeholder="500"/></div>
          {legs.map((o,i)=><div key={i} style={{marginBottom:8}}><label style={lS}>Leg {i+1} Odds</label><input type="number" step="0.01" value={o} onChange={e=>{const n=[...legs];n[i]=e.target.value;setLegs(n);}} style={iS} placeholder="1.85"/></div>)}
          <div style={{display:"flex",gap:7,marginBottom:12}}>
            <button onClick={()=>setLegs([...legs,""])} style={{flex:1,background:"rgba(10,132,255,0.15)",border:"1px solid rgba(10,132,255,0.3)",borderRadius:10,color:"#0a84ff",padding:"9px",fontSize:11,cursor:"pointer",fontWeight:700}}>+ Add Leg</button>
            {legs.length>2&&<button onClick={()=>setLegs(legs.slice(0,-1))} style={{flex:1,background:"rgba(255,69,58,0.15)",border:"1px solid rgba(255,69,58,0.3)",borderRadius:10,color:"#ff453a",padding:"9px",fontSize:11,cursor:"pointer",fontWeight:700}}>- Remove</button>}
          </div>
          {pProfit!==null&&<div style={{background:"rgba(10,132,255,0.1)",border:"1px solid rgba(10,132,255,0.3)",borderRadius:14,padding:"16px",textAlign:"center"}}>
            <div style={{fontSize:10,color:t.muted,marginBottom:4}}>Combined Odds: <b style={{color:"#ffd60a"}}>{pOdds.toFixed(2)}</b></div>
            <div style={{fontSize:26,fontWeight:800,color:"#0a84ff"}}>+{fc(pProfit)}</div>
            <div style={{fontSize:10,color:t.muted}}>Potential profit on {fc(parseFloat(stake))} stake</div>
          </div>}
        </div>}
        {mode==="ev"&&<div>
          <div style={{fontSize:13,fontWeight:800,color:t.text,marginBottom:14}}>📊 Expected Value Calculator</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
            <div><label style={lS}>Stake (₹)</label><input type="number" value={stake} onChange={e=>setStake(e.target.value)} style={iS} placeholder="500"/></div>
            <div><label style={lS}>Odds</label><input type="number" step="0.01" value={odds} onChange={e=>setOdds(e.target.value)} style={iS} placeholder="2.00"/>{implP&&<div style={{fontSize:9,color:t.muted,marginTop:2}}>Book: {implP}%</div>}</div>
            <div><label style={lS}>Your Win Prob %</label><input type="number" min="0" max="100" value={prob} onChange={e=>setProb(e.target.value)} style={iS} placeholder="55"/></div>
          </div>
          {ev!==null&&<div>
            <div style={{background:ev>=0?"rgba(48,209,88,0.1)":"rgba(255,69,58,0.1)",border:`1px solid ${ev>=0?"rgba(48,209,88,0.3)":"rgba(255,69,58,0.3)"}`,borderRadius:14,padding:"16px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontSize:9,color:t.muted,marginBottom:4}}>Expected Value per Bet</div><div style={{fontSize:28,fontWeight:800,color:ev>=0?"#30d158":"#ff453a"}}>{ev>=0?"+":""}{fc(ev)}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:10,color:t.muted}}>Value Bet?</div><div style={{fontSize:18,fontWeight:800,color:ev>=0?"#30d158":"#ff453a"}}>{ev>=0?"✅ YES":"❌ NO"}</div></div>
              </div>
            </div>
            {edge&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9}}>
              {[["Book Prob",`${implP}%`,"#ff9f0a"],["Your Prob",`${prob}%`,"#0a84ff"],["Edge",`${edge}%`,parseFloat(edge)>=0?"#30d158":"#ff453a"]].map(([l,v,c])=>(
                <div key={l} style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:12,padding:"10px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:t.muted}}>{l}</div><div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div>
                </div>
              ))}
            </div>}
          </div>}
        </div>}
        {mode==="breakeven"&&<div>
          <div style={{fontSize:13,fontWeight:800,color:t.text,marginBottom:14}}>⚖️ Break-Even Calculator</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div><label style={lS}>Odds</label><input type="number" step="0.01" value={odds} onChange={e=>setOdds(e.target.value)} style={iS} placeholder="2.00"/></div>
            <div><label style={lS}>Stake (₹)</label><input type="number" value={stake} onChange={e=>setStake(e.target.value)} style={iS} placeholder="500"/></div>
          </div>
          {beWR&&<div>
            <div style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:14,padding:"16px",marginBottom:12,textAlign:"center"}}>
              <div style={{fontSize:10,color:t.muted,marginBottom:4}}>Break-Even Win Rate</div>
              <div style={{fontSize:32,fontWeight:800,color:"#ffd60a"}}>{beWR}%</div>
              <div style={{fontSize:10,color:t.muted}}>You must win at least {beWR}% to not lose money</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
              {[10,25,50,100,200,500].map(total=>(
                <div key={total} style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:12,padding:"10px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:t.muted}}>{total} bets</div>
                  <div style={{fontSize:17,fontWeight:800,color:"#0a84ff"}}>{Math.ceil(total*parseFloat(beWR)/100)}</div>
                  <div style={{fontSize:8,color:t.muted}}>wins needed</div>
                </div>
              ))}
            </div>
          </div>}
        </div>}
      </Glass>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT TAB
// ═══════════════════════════════════════════════════════════════════════════════
function ReportTab({ bets, t, showToast }) {
  const [period, setPeriod] = useState("month");
  const now = new Date();
  const getPeriodBets = () => {
    if(period==="week"){const s=new Date(now);s.setDate(s.getDate()-7);return bets.filter(b=>new Date(b.date)>=s);}
    if(period==="month"){const s=new Date(now.getFullYear(),now.getMonth(),1);return bets.filter(b=>new Date(b.date)>=s);}
    if(period==="year"){const s=new Date(now.getFullYear(),0,1);return bets.filter(b=>new Date(b.date)>=s);}
    return bets;
  };
  const pb = getPeriodBets();
  const settled = pb.filter(b=>["won","lost"].includes(b.result));
  const won = pb.filter(b=>b.result==="won").length;
  const tPL = pb.reduce((s,b)=>s+(b.profit||0),0);
  const tStake = pb.reduce((s,b)=>s+(b.stake||0),0);
  const roi = tStake>0?(tPL/tStake)*100:0;
  const wr = settled.length>0?(won/settled.length)*100:0;
  const plC = tPL>=0?"#30d158":"#ff453a";
  const labels = {week:"This Week",month:"This Month",year:"This Year",all:"All Time"};

  const exportReport = () => {
    const txt = [`BetTracker Pro — ${labels[period]} Report`,`Generated: ${new Date().toLocaleDateString("en-IN")}`,"",`Total Bets: ${pb.length}  Won: ${won}  Lost: ${settled.length-won}`,`Win Rate: ${wr.toFixed(1)}%`,`Total P&L: ${tPL>=0?"+":""}₹${Math.round(tPL)}`,`ROI: ${roi.toFixed(1)}%`,`Total Staked: ₹${Math.round(tStake)}`].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt],{type:"text/plain"})); a.download=`BetReport-${today()}.txt`; a.click();
    showToast("📋 Report exported!","success");
  };

  return (
    <div style={{animation:"fadeUp 0.35s ease"}}>
      <Glass t={t} style={{marginBottom:12}}>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {[["week","This Week"],["month","This Month"],["year","This Year"],["all","All Time"]].map(([k,l])=>(
            <button key={k} onClick={()=>setPeriod(k)} style={{flex:1,background:period===k?"rgba(10,132,255,0.25)":t.inp,border:`1px solid ${period===k?"rgba(10,132,255,0.5)":t.inpB}`,borderRadius:11,color:period===k?"#0a84ff":t.sub,padding:"7px 4px",fontSize:10,fontWeight:700,cursor:"pointer"}}>{l}</button>
          ))}
        </div>
      </Glass>

      {pb.length===0
        ? <div style={{textAlign:"center",padding:"48px 0",color:t.muted}}><div style={{fontSize:40,marginBottom:10}}>📋</div><div>No bets in this period</div></div>
        : <>
          <div style={{background:`linear-gradient(135deg,${plC}18,${plC}08)`,backdropFilter:"blur(28px)",WebkitBackdropFilter:"blur(28px)",border:`1px solid ${plC}35`,borderRadius:26,padding:"20px 22px",marginBottom:12,boxShadow:`0 6px 32px ${plC}20`}}>
            <div style={{fontSize:9,color:t.muted,letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:6}}>📋 {labels[period]} Report</div>
            <div style={{fontSize:42,fontWeight:900,color:plC,letterSpacing:-1.5,lineHeight:1}}>{tPL>=0?"+":""}{fc(tPL)}</div>
            <div style={{display:"flex",gap:14,marginTop:10,flexWrap:"wrap"}}>
              {[["ROI",`${roi.toFixed(1)}%`,plC],["Win Rate",`${wr.toFixed(0)}%`,"#0a84ff"],["Bets",pb.length,t.sub],["Staked",fc(tStake),t.muted]].map(([l,v,c])=>(
                <div key={l}><span style={{fontSize:10,color:t.muted}}>{l} </span><span style={{fontSize:12,fontWeight:700,color:c}}>{v}</span></div>
              ))}
            </div>
          </div>
          <button onClick={exportReport} style={{width:"100%",background:"linear-gradient(135deg,#0a84ff,#0055cc)",border:"none",borderRadius:16,color:"#fff",padding:"14px",fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:"0 4px 20px rgba(10,132,255,0.4)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span>📤</span> Export {labels[period]} Report
          </button>
        </>
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAWER
// ═══════════════════════════════════════════════════════════════════════════════
function Drawer({ show, onClose, theme, setTheme, bets, bookies, setBookies, t, showToast }) {
  const fileRef = useRef();
  const exportCSV = () => {
    const hdr = ["Date","Sport","Match","Market","Selection","BetType","Odds","Stake","Result","PL","Bookie","Confidence","LiveBet","Notes"];
    const rows = bets.map(b=>[b.date,b.sport,b.match,b.market,b.selection,b.betType||"Single",b.odds,b.stake,b.result,b.profit||0,b.bookie||"",b.confidence||0,b.livebet?"Yes":"No",b.notes||""]);
    const csv = [hdr,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`bets-${today()}.csv`;a.click();
    showToast("📥 CSV exported!","success");
  };

  if (!show) return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:500}} onClick={onClose}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(4px)"}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:"absolute",right:0,top:0,bottom:0,width:"78%",maxWidth:320,background:t.modal,borderLeft:`1px solid ${t.cardB}`,display:"flex",flexDirection:"column",animation:"slideIn 0.28s cubic-bezier(0.34,1.4,0.64,1)",padding:"0 0 32px"}}>
        <div style={{padding:"52px 20px 16px",borderBottom:`1px solid ${t.cardB}`}}>
          <div style={{fontSize:22,fontWeight:900,letterSpacing:-0.5,color:t.text,marginBottom:4}}>🏆 BetTracker Pro</div>
          <div style={{fontSize:11,color:t.muted}}>{bets.length} bets tracked</div>
          <div style={{display:"flex",gap:6,marginTop:14}}>
            {Object.entries({amoled:"⚫ AMOLED",dark:"🌙 Dark",light:"☀️ Light"}).map(([k,l])=>(
              <button key={k} onClick={()=>{setTheme(k);store.set("theme",k);}} style={{flex:1,background:theme===k?"rgba(10,132,255,0.2)":"transparent",border:`1px solid ${theme===k?"rgba(10,132,255,0.4)":t.cardB}`,borderRadius:10,color:theme===k?"#0a84ff":t.sub,padding:"8px 4px",cursor:"pointer",fontSize:10,fontWeight:700}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"8px 12px"}}>
          {[{icon:"📥",label:"Export CSV",fn:exportCSV},{icon:"⚙️",label:"Manage Bookies",fn:()=>{}},{icon:"📋",label:"Session Notes",fn:()=>{}}].map((item,i)=>(
            <button key={i} onClick={()=>{item.fn();onClose();}} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"13px 10px",background:"transparent",border:"none",borderRadius:12,color:t.text,cursor:"pointer",textAlign:"left"}}>
              <span style={{fontSize:22,width:32,textAlign:"center"}}>{item.icon}</span>
              <span style={{fontSize:14,fontWeight:600,color:t.sub,flex:1}}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [bets, setBets] = useState(() => store.get("bets", []));
  const [bookies, setBookies] = useState(() => store.get("bookies", DEFAULT_BOOKIES));
  const [tab, setTab] = useState(0);
  const [theme, setTheme] = useState(() => store.get("theme", "amoled"));
  const [showModal, setShowModal] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [editBet, setEditBet] = useState(null);
  const [toast, setToast] = useState(null);
  const [undo, setUndo] = useState(null);
  const t = THEMES[theme];

  useEffect(() => { store.set("bets", bets); }, [bets]);
  useEffect(() => { store.set("bookies", bookies); }, [bookies]);

  const showToast = (msg, type="success") => setToast({ msg, type });

  const handleSave = (form) => {
    if (!form.match || !form.odds || !form.stake) { showToast("❌ Match, odds & stake required","error"); return; }
    setBets(prev => editBet ? prev.map(b=>b.id===editBet.id?{...form,id:editBet.id}:b) : [{...form,id:Date.now()},...prev]);
    setShowModal(false); setEditBet(null);
    showToast(editBet?"✏️ Bet updated!":"✅ Bet added!");
  };
  const handleEdit = (bet) => { setEditBet(bet); setShowModal(true); };
  const handleDelete = (id) => {
    const bet = bets.find(b=>b.id===id);
    setBets(prev=>prev.filter(b=>b.id!==id));
    const timer = setTimeout(()=>setUndo(null),5000);
    setUndo({ bet, timer });
  };
  const handleUndo = () => { if(undo){ clearTimeout(undo.timer); setBets(prev=>[...prev,undo.bet].sort((a,b)=>new Date(b.date)-new Date(a.date))); setUndo(null); showToast("↩️ Bet restored!","success"); } };
  const handleDuplicate = (bet) => { setBets(prev=>[{...bet,id:Date.now(),date:today(),result:"pending",profit:0},...prev]); showToast("📋 Bet duplicated!","success"); };
  const handleMarkResult = (id, result) => {
    setBets(prev=>prev.map(b=>{if(b.id!==id)return b;const profit=result==="won"?Math.round(b.stake*(b.odds-1)):result==="lost"?-b.stake:0;return{...b,result,profit};}));
    showToast(result==="won"?"🎉 Marked as WON!":"❌ Marked as LOST",result==="won"?"success":"error");
  };

  return (
    <div style={{ minHeight:"100vh", background:t.bg, fontFamily:"'SF Pro Text',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:t.text, position:"relative", overflowX:"hidden" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        body{overscroll-behavior:none;}
        input,select,textarea{font-family:inherit;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:4px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes fadeDown{from{opacity:0;transform:translate(-50%,-16px) scale(0.94)}to{opacity:1;transform:translate(-50%,0) scale(1)}}
        @keyframes popIn{0%{opacity:0;transform:scale(0.82)}55%{transform:scale(1.04)}80%{transform:scale(0.98)}100%{opacity:1;transform:scale(1)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(60px) scale(0.96)}60%{transform:translateY(-4px)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes fabPop{0%{opacity:0;transform:scale(0.6) translateY(10px)}60%{transform:scale(1.08)}100%{opacity:1;transform:scale(1) translateY(0)}}
        button{cursor:pointer;transition:transform 0.12s cubic-bezier(0.34,1.56,0.64,1),opacity 0.12s ease;}
        button:active{transform:scale(0.92);opacity:0.85;}
      `}</style>

      {/* Ambient orbs */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
        <div style={{position:"absolute",top:-80,left:-80,width:340,height:340,background:`radial-gradient(circle,rgba(10,132,255,0.12) 0%,transparent 70%)`,borderRadius:"50%"}}/>
        <div style={{position:"absolute",top:320,right:-80,width:280,height:280,background:`radial-gradient(circle,rgba(48,209,88,0.07) 0%,transparent 70%)`,borderRadius:"50%"}}/>
        <div style={{position:"absolute",bottom:180,left:"18%",width:240,height:240,background:`radial-gradient(circle,rgba(255,159,10,0.05) 0%,transparent 70%)`,borderRadius:"50%"}}/>
      </div>

      {/* Toasts */}
      {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      {undo&&(
        <div style={{position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",zIndex:9000,background:"rgba(30,30,40,0.96)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:16,padding:"10px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",minWidth:240}}>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.8)",flex:1}}>Bet deleted</span>
          <button onClick={handleUndo} style={{background:"rgba(10,132,255,0.25)",border:"1px solid rgba(10,132,255,0.4)",borderRadius:9,color:"#0a84ff",fontSize:12,fontWeight:700,padding:"4px 12px"}}>Undo</button>
          <button onClick={()=>{clearTimeout(undo.timer);setUndo(null);}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:14,padding:"0 4px"}}>✕</button>
        </div>
      )}

      {showFabMenu&&<div style={{position:"fixed",inset:0,zIndex:200}} onClick={()=>setShowFabMenu(false)}/>}

      {/* Content */}
      <div style={{position:"relative",zIndex:1,maxWidth:720,margin:"0 auto",padding:"60px 14px 110px"}}>
        {tab===0&&<Dashboard bets={bets} t={t}/>}
        {tab===1&&<BetsTab bets={bets} onEdit={handleEdit} onDelete={handleDelete} onDuplicate={handleDuplicate} onMarkResult={handleMarkResult} t={t}/>}
        {tab===2&&<StatsTab bets={bets} t={t}/>}
        {tab===3&&<CalendarTab bets={bets} t={t}/>}
        {tab===4&&<BankrollTab bets={bets} t={t}/>}
        {tab===5&&<CalcTab t={t}/>}
        {tab===6&&<ReportTab bets={bets} t={t} showToast={showToast}/>}
      </div>

      {/* FAB speed dial */}
      {showFabMenu&&(
        <div style={{position:"fixed",bottom:88,right:20,zIndex:300,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10}}>
          {[{icon:"⚡",label:"Quick Add",color:"#0a84ff",fn:()=>{setShowQuick(true);setShowFabMenu(false);}},{icon:"➕",label:"Add Bet",color:"#30d158",fn:()=>{setEditBet(null);setShowModal(true);setShowFabMenu(false);}}].map((item,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,animation:`fabPop 0.3s ease ${i*0.06}s both`}}>
              <div style={{background:t.nav,backdropFilter:"blur(20px)",border:`1px solid ${t.cardB}`,borderRadius:10,padding:"6px 12px",fontSize:12,fontWeight:700,color:t.text,whiteSpace:"nowrap",boxShadow:"0 4px 16px rgba(0,0,0,0.3)"}}>{item.label}</div>
              <button onClick={item.fn} style={{width:46,height:46,borderRadius:14,background:item.color,border:"none",color:"#fff",fontSize:20,boxShadow:`0 4px 18px ${item.color}55`,display:"flex",alignItems:"center",justifyContent:"center"}}>{item.icon}</button>
            </div>
          ))}
        </div>
      )}

      {/* Bottom nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,display:"flex",justifyContent:"center",padding:"0 10px 10px",alignItems:"flex-end",gap:10}}>
        <div style={{background:t.nav,backdropFilter:"blur(40px)",WebkitBackdropFilter:"blur(40px)",border:`1px solid ${t.cardB}`,borderRadius:24,padding:"5px",display:"flex",gap:1,boxShadow:"0 -4px 30px rgba(0,0,0,0.2)",flex:1,maxWidth:440}}>
          {TABS.map(([icon,name],i)=>(
            <button key={i} onClick={()=>setTab(i)} style={{flex:1,background:tab===i?"rgba(10,132,255,0.22)":"transparent",border:tab===i?"1px solid rgba(10,132,255,0.32)":"1px solid transparent",borderRadius:18,color:tab===i?"#0a84ff":t.muted,padding:"7px 2px",display:"flex",flexDirection:"column",alignItems:"center",gap:1,transition:"all 0.2s cubic-bezier(0.34,1.4,0.64,1)"}}>
              <span style={{fontSize:14}}>{icon}</span>
              <span style={{fontSize:tab===i?8:7,fontWeight:tab===i?700:500,letterSpacing:0.1}}>{name}</span>
            </button>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,paddingBottom:3}}>
          <button onClick={()=>setShowFabMenu(p=>!p)} style={{width:52,height:52,borderRadius:16,background:showFabMenu?"rgba(255,69,58,0.9)":"linear-gradient(135deg,#0a84ff,#0055cc)",border:"none",color:"#fff",fontSize:22,boxShadow:"0 4px 20px rgba(10,132,255,0.5)",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
            {showFabMenu?"✕":"＋"}
          </button>
          <button onClick={()=>setShowDrawer(true)} style={{width:52,height:34,borderRadius:12,background:t.nav,backdropFilter:"blur(20px)",border:`1px solid ${t.cardB}`,color:t.sub,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 10px rgba(0,0,0,0.2)"}}>
            ☰
          </button>
        </div>
      </div>

      <BetModal show={showModal} onClose={()=>{setShowModal(false);setEditBet(null);}} onSave={handleSave} editBet={editBet} t={t} bookies={bookies}/>
      <QuickAddModal show={showQuick} onClose={()=>setShowQuick(false)} onSave={(b)=>{setBets(prev=>[b,...prev]);showToast("⚡ Bet added!","success");}} t={t} bookies={bookies}/>
      <Drawer show={showDrawer} onClose={()=>setShowDrawer(false)} theme={theme} setTheme={setTheme} bets={bets} bookies={bookies} setBookies={setBookies} t={t} showToast={showToast}/>
    </div>
  );
}
