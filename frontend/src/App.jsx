/*
  EduScan  —  App.jsx  (Phase 4  Fixed Scoring)
  ✓ Register → navigates to Login (no auto-login)
  ✓ Login only entry to app
  ✓ Teacher sets max_score — threshold is HIDDEN (fixed at 0.50 on server)
  ✓ Scores always computed from raw similarity — no threshold gate
  ✓ Student Scores page with grade table
*/
import { useState, useCallback, useRef, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ── CSS ─────────────────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  body { background:#F3F4F6; color:#111827; font-family:'Inter',sans-serif; font-size:14px; line-height:1.5; }
  ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-track{background:#F3F4F6} ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}
  input[type=range]{-webkit-appearance:none;width:100%;height:4px;background:#E5E7EB;border-radius:2px;outline:none;cursor:pointer}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;background:#3B82F6;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.2)}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .fade{animation:fadeUp .22s ease both}
  button{cursor:pointer;font-family:'Inter',sans-serif}
  table{border-collapse:collapse}
  input,select,textarea{font-family:'Inter',sans-serif}
`;

/* ── COLORS ──────────────────────────────────────────────────────── */
const C = {
  blue:"#3B82F6", blueD:"#2563EB",
  green:"#10B981", yellow:"#F59E0B", red:"#EF4444", orange:"#F97316",
  purple:"#8B5CF6",
  card:"#FFFFFF", bg:"#F3F4F6", border:"#E5E7EB",
  text:"#111827", textMd:"#374151", textSm:"#6B7280", textXs:"#9CA3AF",
};

/* ── HELPERS ─────────────────────────────────────────────────────── */
const scoreColor = s => {
  if(s>=80) return {bg:"#FEE2E2",text:"#DC2626",border:"#FECACA"};
  if(s>=60) return {bg:"#FEF3C7",text:"#D97706",border:"#FDE68A"};
  if(s>=40) return {bg:"#FEF9C3",text:"#CA8A04",border:"#FEF08A"};
  return           {bg:"#DCFCE7",text:"#16A34A",border:"#BBF7D0"};
};
const sevColor = s => {
  if(s==="HIGH")   return {bg:"#FEE2E2",text:"#DC2626",border:"#FECACA"};
  if(s==="MEDIUM") return {bg:"#FEF3C7",text:"#D97706",border:"#FDE68A"};
  if(s==="LOW")    return {bg:"#DCFCE7",text:"#16A34A",border:"#BBF7D0"};
  return                  {bg:"#EFF6FF",text:"#3B82F6",border:"#BFDBFE"};
};
const gradeColor = g => {
  if(g==="A") return {bg:"#DCFCE7",text:"#16A34A"};
  if(g==="B") return {bg:"#DBEAFE",text:"#1D4ED8"};
  if(g==="C") return {bg:"#FEF3C7",text:"#D97706"};
  if(g==="D") return {bg:"#FEF9C3",text:"#CA8A04"};
  return             {bg:"#FEE2E2",text:"#DC2626"};
};

const Spinner = () => <div style={{width:18,height:18,border:"2px solid #E5E7EB",borderTop:"2px solid #3B82F6",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/>;

/* ── AUTH HELPERS ────────────────────────────────────────────────── */
const getToken = () => localStorage.getItem("ag_token");
const getUser  = () => { try{ return JSON.parse(localStorage.getItem("ag_user")||"null"); }catch{ return null; } };
const setAuth  = (t,u) => { localStorage.setItem("ag_token",t); localStorage.setItem("ag_user",JSON.stringify(u)); };
const clearAuth= () => { localStorage.removeItem("ag_token"); localStorage.removeItem("ag_user"); };
const authFetch= (url, opts={}) => {
  const h = {"Content-Type":"application/json",...(opts.headers||{})};
  const t = getToken(); if(t) h["Authorization"]=`Bearer ${t}`;
  return fetch(url,{...opts,headers:h});
};

/* ── ICONS ───────────────────────────────────────────────────────── */
const Ic = {
  Grid:   ({s=16,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke={c} strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke={c} strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke={c} strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke={c} strokeWidth="2"/></svg>,
  Upload: ({s=16,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Table:  ({s=16,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke={c} strokeWidth="2"/><line x1="3" y1="9" x2="21" y2="9" stroke={c} strokeWidth="1.5"/><line x1="3" y1="15" x2="21" y2="15" stroke={c} strokeWidth="1.5"/><line x1="9" y1="3" x2="9" y2="21" stroke={c} strokeWidth="1.5"/><line x1="15" y1="3" x2="15" y2="21" stroke={c} strokeWidth="1.5"/></svg>,
  Group:  ({s=16,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="4" stroke={c} strokeWidth="2"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke={c} strokeWidth="2" strokeLinecap="round"/><path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.85" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  Bar:    ({s=16,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><line x1="18" y1="20" x2="18" y2="10" stroke={c} strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="20" x2="12" y2="4" stroke={c} strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="20" x2="6" y2="14" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  File:   ({s=16,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={c} strokeWidth="2" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" stroke={c} strokeWidth="2" strokeLinejoin="round"/><line x1="16" y1="13" x2="8" y2="13" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="17" x2="8" y2="17" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
  Star:   ({s=16,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Logout: ({s=16,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Check:  ({s=16,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Alert:  ({s=16,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="2" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke={c} strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="17" r="0.8" fill={c}/></svg>,
  Search: ({s=16,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke={c} strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  Brain:  ({s=16,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M9.5 2a4.5 4.5 0 000 9h5a4.5 4.5 0 000-9h-5z" stroke={c} strokeWidth="2"/><path d="M6 11a4 4 0 000 8h12a4 4 0 000-8" stroke={c} strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="2" x2="12" y2="22" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
};

const NAV = [
  {id:"dashboard",Icon:Ic.Grid,  label:"Dashboard"},
  {id:"upload",   Icon:Ic.Upload,label:"Upload Assignments"},
  {id:"results",  Icon:Ic.Table, label:"Similarity Results"},
  {id:"groups",   Icon:Ic.Group, label:"Assignment Groups"},
  {id:"scores",   Icon:Ic.Star,  label:"Student Scores"},
  {id:"compare",  Icon:Ic.Search,label:"Sentence Compare"},
  {id:"viz",      Icon:Ic.Bar,   label:"Visualization"},
  {id:"reports",  Icon:Ic.File,  label:"Reports"},
];

/* ── SIDEBAR ─────────────────────────────────────────────────────── */
function Sidebar({page,setPage,user,onLogout}){
  const initials=(user?.name||"??").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return(
    <aside style={{width:204,minHeight:"100vh",background:C.card,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:50}}>
      <div style={{padding:"18px 14px 14px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,background:C.blue,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="white"/></svg>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:13,lineHeight:1.3}}>EduScan</div>
            <div style={{fontWeight:700,fontSize:13,lineHeight:1.3}}>AI</div>
            <div style={{fontSize:10,color:C.textSm,marginTop:1}}>Similarity Detection</div>
          </div>
        </div>
      </div>
      <nav style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
        {NAV.map(({id,Icon,label})=>{
          const active=page===id;
          return(
            <button key={id} onClick={()=>setPage(id)} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 10px",borderRadius:6,marginBottom:2,background:active?C.blue:"transparent",color:active?"#fff":C.textMd,border:"none",fontWeight:active?600:400,fontSize:13,textAlign:"left",transition:"background .12s"}}>
              <Icon s={15} c={active?"#fff":C.textSm}/>{label}
            </button>
          );
        })}
      </nav>
      <div style={{padding:"12px 14px",borderTop:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{width:30,height:30,borderRadius:"50%",background:C.blue,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{initials}</div>
          <div style={{overflow:"hidden"}}>
            <div style={{fontWeight:600,fontSize:12,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.name}</div>
            <div style={{fontSize:10,color:C.textSm,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.department||"Instructor"}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{display:"flex",alignItems:"center",gap:7,width:"100%",padding:"7px 10px",borderRadius:6,background:"#FEF2F2",color:C.red,border:`1px solid #FECACA`,fontSize:12,fontWeight:600}}>
          <Ic.Logout s={13} c={C.red}/> Sign Out
        </button>
      </div>
    </aside>
  );
}

/* ── TOAST ───────────────────────────────────────────────────────── */
function Toast({msg,type}){
  if(!msg) return null;
  const e=type==="error";
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:999,background:e?"#FEF2F2":"#F0FDF4",color:e?C.red:C.green,border:`1px solid ${e?"#FECACA":"#BBF7D0"}`,borderRadius:8,padding:"11px 18px",fontSize:13,boxShadow:"0 4px 16px rgba(0,0,0,.08)",maxWidth:340}}>{msg}</div>;
}

/* ── FIELD ───────────────────────────────────────────────────────── */
function Field({label,type="text",value,onChange,placeholder,required,hint}){
  return(
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:13,fontWeight:500,marginBottom:6,color:C.textMd}}>
        {label}{required&&<span style={{color:C.red}}> *</span>}
      </label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",padding:"10px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:14,color:C.text,background:"#F9FAFB",outline:"none"}}/>
      {hint&&<div style={{fontSize:11,color:C.textSm,marginTop:4}}>{hint}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   AUTH  —  Register navigates to Login, never auto-logs in
══════════════════════════════════════════════════════════════════ */
function AuthPages({onLogin}){
  const [screen,setScreen]=useState("login");
  const [regEmail,setRegEmail]=useState("");      // passed from register → login

  const handleRegistered=(email)=>{
    setRegEmail(email);
    setScreen("login");
  };

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#EFF6FF,#F3F4F6)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:440}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:60,height:60,background:C.blue,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="white"/></svg>
          </div>
          <h1 style={{fontSize:26,fontWeight:800,color:C.text}}>EduScan</h1>
          <p style={{color:C.textSm,fontSize:14,marginTop:4}}>Assignment Similarity Detection System</p>
        </div>

        {screen==="login"
          ? <LoginForm onLogin={onLogin} onSwitch={()=>setScreen("register")} prefillEmail={regEmail}/>
          : <RegisterForm onRegistered={handleRegistered} onSwitch={()=>setScreen("login")}/>
        }
      </div>
    </div>
  );
}

function LoginForm({onLogin,onSwitch,prefillEmail}){
  const [email,   setEmail]   = useState(prefillEmail||"");
  const [password,setPassword]= useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Update email when prefill changes (after registration)
  useEffect(()=>{ if(prefillEmail) setEmail(prefillEmail); },[prefillEmail]);

  const submit=async()=>{
    if(!email||!password){setError("Please fill in all fields.");return;}
    setLoading(true);setError("");
    try{
      const res =await fetch(`${API}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
      const data=await res.json();
      if(!res.ok){setError(data.error||"Login failed.");setLoading(false);return;}
      setAuth(data.token,data.teacher);
      onLogin(data.teacher);
    }catch{setError("Cannot connect to backend. Is it running on port 5000?");}
    setLoading(false);
  };

  return(
    <div style={{background:C.card,borderRadius:14,padding:"32px 28px",boxShadow:"0 4px 24px rgba(0,0,0,.08)",border:`1px solid ${C.border}`}}>
      <h2 style={{fontSize:20,fontWeight:700,marginBottom:6}}>Welcome back</h2>
      <p style={{color:C.textSm,fontSize:13,marginBottom:24}}>Sign in to your teacher account</p>

      {error&&<div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",color:C.red,fontSize:13,marginBottom:16}}>{error}</div>}

      <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@college.edu" required/>
      <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Your password" required/>

      <button onClick={submit} disabled={loading} style={{width:"100%",background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"12px 0",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:loading?.7:1,marginTop:4}}>
        {loading?<><Spinner/> Signing in…</>:"Sign In"}
      </button>

      <p style={{textAlign:"center",marginTop:20,fontSize:13,color:C.textSm}}>
        Don't have an account?{" "}
        <button onClick={onSwitch} style={{background:"none",border:"none",color:C.blue,fontWeight:600,fontSize:13}}>Create one →</button>
      </p>
    </div>
  );
}

function RegisterForm({onRegistered,onSwitch}){
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [dept,    setDept]    = useState("");
  const [pw,      setPw]      = useState("");
  const [pw2,     setPw2]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const submit=async()=>{
    if(!name||!email||!pw){setError("Name, email and password are required.");return;}
    if(pw.length<6){setError("Password must be at least 6 characters.");return;}
    if(pw!==pw2){setError("Passwords do not match.");return;}
    setLoading(true);setError("");
    try{
      const res =await fetch(`${API}/auth/register`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,password:pw,department:dept})});
      const data=await res.json();
      if(!res.ok){setError(data.error||"Registration failed.");setLoading(false);return;}
      // SUCCESS — go to login with email prefilled, show success
      onRegistered(email);
    }catch{setError("Cannot connect to backend. Is it running on port 5000?");}
    setLoading(false);
  };

  return(
    <div style={{background:C.card,borderRadius:14,padding:"32px 28px",boxShadow:"0 4px 24px rgba(0,0,0,.08)",border:`1px solid ${C.border}`}}>
      <h2 style={{fontSize:20,fontWeight:700,marginBottom:6}}>Create account</h2>
      <p style={{color:C.textSm,fontSize:13,marginBottom:24}}>Register as a teacher to get started</p>

      {error&&<div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",color:C.red,fontSize:13,marginBottom:16}}>{error}</div>}

      <Field label="Full Name" value={name} onChange={setName} placeholder="Dr. Jane Peterson" required/>
      <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@college.edu" required/>
      <Field label="Department" value={dept} onChange={setDept} placeholder="Computer Science (optional)"/>
      <Field label="Password" type="password" value={pw} onChange={setPw} placeholder="Min. 6 characters" required/>
      <Field label="Confirm Password" type="password" value={pw2} onChange={setPw2} placeholder="Repeat password" required/>

      <button onClick={submit} disabled={loading} style={{width:"100%",background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"12px 0",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:loading?.7:1,marginTop:4}}>
        {loading?<><Spinner/> Creating account…</>:"Create Account"}
      </button>

      <p style={{textAlign:"center",marginTop:20,fontSize:13,color:C.textSm}}>
        Already have an account?{" "}
        <button onClick={onSwitch} style={{background:"none",border:"none",color:C.blue,fontWeight:600,fontSize:13}}>Sign in →</button>
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAGE 1 — DASHBOARD
══════════════════════════════════════════════════════════════════ */
function DashboardPage({setPage,user}){
  const [health,setHealth]=useState(null);
  const [assignments,setAssignments]=useState([]);
  const [lastResult,setLastResult]=useState(null);

  useEffect(()=>{
    authFetch(`${API}/health/me`).then(r=>r.json()).then(setHealth).catch(()=>{});
    authFetch(`${API}/assignments`).then(r=>r.json()).then(d=>setAssignments(d.assignments||[])).catch(()=>{});
    authFetch(`${API}/similarity-results`).then(r=>r.json()).then(d=>{if(d&&d.threshold)setLastResult(d);}).catch(()=>{});
  },[]);

  const recent=assignments.slice(-5).reverse();
  const bars=[22,38,15,42,28,10,5];
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  return(
    <div className="fade">
      <div style={{marginBottom:22}}>
        <h1 style={{fontSize:22,fontWeight:700}}>Dashboard</h1>
        <p style={{color:C.textSm,fontSize:13,marginTop:3}}>Welcome back, <strong>{user?.name}</strong>.</p>
      </div>

      {health&&(
        <div style={{marginBottom:16,padding:"10px 16px",borderRadius:8,fontSize:13,background:health.status==="ok"?"#F0FDF4":"#FEF2F2",border:`1px solid ${health.status==="ok"?"#BBF7D0":"#FECACA"}`,color:health.status==="ok"?C.green:C.red,display:"flex",alignItems:"center",gap:8}}>
          {health.status==="ok"
            ?<><Ic.Check s={14} c={C.green}/> Backend connected — {health.active_assignments} file(s) in session · {health.total_assignments_all_time} total</>
            :"Cannot connect to backend on port 5000."
          }
        </div>
      )}

      <div style={{display:"flex",gap:12,marginBottom:18}}>
        {[
          {label:"Current Files",       value:assignments.length,  sub:"Active session",         subC:C.green,  iconEl:<Ic.File s={18} c={C.blue}/>,   iconBg:"#EFF6FF"},
          {label:"Similarity Groups",   value:lastResult?lastResult.groups?.filter(g=>g.group_id!=="unique").length:"—", sub:lastResult?"Last analysis":"Run analysis first", subC:C.yellow, iconEl:<Ic.Group s={18} c="#F59E0B"/>, iconBg:"#FFFBEB"},
          {label:"Highest Similarity",  value:lastResult?`${lastResult.highest_similarity}%`:"—", sub:lastResult&&lastResult.highest_similarity>=80?"Attention needed":"No data yet", subC:lastResult&&lastResult.highest_similarity>=80?C.red:C.green, iconEl:<Ic.Alert s={18} c={C.red}/>, iconBg:"#FEF2F2"},
          {label:"Max Score Set",       value:lastResult?`${lastResult.max_score} pts`:"—", sub:lastResult?"Last analysis":"Not set yet", subC:C.purple, iconEl:<Ic.Star s={18} c={C.purple}/>, iconBg:"#F5F3FF"},
        ].map(({label,value,sub,subC,iconEl,iconBg})=>(
          <div key={label} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 18px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:12,color:C.textSm,marginBottom:6}}>{label}</div>
              <div style={{fontSize:26,fontWeight:700,lineHeight:1}}>{value}</div>
              <div style={{fontSize:11,color:subC,marginTop:5}}>{sub}</div>
            </div>
            <div style={{width:36,height:36,background:iconBg,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{iconEl}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:14}}>
        <div style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"18px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{fontWeight:600,fontSize:14}}>Current Session Files</span>
            <button onClick={()=>setPage("upload")} style={{background:"none",border:"none",color:C.blue,fontSize:13,fontWeight:500}}>Upload more</button>
          </div>
          {recent.length===0?(
            <div style={{textAlign:"center",padding:"28px 0",color:C.textSm,fontSize:13}}>
              No files yet.{" "}<button onClick={()=>setPage("upload")} style={{background:"none",border:"none",color:C.blue,fontSize:13,fontWeight:500}}>Upload now →</button>
            </div>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 70px 70px",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:12,color:C.textSm,fontWeight:500}}>
                <span>File</span><span>Student</span><span>Words</span><span>Date</span>
              </div>
              {recent.map((a,i)=>(
                <div key={a.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 70px 70px",padding:"10px 0",fontSize:13,alignItems:"center",borderBottom:i<recent.length-1?`1px solid ${C.border}`:"none"}}>
                  <span style={{fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:8}}>{a.file_name}</span>
                  <span style={{color:C.textSm,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.student_name}</span>
                  <span style={{color:C.textSm}}>{a.word_count?.toLocaleString()}</span>
                  <span style={{color:C.textXs,fontSize:11}}>{a.upload_date?.slice(0,10)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{width:252,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 18px"}}>
            <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>Quick Actions</div>
            <button onClick={()=>setPage("upload")} style={{width:"100%",background:C.blue,color:"#fff",border:"none",borderRadius:7,padding:"10px 0",fontSize:13,fontWeight:600,marginBottom:8}}>Upload Assignments</button>
            <button onClick={()=>setPage("results")} style={{width:"100%",background:"#fff",color:C.blue,border:`1.5px solid ${C.blue}`,borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:600,marginBottom:8}}>Run Analysis</button>
            <button onClick={()=>setPage("scores")} style={{width:"100%",background:"#F5F3FF",color:C.purple,border:`1px solid #DDD6FE`,borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:600,marginBottom:8}}>View Scores</button>
            <button onClick={()=>setPage("reports")} style={{width:"100%",background:"#fff",color:C.textMd,border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:600}}>Download Report</button>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 18px",flex:1}}>
            <div style={{fontWeight:600,fontSize:14,marginBottom:16}}>Activity</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:5,height:70}}>
              {bars.map((h,i)=><div key={i} style={{flex:1,background:C.blue,height:`${(h/42)*64}px`,borderRadius:"3px 3px 0 0",opacity:.85}}/>)}
            </div>
            <div style={{display:"flex",marginTop:5}}>
              {days.map(d=><span key={d} style={{flex:1,fontSize:9,color:C.textXs,textAlign:"center"}}>{d}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div style={{marginTop:16,background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",borderRadius:10,padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{color:"#fff",fontWeight:700,fontSize:15,marginBottom:4}}>Scoring System Active</div>
          <div style={{color:"rgba(255,255,255,.85)",fontSize:13}}>Set your assignment's max score in the Similarity Results page. Each student's score is automatically calculated based on their similarity percentage.</div>
        </div>
        <div style={{fontSize:36}}>🎯</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAGE 2 — UPLOAD
══════════════════════════════════════════════════════════════════ */
function UploadPage({toast}){
  const [dragging,setDragging]=useState(false);
  const [files,setFiles]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [result,setResult]=useState(null);
  const inputRef=useRef();

  const addFiles=incoming=>{
    const arr=Array.from(incoming).filter(f=>[".txt",".pdf",".docx",".doc",".py",".java",".cpp",".c",".js",".ts",".go",".rb"].some(e=>f.name.toLowerCase().endsWith(e)));
    setFiles(prev=>{const names=new Set(prev.map(f=>f.name));return[...prev,...arr.filter(f=>!names.has(f.name))];});
  };
  const onDrop=useCallback(e=>{e.preventDefault();setDragging(false);addFiles(e.dataTransfer.files);},[]);

  const upload=async()=>{
    if(!files.length)return;
    setUploading(true);setResult(null);
    const fd=new FormData();
    files.forEach(f=>fd.append("files",f));
    try{
      const token=getToken();
      const res=await fetch(`${API}/upload`,{method:"POST",headers:{"Authorization":`Bearer ${token}`},body:fd});
      const data=await res.json();
      if(!res.ok){toast(data.error||"Upload failed","error");setUploading(false);return;}
      setResult(data);
      if(data.total>0)toast(`✓ ${data.total} file(s) uploaded`,"ok");
      if(data.errors?.length)toast(`${data.errors.length} error(s)`,"error");
      setFiles([]);
    }catch{toast("Upload failed — is backend running?","error");}
    setUploading(false);
  };

  return(
    <div className="fade">
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:22,fontWeight:700}}>Upload Assignments</h1>
        <p style={{color:C.textSm,fontSize:13,marginTop:3}}>Upload student files. Supported: PDF, TXT, DOCX</p>
      </div>

      <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={onDrop} onClick={()=>inputRef.current.click()}
        style={{background:dragging?"#EFF6FF":C.card,border:`2px dashed ${dragging?C.blue:"#CBD5E1"}`,borderRadius:10,padding:"60px 32px",textAlign:"center",cursor:"pointer",transition:"all .18s",marginBottom:16}}>
        <div style={{width:52,height:52,borderRadius:"50%",border:`2px solid ${C.blue}`,background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px"}}>
          <Ic.Upload s={22} c={C.blue}/>
        </div>
        <div style={{fontWeight:600,fontSize:15,marginBottom:8}}>Drag & drop files here</div>
        <div style={{color:C.textSm,fontSize:13,marginBottom:18}}>or</div>
        <button onClick={e=>{e.stopPropagation();inputRef.current.click();}} style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"10px 28px",fontSize:14,fontWeight:600}}>Browse Files</button>
        <div style={{color:C.textXs,fontSize:12,marginTop:14}}>PDF · TXT · DOCX · PY · JAVA · CPP · C · JS · TS · GO · RB — Max 10 MB per file</div>
        <input ref={inputRef} type="file" multiple accept=".txt,.pdf,.docx,.doc,.py,.java,.cpp,.c,.js,.ts,.go,.rb" style={{display:"none"}} onChange={e=>addFiles(e.target.files)}/>
      </div>

      {files.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 20px",marginBottom:16}}>
          <div style={{fontWeight:600,marginBottom:10,fontSize:13}}>{files.length} file(s) queued</div>
          {files.map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",fontSize:13,borderBottom:i<files.length-1?`1px solid ${C.border}`:"none"}}>
              <span>📄 {f.name}</span>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <span style={{color:C.textSm}}>{(f.size/1024).toFixed(1)} KB</span>
                <span onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))} style={{color:C.red,cursor:"pointer",fontSize:18,lineHeight:1}}>×</span>
              </div>
            </div>
          ))}
          <button onClick={upload} disabled={uploading} style={{marginTop:14,background:C.blue,color:"#fff",border:"none",borderRadius:7,padding:"10px 28px",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:8,opacity:uploading?.7:1}}>
            {uploading?<><Spinner/> Uploading…</>:"Upload Files"}
          </button>
        </div>
      )}

      <div style={{background:"#F8FAFC",border:`1px solid ${C.border}`,borderRadius:10,padding:"18px 20px"}}>
        <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>Upload Tips</div>
        {["Name files as StudentName_Assignment.pdf for automatic name detection","Supported: PDF, TXT, DOCX — and code files: .py .java .cpp .c .js .ts .go .rb","After uploading go to Similarity Results, set the max score and run analysis","Each teacher's files are private — only you can see yours"].map((tip,i)=>(
          <div key={i} style={{display:"flex",gap:8,color:C.textSm,fontSize:13,marginBottom:7}}>
            <span style={{color:C.blue}}>•</span><span>{tip}</span>
          </div>
        ))}
      </div>

      {result&&(
        <div style={{marginTop:14,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 20px"}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>Upload Summary</div>
          {result.uploaded?.length>0&&<>
            <div style={{color:C.green,fontWeight:600,marginBottom:8,fontSize:13}}>✓ {result.uploaded.length} uploaded</div>
            {result.uploaded.map((u,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
                <span>{u.filename}</span>
                <span style={{color:C.textSm}}>{u.word_count?.toLocaleString()} words</span>
              </div>
            ))}
          </>}
          {result.errors?.length>0&&<div style={{marginTop:10}}>
            <div style={{color:C.red,fontWeight:600,fontSize:13,marginBottom:6}}>✗ {result.errors.length} error(s)</div>
            {result.errors.map((e,i)=><div key={i} style={{fontSize:12,color:C.textSm,marginBottom:3}}>{e.filename} — {e.reason}</div>)}
          </div>}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAGE 3 — SIMILARITY RESULTS
   Threshold is HIDDEN from user — fixed at 0.5 on the server.
   Only max_score is sent to /analyze.
   Scores are ALWAYS based on raw similarity — no threshold gate.
══════════════════════════════════════════════════════════════════ */
function SimilarityResultsPage({toast,setPage,setCompareIds}){
  const [maxScore,    setMaxScore]    = useState(100);
  const [customScore, setCustomScore] = useState("");
  const [scoreMode,   setScoreMode]   = useState("preset");
  const [search,      setSearch]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);

  const PRESETS = [10, 25, 50, 100];
  const FIXED_THRESHOLD_DISPLAY = 50; // shown only in matrix legend, not editable

  useEffect(()=>{
    authFetch(`${API}/similarity-results`).then(r=>r.json()).then(d=>{
      if(d && d.max_score){
        setResult(d);
        // restore preset selection if possible
        const ms = d.max_score;
        if(PRESETS.includes(ms)){ setMaxScore(ms); setScoreMode("preset"); }
        else { setCustomScore(String(ms)); setScoreMode("custom"); }
      }
    }).catch(()=>{});
  },[]);

  const effectiveScore = scoreMode==="custom" ? (parseFloat(customScore)||0) : maxScore;

  const runAnalysis = async () => {
    if(effectiveScore<=0){ toast("Max score must be greater than 0","error"); return; }
    setLoading(true);
    try{
      // NOTE: no threshold sent — backend uses fixed value 0.50
      const res  = await authFetch(`${API}/analyze`,{method:"POST",body:JSON.stringify({max_score:effectiveScore})});
      const data = await res.json();
      if(!res.ok){ toast(data.error,"error"); setLoading(false); return; }
      setResult(data);
      toast(`✓ Analysis done — ${data.total_assignments} assignments scored out of ${effectiveScore} pts`,"ok");
    }catch{ toast("Analysis failed — is backend running?","error"); }
    setLoading(false);
  };

  const names       = result?.assignment_names || [];
  const matrix      = result?.matrix           || [];
  const idxs        = names.filter(n=>n.toLowerCase().includes(search.toLowerCase())).map(n=>names.indexOf(n));
  const displayIdxs = idxs.length ? idxs : names.map((_,i)=>i);
  const pairScores  = (result?.pairwise_results||[]).map(p=>p.similarity_score);
  const flaggedCount= pairScores.filter(s=>s>=FIXED_THRESHOLD_DISPLAY).length;
  const avgSim      = pairScores.length ? Math.round(pairScores.reduce((a,b)=>a+b,0)/pairScores.length) : 0;

  return(
    <div className="fade">
      <div style={{marginBottom:22}}>
        <h1 style={{fontSize:22,fontWeight:700}}>Similarity Results</h1>
        <p style={{color:C.textSm,fontSize:13,marginTop:3}}>
          Hybrid TF-IDF + Semantic AI analysis — detects exact and paraphrased copying
        </p>
      </div>

      {/* ── Controls card ── */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"20px 22px",marginBottom:14}}>

        {/* Max score selector */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:10,color:C.text}}>
            📝 Assignment Max Score
            <span style={{fontWeight:400,color:C.textSm,marginLeft:8,fontSize:12}}>— students are scored out of this total</span>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
            {PRESETS.map(p=>(
              <button key={p} onClick={()=>{setMaxScore(p);setScoreMode("preset");}} style={{
                padding:"9px 24px",borderRadius:8,fontSize:14,fontWeight:600,transition:"all .15s",
                border:`2px solid ${scoreMode==="preset"&&maxScore===p?C.blue:C.border}`,
                background:scoreMode==="preset"&&maxScore===p?"#EFF6FF":"#F9FAFB",
                color:scoreMode==="preset"&&maxScore===p?C.blue:C.textMd,
              }}>
                {p} pts
              </button>
            ))}
            <button onClick={()=>setScoreMode("custom")} style={{
              padding:"9px 24px",borderRadius:8,fontSize:14,fontWeight:600,transition:"all .15s",
              border:`2px solid ${scoreMode==="custom"?C.purple:C.border}`,
              background:scoreMode==="custom"?"#F5F3FF":"#F9FAFB",
              color:scoreMode==="custom"?C.purple:C.textMd,
            }}>
              Custom
            </button>
          </div>

          {scoreMode==="custom"&&(
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
              <input type="number" min="1" value={customScore} onChange={e=>setCustomScore(e.target.value)}
                placeholder="e.g. 75"
                style={{width:180,padding:"9px 12px",border:`2px solid ${C.purple}`,borderRadius:8,fontSize:14,color:C.text,outline:"none"}}/>
              <span style={{fontSize:13,color:C.textSm}}>points</span>
            </div>
          )}

          {/* Scoring formula info removed */}
        </div>

        {/* Search + Run */}
        <div style={{display:"flex",alignItems:"flex-end",gap:16,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:12,color:C.textSm,fontWeight:500,marginBottom:6}}>Search Assignments</div>
            <div style={{display:"flex",alignItems:"center",gap:8,background:"#F9FAFB",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke={C.textSm} strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke={C.textSm} strokeWidth="2" strokeLinecap="round"/></svg>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by file name…"
                style={{border:"none",background:"transparent",fontSize:13,color:C.text,width:"100%",outline:"none"}}/>
            </div>
          </div>
          <button onClick={runAnalysis} disabled={loading} style={{
            background:C.blue,color:"#fff",border:"none",borderRadius:8,
            padding:"11px 28px",fontSize:13,fontWeight:600,
            display:"flex",alignItems:"center",gap:8,
            opacity:loading?.7:1,whiteSpace:"nowrap",
          }}>
            {loading?<><Spinner/> Analyzing…</>:"▶  Run Analysis"}
          </button>
        </div>
      </div>

      {/* ── Score summary ── */}
      {result ? (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"18px 20px",marginBottom:14}}>
          <div style={{fontWeight:600,fontSize:15,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>Student Analysis Results</span>
            <button onClick={()=>setPage("scores")} style={{background:"#F5F3FF",color:C.purple,border:"1px solid #DDD6FE",borderRadius:6,padding:"6px 14px",fontSize:12,fontWeight:600}}>
              View Full Scores →
            </button>
          </div>
          {result.student_scores?.length > 0 ? (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",textAlign:"left",borderCollapse:"collapse",minWidth:600}}>
                <thead>
                  <tr style={{borderBottom:`2px solid ${C.border}`, color:C.textSm, fontSize:12, textTransform:"uppercase", letterSpacing:0.5}}>
                    <th style={{padding:"10px 14px", fontWeight:600}}>Roll No</th>
                    <th style={{padding:"10px 14px", fontWeight:600}}>Student Name</th>
                    <th style={{padding:"10px 14px", fontWeight:600}}>Similarity %</th>
                    <th style={{padding:"10px 14px", fontWeight:600}}>Mark Assigned</th>
                    <th style={{padding:"10px 14px", fontWeight:600}}>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {result.student_scores.map((s,i) => {
                    let roll = "—";
                    let name = s.student_name;
                    // Attempt to extract roll no (e.g. 23BAD026) if present at start.
                    const match = name.match(/^([A-Z0-9]+)\s*[-_]?\s*(.*)/i);
                    if(match && /[0-9]/.test(match[1])) {
                      roll = match[1].toUpperCase();
                      name = match[2] || name;
                    }
                    const gc = gradeColor(s.grade);
                    return (
                      <tr key={i} style={{borderBottom: i < result.student_scores.length - 1 ? `1px solid ${C.border}` : "none", fontSize:13, transition:"background .15s", ":hover":{background:"#F9FAFB"}}}>
                        <td style={{padding:"12px 14px", color:C.textMd, fontWeight:500}}>{roll}</td>
                        <td style={{padding:"12px 14px", fontWeight:600, color:C.text}}>{name}</td>
                        <td style={{padding:"12px 14px"}}>
                          <span style={{color: s.max_similarity >= 50 ? C.red : C.textMd, fontWeight: s.max_similarity >= 50 ? 600 : 400}}>
                            {s.max_similarity}%
                          </span>
                        </td>
                        <td style={{padding:"12px 14px", fontWeight:700, color:C.blue}}>
                          {s.awarded_score} <span style={{color:C.textXs, fontWeight:400, marginLeft:2}}>/ {s.max_score}</span>
                        </td>
                        <td style={{padding:"12px 14px"}}>
                          <span style={{display:"inline-block", padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:700, background:gc.bg, color:gc.text}}>
                            {s.grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{padding:"30px 0",textAlign:"center",color:C.textSm,fontSize:13}}>No student scores available.</div>
          )}
        </div>
      ) : (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"40px 20px",textAlign:"center",color:C.textSm,fontSize:13}}>
          Upload assignments then click <strong>Run Analysis</strong> to view column-wise marks segregation.
        </div>
      )}

    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════
   PAGE 4 — ASSIGNMENT GROUPS
══════════════════════════════════════════════════════════════════ */
function AssignmentGroupsPage({toast}){
  const [groups,setGroups]=useState([]);
  const [loading,setLoading]=useState(false);
  const [open,setOpen]=useState({});

  const load=()=>{
    setLoading(true);
    authFetch(`${API}/similarity-results`).then(r=>r.json()).then(d=>{
      if(d&&d.groups){setGroups(d.groups);const f=d.groups.find(g=>g.group_id!=="unique");if(f)setOpen({[f.group_id]:true});toast("✓ Groups loaded","ok");}
      else toast("Run analysis first","error");
    }).catch(()=>toast("Failed to load","error")).finally(()=>setLoading(false));
  };

  useEffect(()=>{load();},[]);

  const flagged=groups.filter(g=>g.group_id!=="unique");
  const unique=groups.find(g=>g.group_id==="unique");
  const high=flagged.filter(g=>g.severity==="HIGH").length;
  const med =flagged.filter(g=>g.severity==="MEDIUM").length;
  const low =flagged.filter(g=>g.severity==="LOW").length;

  return(
    <div className="fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700}}>Assignment Grouping</h1>
          <p style={{color:C.textSm,fontSize:13,marginTop:3}}>Clusters of similar assignments grouped by AI analysis</p>
        </div>
        <button onClick={load} disabled={loading} style={{background:C.card,color:C.textMd,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 16px",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:6}}>
          {loading?<Spinner/>:"↻"} Refresh
        </button>
      </div>

      <div style={{display:"flex",gap:14,marginBottom:20}}>
        {[{label:"High Severity",count:high,sub:"Requires attention",icon:"⚠️",bg:"#FEF2F2",bd:"#FECACA",tc:"#DC2626"},{label:"Medium Severity",count:med,sub:"Should be reviewed",icon:"👥",bg:"#FFFBEB",bd:"#FDE68A",tc:"#D97706"},{label:"Low Severity",count:low,sub:"Minor similarities",icon:"👥",bg:"#F0FDF4",bd:"#BBF7D0",tc:"#16A34A"}].map(({label,count,sub,icon,bg,bd,tc})=>(
          <div key={label} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 20px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{width:30,height:30,borderRadius:6,background:bg,border:`1px solid ${bd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{icon}</div>
              <span style={{fontSize:12,color:tc,fontWeight:500}}>{label}</span>
            </div>
            <div style={{fontSize:28,fontWeight:700}}>{count}</div>
            <div style={{fontSize:12,color:C.textSm,marginTop:4}}>{sub}</div>
          </div>
        ))}
      </div>

      {groups.length===0&&!loading&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"40px",textAlign:"center",color:C.textSm}}>
          No groups found. Go to <strong>Similarity Results</strong> and run analysis first.
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {flagged.map(grp=>{
          const sv=sevColor(grp.severity);
          const isOpen=open[grp.group_id];
          const rowBg=grp.severity==="HIGH"?"#FFF5F5":grp.severity==="MEDIUM"?"#FEFCE8":"#F0FDF4";
          const bd=grp.severity==="HIGH"?"#FECACA":grp.severity==="MEDIUM"?"#FEF08A":"#BBF7D0";
          return(
            <div key={grp.group_id} style={{background:rowBg,border:`1.5px solid ${bd}`,borderRadius:10,overflow:"hidden"}}>
              <div onClick={()=>setOpen(p=>({...p,[grp.group_id]:!p[grp.group_id]}))} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",cursor:"pointer"}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontWeight:600,fontSize:14}}>Group {grp.group_id}</span>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,background:sv.bg,color:sv.text,border:`1px solid ${sv.border}`}}>{grp.severity}</span>
                  </div>
                  <div style={{fontSize:12,color:C.textSm,marginTop:4}}>👥 {grp.member_count} assignment{grp.member_count>1?"s":""} · Avg: {grp.avg_similarity}% · Max: {grp.max_similarity}%</div>
                </div>
                <span style={{color:C.textSm,fontSize:16,userSelect:"none"}}>{isOpen?"∧":"∨"}</span>
              </div>
              {isOpen&&(
                <div style={{padding:"0 20px 16px",borderTop:`1px solid ${bd}`}}>
                  <div style={{background:"#E5E7EB",borderRadius:4,height:5,margin:"12px 0"}}>
                    <div style={{background:sv.text,height:"100%",borderRadius:4,width:`${grp.avg_similarity}%`,transition:"width .8s ease"}}/>
                  </div>
                  {grp.members.map((m,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<grp.members.length-1?`1px solid ${bd}`:"none"}}>
                      <div>
                        <div style={{fontWeight:500,fontSize:13}}>{m.file_name}</div>
                        <div style={{color:C.textSm,fontSize:12,marginTop:2}}>{m.name}</div>
                      </div>
                      <span style={{padding:"3px 10px",borderRadius:6,fontSize:12,fontWeight:700,background:scoreColor(grp.avg_similarity).bg,color:scoreColor(grp.avg_similarity).text,border:`1px solid ${scoreColor(grp.avg_similarity).border}`}}>~{grp.avg_similarity}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {unique&&unique.member_count>0&&(
          <div style={{background:"#F0FDF4",border:"1.5px solid #BBF7D0",borderRadius:10,overflow:"hidden"}}>
            <div onClick={()=>setOpen(p=>({...p,unique:!p.unique}))} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",cursor:"pointer"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontWeight:600,fontSize:14}}>Unique Assignments</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,background:"#DCFCE7",color:"#16A34A",border:"1px solid #BBF7D0"}}>UNIQUE</span>
                </div>
                <div style={{fontSize:12,color:C.textSm,marginTop:4}}>{unique.member_count} assignment(s) with no significant matches</div>
              </div>
              <span style={{color:C.textSm,fontSize:16}}>{open.unique?"∧":"∨"}</span>
            </div>
            {open.unique&&(
              <div style={{padding:"0 20px 16px",borderTop:"1px solid #BBF7D0"}}>
                {unique.members.map((m,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<unique.members.length-1?"1px solid #BBF7D0":"none",fontSize:13}}>
                    <Ic.Check s={14} c={C.green}/>
                    <span style={{fontWeight:500}}>{m.file_name}</span>
                    <span style={{color:C.textSm}}>({m.name})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAGE 5 — STUDENT SCORES  ← NEW PAGE
══════════════════════════════════════════════════════════════════ */
function StudentScoresPage({toast}){
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortBy,  setSortBy]  = useState("score"); // "score" | "name" | "similarity"

  const load=()=>{
    setLoading(true);
    authFetch(`${API}/similarity-results`).then(r=>r.json()).then(d=>{
      if(d&&d.student_scores) setResult(d);
      else toast("Run analysis first (Similarity Results page)","error");
    }).catch(()=>toast("Failed to load","error")).finally(()=>setLoading(false));
  };

  useEffect(()=>{load();},[]);

  const scores = result?.student_scores || [];
  const ms     = result?.max_score || 100;

  const sorted = [...scores].sort((a,b)=>{
    if(sortBy==="name")       return a.student_name.localeCompare(b.student_name);
    if(sortBy==="similarity") return b.max_similarity-a.max_similarity;
    return b.awarded_score-a.awarded_score;
  });

  const gradeCount = g => scores.filter(s=>s.grade===g).length;
  const avgScore   = scores.length ? Math.round(scores.reduce((a,s)=>a+s.awarded_score,0)/scores.length*10)/10 : 0;

  // Scoring formula explanation
  const formulaText = `Score = Max Score × (1 − Similarity%)
Example: Max=100, Similarity=80% → Score = 100 × (1−0.80) = 20 pts
         Max=100, Similarity=0%  → Score = 100 pts (full marks)`;

  return(
    <div className="fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700}}>Student Scores</h1>
          <p style={{color:C.textSm,fontSize:13,marginTop:3}}>
            Scores calculated from similarity analysis — Max: <strong>{ms} points</strong>
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{background:C.card,color:C.textMd,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 16px",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:6}}>
          {loading?<Spinner/>:"↻"} Refresh
        </button>
      </div>

      {/* Scoring formula removed */}

      {/* Grade summary cards */}
      <div style={{display:"flex",gap:12,marginBottom:20}}>
        {[
          {label:"Average Score",   value:`${avgScore}/${ms}`, color:C.blue,   bg:"#EFF6FF", bd:"#BFDBFE"},
          {label:"A Grade (≥90%)", value:gradeCount("A"),    color:"#16A34A", bg:"#DCFCE7", bd:"#BBF7D0"},
          {label:"B Grade (≥80%)", value:gradeCount("B"),    color:"#1D4ED8", bg:"#DBEAFE", bd:"#BFDBFE"},
          {label:"C Grade (≥70%)", value:gradeCount("C"),    color:"#D97706", bg:"#FEF3C7", bd:"#FDE68A"},
          {label:"F Grade (<60%)", value:gradeCount("F"),    color:C.red,     bg:"#FEF2F2", bd:"#FECACA"},
        ].map(({label,value,color,bg,bd})=>(
          <div key={label} style={{flex:1,background:bg,border:`1px solid ${bd}`,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:700,color}}>{value}</div>
            <div style={{fontSize:11,color,marginTop:4}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Sort controls */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <span style={{fontSize:13,color:C.textSm,alignSelf:"center"}}>Sort by:</span>
        {[{id:"score",label:"Score (High→Low)"},{id:"name",label:"Name (A→Z)"},{id:"similarity",label:"Similarity (High→Low)"}].map(s=>(
          <button key={s.id} onClick={()=>setSortBy(s.id)} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${sortBy===s.id?C.blue:C.border}`,background:sortBy===s.id?"#EFF6FF":C.card,color:sortBy===s.id?C.blue:C.textSm,fontSize:12,fontWeight:sortBy===s.id?600:400}}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Scores table */}
      {scores.length===0&&!loading?(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"40px",textAlign:"center",color:C.textSm}}>
          No scores available. Go to <strong>Similarity Results</strong>, set a max score and run the analysis.
        </div>
      ):(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
          {/* Table header */}
          <div style={{display:"grid",gridTemplateColumns:"40px 2fr 1.5fr 110px 120px 110px 80px 60px",padding:"11px 16px",background:"#F9FAFB",borderBottom:`1px solid ${C.border}`,fontSize:11,color:C.textSm,fontWeight:600,textTransform:"uppercase",letterSpacing:0.4}}>
            <span>#</span>
            <span>Student</span>
            <span>File</span>
            <span style={{textAlign:"center"}}>Similarity</span>
            <span style={{textAlign:"center"}}>Score</span>
            <span style={{textAlign:"center"}}>Percentage</span>
            <span style={{textAlign:"center"}}>Grade</span>
            <span style={{textAlign:"center"}}>Status</span>
          </div>

          {sorted.map((s,i)=>{
            const gc=gradeColor(s.grade);
            const sc=scoreColor(s.max_similarity);
            return(
              <div key={s.assignment_id} style={{display:"grid",gridTemplateColumns:"40px 2fr 1.5fr 110px 120px 110px 80px 60px",padding:"13px 16px",borderBottom:i<sorted.length-1?`1px solid ${C.border}`:"none",alignItems:"center",background:s.is_flagged?"#FFFBF5":C.card,transition:"background .15s"}}>
                {/* Rank */}
                <span style={{fontWeight:600,color:C.textSm,fontSize:12}}>#{i+1}</span>

                {/* Student */}
                <div>
                  <div style={{fontWeight:600,fontSize:13}}>{s.student_name}</div>
                  {s.is_flagged&&s.most_similar_to&&(
                    <div style={{fontSize:10,color:C.orange,marginTop:2}}>Similar to: {s.most_similar_to}</div>
                  )}
                </div>

                {/* File */}
                <span style={{fontSize:12,color:C.textSm,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.file_name}</span>

                {/* Similarity */}
                <div style={{textAlign:"center"}}>
                  <span style={{padding:"3px 9px",borderRadius:6,fontSize:12,fontWeight:700,background:sc.bg,color:sc.text,border:`1px solid ${sc.border}`}}>
                    {s.max_similarity}%
                  </span>
                </div>

                {/* Score */}
                <div style={{textAlign:"center"}}>
                  <span style={{fontWeight:700,fontSize:15,color:C.blue}}>{s.awarded_score}</span>
                  <span style={{color:C.textSm,fontSize:11}}>/{ms}</span>
                </div>

                {/* Percentage bar */}
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:3}}>{s.percentage}%</div>
                  <div style={{background:"#E5E7EB",borderRadius:4,height:5}}>
                    <div style={{width:`${s.percentage}%`,height:"100%",background:s.percentage>=70?C.green:s.percentage>=50?C.yellow:C.red,borderRadius:4}}/>
                  </div>
                </div>

                {/* Grade badge */}
                <div style={{textAlign:"center"}}>
                  <span style={{display:"inline-block",width:34,height:34,borderRadius:8,background:gc.bg,color:gc.text,fontWeight:800,fontSize:16,lineHeight:"34px",textAlign:"center"}}>{s.grade}</span>
                </div>

                {/* Status */}
                <div style={{textAlign:"center"}}>
                  {s.is_flagged
                    ?<span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:"#FEF3C7",color:"#D97706",border:"1px solid #FDE68A"}}>⚠ FLAG</span>
                    :<span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:"#DCFCE7",color:"#16A34A",border:"1px solid #BBF7D0"}}>✓ OK</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {scores.length>0&&(
        <div style={{marginTop:14,background:"#F8FAFC",border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px"}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:10}}>Grade Scale</div>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            {[{g:"A",range:"90–100%"},{g:"B",range:"80–89%"},{g:"C",range:"70–79%"},{g:"D",range:"60–69%"},{g:"F",range:"Below 60%"}].map(({g,range})=>{
              const gc=gradeColor(g);
              return(
                <div key={g} style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
                  <span style={{display:"inline-block",width:26,height:26,borderRadius:6,background:gc.bg,color:gc.text,fontWeight:800,fontSize:14,lineHeight:"26px",textAlign:"center"}}>{g}</span>
                  <span style={{color:C.textSm}}>{range}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAGE 6 — VISUALIZATION
══════════════════════════════════════════════════════════════════ */
function VisualizationPage(){
  const [result,setResult]=useState(null);
  useEffect(()=>{authFetch(`${API}/similarity-results`).then(r=>r.json()).then(d=>{if(d&&d.threshold)setResult(d);}).catch(()=>{});},[]);

  const dist=result?.distribution||[{label:"0-20%",count:0},{label:"20-40%",count:0},{label:"40-60%",count:0},{label:"60-80%",count:0},{label:"80-100%",count:0}];
  const maxBar=Math.max(...dist.map(d=>d.count),1);
  const groups=result?.groups||[];
  const flagged=groups.filter(g=>g.group_id!=="unique");
  const totalA=result?.total_assignments||1;
  const highC=flagged.filter(g=>g.severity==="HIGH").reduce((a,g)=>a+g.member_count,0);
  const medC =flagged.filter(g=>g.severity==="MEDIUM").reduce((a,g)=>a+g.member_count,0);
  const lowC =Math.max(0,totalA-highC-medC);
  const pieData=[
    {pct:Math.round((lowC/totalA)*100),color:"#10B981",label:`Low Risk ${Math.round((lowC/totalA)*100)}%`},
    {pct:Math.round((medC/totalA)*100),color:"#F59E0B",label:`Medium Risk ${Math.round((medC/totalA)*100)}%`},
    {pct:Math.round((highC/totalA)*100),color:"#EF4444",label:`High Risk ${Math.round((highC/totalA)*100)}%`},
  ];
  let angle=-90;
  const slices=pieData.map(d=>{const start=angle;angle+=360*(Math.max(d.pct,1)/100);const r=70,cx=90,cy=90,a1=(start*Math.PI)/180,a2=(angle*Math.PI)/180,x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1),x2=cx+r*Math.cos(a2),y2=cy+r*Math.sin(a2);return{...d,d:`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${d.pct>50?1:0},1 ${x2},${y2} Z`};});
  const pairs=(result?.pairwise_results||[]).slice(0,12);

  return(
    <div className="fade">
      <div style={{marginBottom:22}}><h1 style={{fontSize:22,fontWeight:700}}>Similarity Visualization</h1><p style={{color:C.textSm,fontSize:13,marginTop:3}}>Visual insights for your analysis</p></div>
      {!result&&<div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:10,padding:"14px 18px",marginBottom:16,fontSize:13,color:"#92400E"}}>⚠ No data. Go to <strong>Similarity Results</strong> and run analysis first.</div>}
      <div style={{display:"flex",gap:14,marginBottom:14}}>
        <div style={{flex:2,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"18px 20px"}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:20}}>Similarity Distribution</div>
          <div style={{position:"relative",height:160,paddingLeft:28}}>
            {[0,10,20,30,40,50].map(v=><div key={v} style={{position:"absolute",left:0,bottom:28+(v/50)*120,fontSize:10,color:C.textXs,transform:"translateY(50%)"}}>{v}</div>)}
            <div style={{display:"flex",alignItems:"flex-end",height:120,gap:12}}>
              {dist.map((d,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%",justifyContent:"flex-end"}}>
                  <div style={{width:"100%",background:C.blue,borderRadius:"4px 4px 0 0",height:`${(d.count/maxBar)*100}%`,minHeight:d.count>0?4:0}}/>
                  <div style={{fontSize:10,color:C.textSm,marginTop:6,textAlign:"center"}}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"18px 20px"}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>Risk Categories</div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <svg width="180" height="180" viewBox="0 0 180 180">{slices.map((s,i)=><path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth="2"/>)}</svg>
            <div style={{display:"flex",flexDirection:"column",gap:6,width:"100%",marginTop:8}}>
              {pieData.map((d,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}><div style={{width:10,height:10,borderRadius:2,background:d.color,flexShrink:0}}/><span style={{color:d.color,fontWeight:600}}>{d.label}</span></div>)}
            </div>
          </div>
        </div>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"18px 20px",marginBottom:14}}>
        <div style={{fontWeight:600,fontSize:14,marginBottom:14}}>AI Analysis Summary</div>
        <div style={{display:"flex",gap:12}}>
          {[{label:"High Risk Pairs",value:result?(result.pairwise_results||[]).filter(p=>p.similarity_score>=80).length:"—",color:C.red,bg:"#FEF2F2"},{label:"Medium Risk",value:result?(result.pairwise_results||[]).filter(p=>p.similarity_score>=60&&p.similarity_score<80).length:"—",color:C.yellow,bg:"#FFFBEB"},{label:"Low Risk",value:result?(result.pairwise_results||[]).filter(p=>p.similarity_score<60).length:"—",color:C.green,bg:"#F0FDF4"},{label:"Unique",value:result?(result.groups||[]).find(g=>g.group_id==="unique")?.member_count??0:"—",color:C.blue,bg:"#EFF6FF"}].map(({label,value,color,bg})=>(
            <div key={label} style={{flex:1,background:bg,borderRadius:8,padding:"14px 16px",textAlign:"center"}}>
              <div style={{fontSize:24,fontWeight:700,color}}>{value}</div>
              <div style={{fontSize:12,color,marginTop:4}}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      {pairs.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"18px 20px"}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:14}}>Top Similar Pairs</div>
          {pairs.map((p,i)=>{const sc=scoreColor(p.similarity_score);return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:i<pairs.length-1?`1px solid ${C.border}`:"none",fontSize:13}}>
              <span style={{color:C.textXs,fontSize:11,minWidth:24}}>#{i+1}</span>
              <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><strong>{p.assignment1_file}</strong> <span style={{color:C.textSm}}>vs</span> <strong>{p.assignment2_file}</strong></span>
              <div style={{width:80,background:"#E5E7EB",borderRadius:4,height:5}}><div style={{width:`${p.similarity_score}%`,height:"100%",background:sc.text,borderRadius:4}}/></div>
              <span style={{fontWeight:700,color:sc.text,minWidth:44,textAlign:"right"}}>{p.similarity_score}%</span>
            </div>
          );})}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAGE — SENTENCE COMPARE  (NEW)
══════════════════════════════════════════════════════════════════ */
function SentenceComparePage({toast}){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  
  const [assignments, setAssignments]=useState([]);
  const [doc1Id, setDoc1Id]=useState("");
  const [doc2Id, setDoc2Id]=useState("");

  useEffect(()=>{
    authFetch(`${API}/assignments`).then(r=>r.json())
      .then(d=>{if(d&&d.assignments) setAssignments(d.assignments);}).catch(()=>{});
  },[]);

  const runCompare = () => {
    if(!doc1Id || !doc2Id) { toast("Select two assignments","error"); return; }
    if(doc1Id === doc2Id) { toast("Select different assignments","error"); return; }
    setLoading(true);setError("");setData(null);
    authFetch(`${API}/compare/${doc1Id}/${doc2Id}`)
      .then(r=>r.json())
      .then(d=>{
        if(d.error) setError(d.error); else setData(d);
      })
      .catch(()=>setError("Failed to load comparison."))
      .finally(()=>setLoading(false));
  };

  const matchColor=score=>{
    if(score>=80)return{bg:"#FEE2E2",border:"#FCA5A5",text:"#DC2626"};
    if(score>=60)return{bg:"#FEF3C7",border:"#FDE68A",text:"#D97706"};
    return{bg:"#FFF7ED",border:"#FED7AA",text:"#EA580C"};
  };

  return(
    <div className="fade">
      <div style={{marginBottom:22}}>
        <h1 style={{fontSize:22,fontWeight:700}}>Sentence-Level Comparison</h1>
        <p style={{color:C.textSm,fontSize:13,marginTop:3}}>Matching sentences highlighted by similarity score</p>
      </div>

      {/* Selection UI */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",gap:16,alignItems:"flex-end",flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:250}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Assignment 1</div>
            <select value={doc1Id} onChange={e=>setDoc1Id(e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`,outline:"none",fontSize:13}}>
              <option value="">Select an assignment...</option>
              {assignments.map(a=><option key={a.id} value={a.id}>{a.file_name} ({a.student_name})</option>)}
            </select>
          </div>
          <div style={{flex:1,minWidth:250}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Assignment 2</div>
            <select value={doc2Id} onChange={e=>setDoc2Id(e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`,outline:"none",fontSize:13}}>
              <option value="">Select an assignment...</option>
              {assignments.map(a=><option key={a.id} value={a.id}>{a.file_name} ({a.student_name})</option>)}
            </select>
          </div>
          <button onClick={runCompare} disabled={loading} style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"11px 24px",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:8,opacity:loading?.7:1,height:40}}>
            {loading?<Spinner/>:"🔍 Compare"}
          </button>
        </div>
      </div>

      {error&&<div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"12px 16px",color:C.red,fontSize:13,marginBottom:14}}>{error}</div>}

      {data&&(
        <>
          {/* Header cards */}
          <div style={{display:"flex",gap:12,marginBottom:14}}>
            <div style={{flex:1,background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"14px 18px"}}>
              <div style={{fontSize:11,color:C.textSm,marginBottom:4}}>Document 1</div>
              <div style={{fontWeight:700,fontSize:14,color:C.blue}}>{data.file1}</div>
              <div style={{fontSize:12,color:C.textSm,marginTop:2}}>{data.student1}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",color:C.textSm,fontSize:22,fontWeight:300}}>⇄</div>
            <div style={{flex:1,background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:10,padding:"14px 18px"}}>
              <div style={{fontSize:11,color:C.textSm,marginBottom:4}}>Document 2</div>
              <div style={{fontWeight:700,fontSize:14,color:"#D97706"}}>{data.file2}</div>
              <div style={{fontSize:12,color:C.textSm,marginTop:2}}>{data.student2}</div>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{display:"flex",gap:12,marginBottom:18}}>
            {[
              {label:"Matching Sentences",value:data.total,color:data.total>5?C.red:C.orange},
              {label:"Coverage",value:`${data.coverage_pct}%`,color:data.coverage_pct>50?C.red:C.yellow},
              {label:"Sentences in Doc 1",value:data.total_sents1,color:C.text},
              {label:"Sentences in Doc 2",value:data.total_sents2,color:C.text},
            ].map(({label,value,color})=>(
              <div key={label} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:700,color}}>{value}</div>
                <div style={{fontSize:12,color:C.textSm,marginTop:4}}>{label}</div>
              </div>
            ))}
          </div>

          {data.total===0&&(
            <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"32px",textAlign:"center",color:"#065F46"}}>
              <div style={{fontSize:32,marginBottom:10}}>✅</div>
              <div style={{fontWeight:600,fontSize:15}}>No significant sentence matches found</div>
              <div style={{fontSize:13,marginTop:6,color:"#047857"}}>These assignments appear genuinely different at the sentence level.</div>
            </div>
          )}

          {/* Match cards */}
          {data.matches.map((m,i)=>{
            const mc=matchColor(m.score);
            return(
              <div key={i} style={{background:C.card,border:`1.5px solid ${mc.border}`,borderRadius:10,padding:"16px 20px",marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{fontSize:12,color:C.textSm,fontWeight:500}}>Match #{i+1}</span>
                  <span style={{padding:"3px 12px",borderRadius:20,fontSize:12,fontWeight:700,background:mc.bg,color:mc.text,border:`1px solid ${mc.border}`}}>{m.score}% similar</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:7,padding:"12px 14px"}}>
                    <div style={{fontSize:10,color:C.blue,fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Doc 1 — {data.file1}</div>
                    <div style={{fontSize:13,lineHeight:1.6,color:C.text}}>{m.sentence1}</div>
                  </div>
                  <div style={{background:mc.bg,border:`1px solid ${mc.border}`,borderRadius:7,padding:"12px 14px"}}>
                    <div style={{fontSize:10,color:mc.text,fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Doc 2 — {data.file2}</div>
                    <div style={{fontSize:13,lineHeight:1.6,color:C.text}}>{m.sentence2}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAGE 7 — REPORTS
══════════════════════════════════════════════════════════════════ */
function ReportsPage({toast}){
  const [downloading,setDownloading]=useState(false);
  const [resetting,  setResetting]  =useState(false);
  const [result,     setResult]     =useState(null);
  const [sessions,   setSessions]   =useState([]);
  const [viewSession,setViewSession]=useState(null);
  const [loadingHist,setLoadingHist]=useState(false);
  const [aiSummary,  setAiSummary]  =useState("");
  const [aiLoading,  setAiLoading]  =useState(false);
  const [aiError,    setAiError]    =useState("");

  const loadData=()=>{
    authFetch(`${API}/similarity-results`).then(r=>r.json()).then(d=>{if(d&&d.threshold)setResult(d);}).catch(()=>{});
    setLoadingHist(true);
    authFetch(`${API}/sessions`).then(r=>r.json()).then(d=>setSessions(d.sessions||[])).catch(()=>{}).finally(()=>setLoadingHist(false));
  };
  useEffect(()=>{loadData();},[]);

  const download=async()=>{
    setDownloading(true);
    try{const res=await authFetch(`${API}/report`);if(!res.ok){toast("Run analysis first","error");setDownloading(false);return;}const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="eduscan_report.txt";a.click();URL.revokeObjectURL(url);toast("✓ Report downloaded","ok");}catch{toast("Download failed","error");}
    setDownloading(false);
  };

  const downloadSession=async sid=>{
    try{const res=await authFetch(`${API}/sessions/${sid}/report`);if(!res.ok){toast("No report","error");return;}const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`report_session${sid}.txt`;a.click();URL.revokeObjectURL(url);toast(`✓ Session ${sid} downloaded`,"ok");}catch{toast("Download failed","error");}
  };

  const viewPast=async sid=>{
    try{const res=await authFetch(`${API}/sessions/${sid}/results`);const d=await res.json();if(d.error){toast(d.error,"error");return;}setViewSession({...d,_sid:sid});}catch{toast("Failed","error");}
  };

  const resetActive=async()=>{
    if(!window.confirm("Clear current session files?\n\n✓ All past history is KEPT.\n✗ Current uploaded files will be removed.")) return;
    setResetting(true);
    try{const res=await authFetch(`${API}/reset`,{method:"DELETE"});const data=await res.json();toast(`✓ ${data.message}`,"ok");setResult(null);loadData();}catch{toast("Reset failed","error");}
    setResetting(false);
  };

  const displayResult=viewSession||result;
  const topPairs=(displayResult?.pairwise_results||[]).slice(0,5);

  const generateAISummary=async()=>{
    setAiLoading(true);setAiError("");setAiSummary("");
    try{
      const res=await authFetch(`${API}/ai-summary`,{method:"POST"});
      const data=await res.json();
      if(!res.ok){setAiError(data.error||"AI summary failed.");}
      else{setAiSummary(data.summary);toast("✓ AI Summary generated","ok");}
    }catch{setAiError("Cannot connect to backend.");}
    setAiLoading(false);
  };

  return(
    <div className="fade">
      <div style={{marginBottom:22}}><h1 style={{fontSize:22,fontWeight:700}}>Reports & History</h1><p style={{color:C.textSm,fontSize:13,marginTop:3}}>Download reports, generate AI summaries, and view past sessions.</p></div>

      <div style={{display:"flex",gap:10,marginBottom:14}}>
        <button onClick={download} disabled={downloading} style={{flex:1,background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"12px 0",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:downloading?.7:1}}>
          {downloading?<Spinner/>:"⬇"} {downloading?"Generating…":"Download Current Report"}
        </button>
        <button onClick={generateAISummary} disabled={aiLoading||!result} style={{flex:1,background:"linear-gradient(135deg,#7C3AED,#6366F1)",color:"#fff",border:"none",borderRadius:8,padding:"12px 0",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:(aiLoading||!result)?.7:1}}>
          {aiLoading?<><Spinner/> Generating…</>:"✨ AI Summary"}
        </button>
        <button onClick={resetActive} disabled={resetting} style={{background:"#FFF7ED",color:"#92400E",border:"1px solid #FED7AA",borderRadius:8,padding:"12px 18px",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:8,opacity:resetting?.7:1}}>
          {resetting?<Spinner/>:"↺"} {resetting?"Resetting…":"Clear Session"}
        </button>
      </div>

      {/* AI Summary output */}
      {(aiSummary||aiError)&&(
        <div style={{background:aiError?"#FEF2F2":"linear-gradient(135deg,#F5F3FF,#EFF6FF)",border:`1.5px solid ${aiError?"#FECACA":"#C4B5FD"}`,borderRadius:10,padding:"18px 20px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:16}}>✨</span>
            <span style={{fontWeight:700,fontSize:14,color:aiError?C.red:"#5B21B6"}}>AI Academic Integrity Summary</span>
          </div>
          {aiError?<div style={{color:C.red,fontSize:13}}>{aiError}<br/><span style={{fontSize:12,color:C.textSm}}>Make sure GEMINI_API_KEY is set on the backend server.</span></div>:<p style={{fontSize:14,lineHeight:1.8,color:"#1E1B4B"}}>{aiSummary}</p>}
        </div>
      )}

      <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#065F46",display:"flex",gap:10,alignItems:"flex-start"}}>
        <span style={{fontSize:16,flexShrink:0}}>🛡️</span>
        <div><strong>Your history is always safe.</strong> "Clear Current Session" only removes current batch files. All previous sessions stay in the database permanently.</div>
      </div>

      {viewSession&&(
        <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:8,padding:"10px 16px",marginBottom:14,fontSize:13,color:"#92400E",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>📂 Viewing Session #{viewSession._sid} — {viewSession.created_at?.slice(0,10)}</span>
          <button onClick={()=>setViewSession(null)} style={{background:"none",border:"none",color:"#92400E",fontWeight:600,fontSize:13,cursor:"pointer"}}>✕ Back to current</button>
        </div>
      )}

      {/* Report card */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"24px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,paddingBottom:16,borderBottom:`1px solid ${C.border}`}}>
          <div>
            <div style={{fontWeight:700,fontSize:16}}>{viewSession?`Session #${viewSession._sid} Report`:"Current Session Report"}</div>
            <div style={{color:C.textSm,fontSize:12,marginTop:3}}>{displayResult?`Analyzed on ${displayResult.created_at?.slice(0,10)} · Max Score: ${displayResult.max_score} pts`:"No analysis yet"}</div>
          </div>
          <div style={{width:36,height:36,background:"#EFF6FF",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📄</div>
        </div>

        <div style={{display:"flex",gap:40,marginBottom:22}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:12}}>Analysis Parameters</div>
            {[["Threshold:",displayResult?`${Math.round(displayResult.threshold*100)}%`:"—"],["Max Score:",displayResult?`${displayResult.max_score} pts`:"—"],["Total Assignments:",displayResult?.total_assignments??"—"],["Analysis Date:",displayResult?.created_at?.slice(0,10)??"—"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",gap:8,marginBottom:7,fontSize:13}}><span style={{color:C.textSm,minWidth:130}}>{k}</span><span style={{fontWeight:500}}>{v}</span></div>
            ))}
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:12}}>Summary Statistics</div>
            {[["Avg Similarity:",displayResult?`${displayResult.average_similarity}%`:"—",C.text],["Max Similarity:",displayResult?`${displayResult.highest_similarity}%`:"—",C.text],["Flagged Pairs:",displayResult?.flagged_pairs??"—",C.red],["Students Scored:",displayResult?.student_scores?.length??0,C.green]].map(([k,v,vc])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:7,fontSize:13}}><span style={{color:C.textSm}}>{k}</span><span style={{fontWeight:600,color:vc}}>{v}</span></div>
            ))}
          </div>
        </div>

        {/* Top pairs */}
        <div>
          <div style={{fontWeight:600,fontSize:13,marginBottom:12}}>Top Similarity Matches</div>
          {topPairs.length>0?(
            <>
              <div style={{display:"grid",gridTemplateColumns:"40px 1fr 1fr 80px",padding:"9px 14px",background:"#F9FAFB",border:`1px solid ${C.border}`,borderRadius:"7px 7px 0 0",fontSize:12,color:C.textSm,fontWeight:500}}>
                <span>#</span><span>Assignment 1</span><span>Assignment 2</span><span style={{textAlign:"right"}}>Score</span>
              </div>
              {topPairs.map((p,i)=>{const sc=scoreColor(p.similarity_score);return(
                <div key={i} style={{display:"grid",gridTemplateColumns:"40px 1fr 1fr 80px",padding:"11px 14px",border:`1px solid ${C.border}`,borderTop:"none",borderRadius:i===topPairs.length-1?"0 0 7px 7px":0,alignItems:"center",fontSize:13}}>
                  <span style={{fontWeight:600,color:C.textSm}}>{i+1}</span>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:8,fontWeight:500}}>{p.assignment1_file}</span>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:8,color:C.textSm}}>{p.assignment2_file}</span>
                  <span style={{textAlign:"right"}}><span style={{padding:"3px 10px",borderRadius:12,fontSize:12,fontWeight:700,background:sc.bg,color:sc.text}}>{p.similarity_score}%</span></span>
                </div>
              );})}
            </>
          ):<div style={{padding:"20px",textAlign:"center",color:C.textSm,fontSize:13,background:"#F9FAFB",borderRadius:8,border:`1px solid ${C.border}`}}>No results yet.</div>}
        </div>
      </div>

      {/* History */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"20px 24px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>📚 My Analysis History</div>
            <div style={{color:C.textSm,fontSize:12,marginTop:2}}>All your past sessions — other teachers cannot see your data.</div>
          </div>
          <button onClick={loadData} style={{background:"#F3F4F6",border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 14px",fontSize:12,fontWeight:500,color:C.textMd}}>↻ Refresh</button>
        </div>

        {loadingHist?<div style={{padding:"20px",textAlign:"center"}}><Spinner/></div>
        :sessions.length===0?<div style={{padding:"20px",textAlign:"center",color:C.textSm,fontSize:13}}>No sessions yet.</div>
        :(
          <>
            <div style={{display:"grid",gridTemplateColumns:"55px 1fr 70px 70px 80px 70px 80px 110px",padding:"8px 12px",background:"#F9FAFB",border:`1px solid ${C.border}`,borderRadius:"7px 7px 0 0",fontSize:11,color:C.textSm,fontWeight:600,textTransform:"uppercase",letterSpacing:0.4}}>
              <span>ID</span><span>Session</span><span style={{textAlign:"center"}}>Files</span><span style={{textAlign:"center"}}>Flagged</span><span style={{textAlign:"center"}}>Highest</span><span style={{textAlign:"center"}}>Max Pts</span><span style={{textAlign:"center"}}>Status</span><span style={{textAlign:"right"}}>Actions</span>
            </div>
            {sessions.map((s,i)=>{
              const isActive=s.is_active===1;
              const hasResult=s.analyzed_at!=null;
              return(
                <div key={s.id} style={{display:"grid",gridTemplateColumns:"55px 1fr 70px 70px 80px 70px 80px 110px",padding:"11px 12px",alignItems:"center",fontSize:13,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:i===sessions.length-1?"0 0 7px 7px":0,background:isActive?"#EFF6FF":C.card}}>
                  <span style={{fontFamily:"monospace",fontWeight:700,color:isActive?C.blue:C.textSm}}>#{s.id}</span>
                  <div><div style={{fontWeight:500,fontSize:12}}>{s.label}</div><div style={{fontSize:10,color:C.textXs}}>{s.created_at?.slice(0,16).replace("T"," ")}</div></div>
                  <span style={{textAlign:"center",fontWeight:600}}>{s.assignment_count??0}</span>
                  <span style={{textAlign:"center",color:s.flagged_pairs>0?C.red:C.textSm,fontWeight:s.flagged_pairs>0?700:400}}>{s.flagged_pairs??"—"}</span>
                  <span style={{textAlign:"center"}}>{s.highest_similarity!=null?(()=>{const sc=scoreColor(s.highest_similarity);return<span style={{padding:"2px 7px",borderRadius:5,fontSize:11,fontWeight:700,background:sc.bg,color:sc.text}}>{s.highest_similarity}%</span>;})():<span style={{color:C.textXs}}>—</span>}</span>
                  <span style={{textAlign:"center",fontSize:12,fontWeight:600,color:C.purple}}>{s.max_score?`${s.max_score}pts`:"—"}</span>
                  <span style={{textAlign:"center"}}>
                    {isActive?<span style={{background:"#DBEAFE",color:C.blue,border:"1px solid #BFDBFE",padding:"2px 7px",borderRadius:10,fontSize:11,fontWeight:600}}>Active</span>
                    :hasResult?<span style={{background:"#DCFCE7",color:"#16A34A",border:"1px solid #BBF7D0",padding:"2px 7px",borderRadius:10,fontSize:11,fontWeight:600}}>Done</span>
                    :<span style={{background:"#F3F4F6",color:C.textSm,border:`1px solid ${C.border}`,padding:"2px 7px",borderRadius:10,fontSize:11,fontWeight:600}}>Empty</span>}
                  </span>
                  <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
                    {hasResult&&!isActive&&<>
                      <button onClick={()=>viewPast(s.id)} style={{background:"#EFF6FF",color:C.blue,border:"1px solid #BFDBFE",borderRadius:5,padding:"4px 8px",fontSize:11,fontWeight:600}}>View</button>
                      <button onClick={()=>downloadSession(s.id)} style={{background:"#F0FDF4",color:"#16A34A",border:"1px solid #BBF7D0",borderRadius:5,padding:"4px 8px",fontSize:11,fontWeight:600}}>⬇</button>
                    </>}
                    {isActive&&<span style={{color:C.blue,fontSize:11,fontStyle:"italic"}}>current</span>}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div style={{background:"linear-gradient(135deg,#3B82F6,#6366F1)",borderRadius:10,padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{color:"#fff",fontWeight:700,fontSize:14,marginBottom:4}}>Download Full Report</div>
          <div style={{color:"rgba(255,255,255,.8)",fontSize:13,marginBottom:14}}>Includes similarity analysis AND complete student score table.</div>
          <button onClick={download} style={{background:"#fff",color:C.blue,border:"none",borderRadius:6,padding:"8px 18px",fontSize:12,fontWeight:600}}>⬇ Download Report</button>
        </div>
        <div style={{fontSize:36,opacity:.9}}>📊</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════════════════════════════ */
export default function App(){
  const [user,        setUser]        = useState(()=>getUser());
  const [page,        setPage]        = useState("dashboard");
  const [toastState,  setToastState]  = useState({msg:"",type:"ok"});
  const [regSuccess,  setRegSuccess]  = useState("");
  const [compareIds,  setCompareIds]  = useState(null); // {id1, id2}

  const toast=(msg,type="ok")=>{setToastState({msg,type});setTimeout(()=>setToastState({msg:"",type:"ok"}),3500);};

  const handleLogin=teacher=>{setUser(teacher);setPage("dashboard");setRegSuccess("");};
  const handleLogout=()=>{clearAuth();setUser(null);setPage("dashboard");};

  const goCompare=(id1,id2)=>{setCompareIds({id1,id2});setPage("compare");};

  if(!user){
    return(
      <>
        <style>{CSS}</style>
        {regSuccess&&(
          <div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"12px 24px",color:C.green,fontWeight:600,fontSize:14,boxShadow:"0 4px 16px rgba(0,0,0,.1)"}}>
            ✓ Account created! Please sign in with your email.
          </div>
        )}
        <AuthPages onLogin={handleLogin}/>
        <Toast msg={toastState.msg} type={toastState.type}/>
      </>
    );
  }

  const pages={
    dashboard:<DashboardPage setPage={setPage} user={user}/>,
    upload:   <UploadPage toast={toast}/>,
    results:  <SimilarityResultsPage toast={toast} setPage={setPage} setCompareIds={goCompare}/>,
    groups:   <AssignmentGroupsPage toast={toast}/>,
    scores:   <StudentScoresPage toast={toast}/>,
    compare:  <SentenceComparePage toast={toast} compareIds={compareIds} setPage={setPage}/>,
    viz:      <VisualizationPage/>,
    reports:  <ReportsPage toast={toast}/>,
  };

  return(
    <>
      <style>{CSS}</style>
      <div style={{display:"flex",minHeight:"100vh"}}>
        <Sidebar page={page} setPage={setPage} user={user} onLogout={handleLogout}/>
        <main style={{marginLeft:204,flex:1,padding:"28px 28px 48px",minHeight:"100vh",background:C.bg}}>
          {pages[page]}
        </main>
      </div>
      <Toast msg={toastState.msg} type={toastState.type}/>
    </>
  );
}