import { useState, useEffect, useRef, useCallback } from "react";

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Upgrade {
  id: string; name: string; desc: string; cost: number;
  clickBonus: number; productionMultiplier?: number;
  icon: string; requires: number; act: number;
}
interface Building {
  id: string; name: string; desc: string;
  baseCost: number; baseProduction: number; icon: string; act: number;
}
interface FloatItem { id: number; x: number; y: number; amount: number; }
interface BuildingCounts { [key: string]: number; }
interface SaveData {
  version: number; pseudo: string; strawberries: number; euros: number;
  totalEuros: number; clickPower: number; productionMultiplier: number;
  boughtUpgrades: string[]; buildings: BuildingCounts; currentAct: number;
  prestigeCount: number; prestigeMultiplier: number; gameFinished: boolean;
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const SAVE_KEY = "chapardeur_save_v3";
const SAVE_KEYS_LEGACY = ["chapardeur_save_v1", "chapardeur_save_v2"];
const STRAWBERRY_VALUE = 0.10;
// ACT_GOALS[n] = total euros needed to ENTER act n
const ACT_GOALS = [0, 0, 500, 50000, 2000000, 50000000, 1000000000];
const ACT_LABELS = ["","Acte I — Le Chapardeur","Acte II — Le Micro-Maraîcher","Acte III — L'Exploitant","Acte IV — L'Agri-Entrepreneur","Acte V — L'Industriel","Acte VI — La Multinationale"];
const ACT_CONTEXTS = ["","Le Marché de Rungis, 6h du matin","Ta parcelle à Montreuil","Ton exploitation à Chartres","Ton domaine de 50 hectares","Ton usine agroalimentaire","Ton siège mondial, Paris 8e"];
const ACT_CLICK_LABELS = ["","Voler des fraises","Récolter à la main","Superviser les parcelles","Signer des contrats","Lancer des appels d'offres","Décider des acquisitions"];
const ACT_EMOJIS = ["","🍓","🌿","🌾","📋","🏭","🌍"];
const ACT_COLORS = ["","#f97316","#4ade80","#facc15","#60a5fa","#c084fc","#f43f5e"];
const ACT_BG = ["","linear-gradient(160deg,#1a0a00,#2d1200,#1a0500)","linear-gradient(160deg,#052e16,#14532d,#052e16)","linear-gradient(160deg,#1c1400,#3d2e00,#1c1400)","linear-gradient(160deg,#0c1a2e,#1e3a5f,#0c1a2e)","linear-gradient(160deg,#1a0030,#3b0764,#1a0030)","linear-gradient(160deg,#1a0010,#4c0519,#1a0010)"];

const ALL_BUILDINGS: Building[] = [
  {id:"basket",name:"Panier automatique",desc:"Un mécanisme bricolé. 0.5 fraise/sec.",baseCost:25,baseProduction:0.5,icon:"🧺",act:1},
  {id:"fraisier",name:"Fraisier planté",desc:"Ta première vraie culture. 5€/sec.",baseCost:200,baseProduction:5,icon:"🌱",act:2},
  {id:"poulailler",name:"Poulailler",desc:"Œufs frais vendus au marché. 20€/sec.",baseCost:500,baseProduction:20,icon:"🐔",act:2},
  {id:"ruche",name:"Ruche",desc:"Miel bio toutes saisons. 50€/sec.",baseCost:1200,baseProduction:50,icon:"🐝",act:2},
  {id:"serre",name:"Serre tunnel",desc:"Production toute l'année. 150€/sec.",baseCost:5000,baseProduction:150,icon:"🏚️",act:2},
  {id:"ble",name:"Champ de blé",desc:"Grande culture rentable. 500€/sec.",baseCost:15000,baseProduction:500,icon:"🌾",act:3},
  {id:"verger",name:"Verger de pommes",desc:"Pommes vendues en GMS. 1 200€/sec.",baseCost:40000,baseProduction:1200,icon:"🍎",act:3},
  {id:"vigne",name:"Vigne",desc:"Vin vendu en bouteille. 3 000€/sec.",baseCost:100000,baseProduction:3000,icon:"🍇",act:3},
  {id:"tracteur",name:"Tracteur John Deere",desc:"Récolte mécanisée. 8 000€/sec.",baseCost:300000,baseProduction:8000,icon:"🚜",act:4},
  {id:"moissonneuse",name:"Moissonneuse-batteuse",desc:"Récolte automatisée. 25 000€/sec.",baseCost:800000,baseProduction:25000,icon:"⚙️",act:4},
  {id:"cooperative",name:"Coopérative agricole",desc:"Mutualisation des ressources. 80 000€/sec.",baseCost:3000000,baseProduction:80000,icon:"🤝",act:4},
  {id:"usine",name:"Usine de transformation",desc:"Marges industrielles. 300 000€/sec.",baseCost:10000000,baseProduction:300000,icon:"🏭",act:5},
  {id:"marque",name:"Marque propre (MDD)",desc:"Distribution nationale. 800 000€/sec.",baseCost:30000000,baseProduction:800000,icon:"🏷️",act:5},
  {id:"lobbying",name:"Lobbying PAC",desc:"Subventions optimisées. 2 000 000€/sec.",baseCost:100000000,baseProduction:2000000,icon:"🏛️",act:5},
  {id:"fonds",name:"Fonds d'investissement",desc:"L'argent fait l'argent. 8 000 000€/sec.",baseCost:400000000,baseProduction:8000000,icon:"💼",act:6},
  {id:"acquisition",name:"Acquisition de coopératives",desc:"Rachat en série. 30 000 000€/sec.",baseCost:1500000000,baseProduction:30000000,icon:"🏢",act:6},
  {id:"monopole",name:"Monopole mondial des céréales",desc:"Tu contrôles la filière. 150 000 000€/sec.",baseCost:8000000000,baseProduction:150000000,icon:"🌍",act:6},
];

const ALL_UPGRADES: Upgrade[] = [
  {id:"fast_hands",name:"Mains rapides",desc:"+1/clic. Tu t'entraînes la nuit.",cost:15,clickBonus:1,icon:"⚡",requires:0,act:1},
  {id:"hidden_basket",name:"Panier caché",desc:"+3/clic. Fond double dans ton sac.",cost:80,clickBonus:3,icon:"🧺",requires:1,act:1},
  {id:"market_friend",name:"Complicité du maraîcher",desc:"+8/clic. Il ferme les yeux.",cost:350,clickBonus:8,icon:"🤝",requires:2,act:1},
  {id:"compost",name:"Compost maison",desc:"+5/clic. Tes plants poussent plus vite.",cost:800,clickBonus:5,icon:"♻️",requires:0,act:2},
  {id:"drip",name:"Goutte-à-goutte",desc:"+10/clic. Irrigation optimisée.",cost:3000,clickBonus:10,icon:"💧",requires:1,act:2},
  {id:"market_stall",name:"Stand au marché",desc:"+20/clic. Vente directe aux clients.",cost:12000,clickBonus:20,icon:"🏪",requires:2,act:2},
  {id:"rotation",name:"Rotation des cultures",desc:"+30/clic. Sols enrichis naturellement.",cost:80000,clickBonus:30,icon:"🔄",requires:0,act:3},
  {id:"label_bio",name:"Label Agriculture Bio",desc:"+50/clic. Prix premium sur le marché.",cost:300000,clickBonus:50,icon:"🌿",requires:1,act:3},
  {id:"gms_contract",name:"Contrat GMS",desc:"×2 sur toutes les ventes.",cost:800000,clickBonus:0,productionMultiplier:2,icon:"🛒",requires:2,act:3},
  {id:"gps_farm",name:"GPS agricole",desc:"+100/clic. Précision centimétrique.",cost:2000000,clickBonus:100,icon:"📡",requires:0,act:4},
  {id:"drones",name:"Drones de surveillance",desc:"+200/clic. Vision totale.",cost:8000000,clickBonus:200,icon:"🚁",requires:1,act:4},
  {id:"data_farming",name:"Data farming IA",desc:"×1.5 sur toutes les ventes.",cost:25000000,clickBonus:0,productionMultiplier:1.5,icon:"🤖",requires:2,act:4},
  {id:"iso",name:"Certification ISO 22000",desc:"+500/clic. Accès aux marchés premium.",cost:80000000,clickBonus:500,icon:"📋",requires:0,act:5},
  {id:"export_eu",name:"Export Europe",desc:"+1000/clic. Marchés allemand et britannique.",cost:300000000,clickBonus:1000,icon:"🇪🇺",requires:1,act:5},
  {id:"opa",name:"OPA sur concurrents",desc:"×2 sur toutes les ventes.",cost:800000000,clickBonus:0,productionMultiplier:2,icon:"📈",requires:2,act:5},
  {id:"sovereign",name:"Contrats souverains",desc:"+5000/clic. États clients directs.",cost:3000000000,clickBonus:5000,icon:"🏴",requires:0,act:6},
  {id:"ipo_prep",name:"Préparation IPO",desc:"×3 sur toutes les ventes. La fin approche.",cost:8000000000,clickBonus:0,productionMultiplier:3,icon:"🔔",requires:1,act:6},
];

const DEFAULT_BUILDINGS: BuildingCounts = {
  basket:0,fraisier:0,poulailler:0,ruche:0,serre:0,
  ble:0,verger:0,vigne:0,tracteur:0,moissonneuse:0,cooperative:0,
  usine:0,marque:0,lobbying:0,fonds:0,acquisition:0,monopole:0,
};

// ── HELPERS ────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1e12) return `${(n/1e12).toFixed(2)}T€`;
  if (n >= 1e9)  return `${(n/1e9).toFixed(2)}Md€`;
  if (n >= 1e6)  return `${(n/1e6).toFixed(2)}M€`;
  if (n >= 1e3)  return `${(n/1e3).toFixed(2)}k€`;
  return `${n.toFixed(2)}€`;
}
function buildingCost(b: Building, count: number): number {
  return Math.floor(b.baseCost * Math.pow(1.15, count));
}
function migrateAndLoad(): Partial<SaveData> | null {
  let raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    for (const k of SAVE_KEYS_LEGACY) {
      const leg = localStorage.getItem(k);
      if (leg) { raw = leg; localStorage.removeItem(k); break; }
    }
  }
  if (!raw) return null;
  try { return JSON.parse(raw) as Partial<SaveData>; } catch { return null; }
}

// ── FLOATING TEXT ──────────────────────────────────────────────────────────
function FloatingText({ items }: { items: FloatItem[] }) {
  return (
    <div style={{pointerEvents:"none",position:"absolute",inset:0,overflow:"hidden"}}>
      {items.map(item => (
        <div key={item.id} style={{
          position:"absolute",left:item.x,top:item.y,
          color:"#f97316",fontWeight:"bold",fontSize:"0.85rem",
          textShadow:"0 1px 3px rgba(0,0,0,0.6)",
          animation:"floatUp 1.2s ease-out forwards",
          transform:"translateX(-50%)",whiteSpace:"nowrap",
        }}>+{item.amount}</div>
      ))}
    </div>
  );
}

// ── IPO SCREEN ─────────────────────────────────────────────────────────────
function IpoScreen({pseudo,totalEuros,prestigeCount,onPrestige,onLeaderboard}: {
  pseudo:string;totalEuros:number;prestigeCount:number;onPrestige:()=>void;onLeaderboard:()=>void;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(()=>setStep(1),800);
    const t2 = setTimeout(()=>setStep(2),2200);
    const t3 = setTimeout(()=>setStep(3),3800);
    return ()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  }, []);
  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(135deg,#000000,#0d0020,#000000)",
      display:"flex",alignItems:"center",justifyContent:"center",
      fontFamily:"'Georgia',serif",padding:"2rem 1rem",textAlign:"center",
    }}>
      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ticker{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
        @keyframes goldPulse{0%,100%{box-shadow:0 0 30px rgba(234,179,8,0.4)}50%{box-shadow:0 0 80px rgba(234,179,8,0.9)}}
        @keyframes floatUp{0%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(-60px)}}
      `}</style>
      <div style={{maxWidth:440,width:"100%"}}>
        <div style={{background:"#0a0800",border:"1px solid #92400e",borderRadius:6,overflow:"hidden",marginBottom:"2rem",padding:"0.4rem 0"}}>
          <div style={{animation:"ticker 10s linear infinite",whiteSpace:"nowrap",color:"#fde047",fontSize:"0.75rem"}}>
            📈 AGRI-{pseudo.toUpperCase().slice(0,4)} +{(Math.random()*40+20).toFixed(1)}% &nbsp;&nbsp;
            💰 CAPITALISATION : {fmt(totalEuros*12)} &nbsp;&nbsp;
            🏆 INTRODUCTION EN BOURSE RÉUSSIE &nbsp;&nbsp;
            🍓 → 🌍 DE LA FRAISE À LA FORTUNE &nbsp;&nbsp;
          </div>
        </div>
        <div style={{fontSize:52,marginBottom:"1rem"}}>🔔</div>
        <h1 style={{fontSize:"1.8rem",color:"#fde047",margin:"0 0 0.5rem",textShadow:"0 2px 20px rgba(234,179,8,0.6)"}}>
          Introduction en Bourse
        </h1>
        {step>=1&&<p style={{color:"#fed7aa",fontSize:"0.95rem",margin:"0 0 1.5rem",animation:"fadeInUp 0.8s ease",lineHeight:1.6}}>
          {pseudo}, ton empire agroalimentaire entre aujourd'hui sur Euronext Paris.<br/>
          <span style={{color:"#a3714a",fontSize:"0.8rem"}}>De la fraise volée à la multinationale cotée.</span>
        </p>}
        {step>=2&&<div style={{
          background:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.4)",
          borderRadius:16,padding:"1.2rem",marginBottom:"1.5rem",animation:"fadeInUp 0.8s ease",
        }}>
          <div style={{fontSize:"0.65rem",color:"#a3714a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.4rem"}}>Valorisation finale</div>
          <div style={{fontSize:"2rem",fontWeight:"bold",color:"#fde047"}}>{fmt(totalEuros*12)}</div>
          <div style={{fontSize:"0.72rem",color:"#a3714a",marginTop:4}}>
            Revenus cumulés : {fmt(totalEuros)} · Prestiges : {prestigeCount}
          </div>
        </div>}
        {step>=3&&<div style={{animation:"fadeInUp 0.8s ease",display:"flex",flexDirection:"column",gap:"0.75rem"}}>
          <button onClick={onLeaderboard} style={{
            padding:"0.9rem",borderRadius:12,border:"2px solid #fde047",
            background:"transparent",color:"#fde047",fontSize:"1rem",
            fontWeight:"bold",cursor:"pointer",animation:"goldPulse 2s ease-in-out infinite",outline:"none",
          }}>🏆 Voir le Classement Mondial</button>
          <button onClick={onPrestige} style={{
            padding:"0.85rem",borderRadius:12,border:"1px solid rgba(255,255,255,0.2)",
            background:"rgba(255,255,255,0.05)",color:"#fed7aa",fontSize:"0.9rem",
            cursor:"pointer",outline:"none",
          }}>🔄 Nouvelle Partie+ (×{(2+prestigeCount*0.5).toFixed(1)} bonus permanent)</button>
        </div>}
      </div>
    </div>
  );
}

// ── LEADERBOARD ────────────────────────────────────────────────────────────
function LeaderboardScreen({pseudo,score,onBack}: {pseudo:string;score:number;onBack:()=>void}) {
  const rows = [
    {pseudo:"AgroKing",score:98000000000},
    {pseudo:"FermeInfinie",score:72000000000},
    {pseudo:"MaraîcherFou",score:45000000000},
    {pseudo,score,isYou:true},
  ].sort((a,b)=>b.score-a.score);
  return (
    <div style={{
      minHeight:"100vh",background:"linear-gradient(160deg,#0a0a0a,#1a1a2e)",
      fontFamily:"'Georgia',serif",color:"#fed7aa",maxWidth:480,margin:"0 auto",padding:"1.5rem 1rem",
    }}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#a3714a",fontSize:"0.85rem",cursor:"pointer",marginBottom:"1rem",padding:0}}>← Retour</button>
      <h2 style={{color:"#fde047",margin:"0 0 0.25rem",fontSize:"1.4rem"}}>🏆 Classement Mondial</h2>
      <p style={{color:"#a3714a",fontSize:"0.72rem",margin:"0 0 1.5rem",fontStyle:"italic"}}>
        Connexion Supabase à venir — données de démonstration
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
        {rows.map((r,i)=>{
          const isYou="isYou"in r&&r.isYou;
          return (
            <div key={i} style={{
              display:"flex",alignItems:"center",gap:"0.75rem",
              background:isYou?"rgba(234,179,8,0.15)":"rgba(255,255,255,0.04)",
              border:`1px solid ${isYou?"rgba(234,179,8,0.5)":"rgba(255,255,255,0.08)"}`,
              borderRadius:10,padding:"0.75rem 1rem",
            }}>
              <div style={{fontSize:"1rem",fontWeight:"bold",minWidth:28,color:i===0?"#fde047":i===1?"#d1d5db":i===2?"#f97316":"#a3714a"}}>
                {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:"bold",color:isYou?"#fde047":"#fed7aa"}}>{r.pseudo}{isYou&&" ← toi"}</div>
                <div style={{fontSize:"0.7rem",color:"#a3714a"}}>Valorisation : {fmt(r.score*12)}</div>
              </div>
              <div style={{color:"#f97316",fontWeight:"bold",fontSize:"0.82rem"}}>{fmt(r.score)}</div>
            </div>
          );
        })}
      </div>
      <p style={{color:"#5c3317",fontSize:"0.62rem",textAlign:"center",marginTop:"2rem"}}>
        Le vrai leaderboard sera connecté à Supabase prochainement.
      </p>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────
export default function App() {
  const [pseudo,setPseudo]=useState("");
  const [inputPseudo,setInputPseudo]=useState("");
  const [started,setStarted]=useState(false);
  const [currentAct,setCurrentAct]=useState(1);
  const [gameFinished,setGameFinished]=useState(false);
  const [showLeaderboard,setShowLeaderboard]=useState(false);
  const [strawberries,setStrawberries]=useState(0);
  const [euros,setEuros]=useState(0);
  const [totalEuros,setTotalEuros]=useState(0);
  const [clickPower,setClickPower]=useState(1);
  const [prodMult,setProdMult]=useState(1);
  const [boughtUpgrades,setBoughtUpgrades]=useState<string[]>([]);
  const [buildings,setBuildings]=useState<BuildingCounts>({...DEFAULT_BUILDINGS});
  const [floats,setFloats]=useState<FloatItem[]>([]);
  const [banner,setBanner]=useState("");
  const [clickAnim,setClickAnim]=useState(false);
  const [prestigeCount,setPrestigeCount]=useState(0);
  const [prestigeMult,setPrestigeMult]=useState(1);

  const eurosRef=useRef(euros); eurosRef.current=euros;
  const totalRef=useRef(totalEuros); totalRef.current=totalEuros;
  const strawRef=useRef(strawberries); strawRef.current=strawberries;

  const showBanner=(msg:string)=>{ setBanner(msg); setTimeout(()=>setBanner(""),6000); };

  // LOAD + MIGRATE
  useEffect(()=>{
    const s=migrateAndLoad();
    if(!s) return;
    setPseudo(s.pseudo||"");
    setStarted(!!s.pseudo);
    setStrawberries(s.strawberries||0);
    setEuros(s.euros||0);
    setTotalEuros(s.totalEuros||0);
    setClickPower(s.clickPower||1);
    setProdMult(s.productionMultiplier||1);
    setBoughtUpgrades(s.boughtUpgrades||[]);
    setBuildings({...DEFAULT_BUILDINGS,...(s.buildings||{})});
    setCurrentAct(s.currentAct||1);
    setPrestigeCount(s.prestigeCount||0);
    setPrestigeMult(s.prestigeMultiplier||1);
    setGameFinished(s.gameFinished||false);
  },[]);

  // AUTO SAVE
  useEffect(()=>{
    if(!started) return;
    const interval=setInterval(()=>{
      localStorage.setItem(SAVE_KEY,JSON.stringify({
        version:3,pseudo,strawberries:strawRef.current,euros:eurosRef.current,
        totalEuros:totalRef.current,clickPower,productionMultiplier:prodMult,
        boughtUpgrades,buildings,currentAct,prestigeCount,prestigeMultiplier:prestigeMult,gameFinished,
      }));
    },10000);
    return ()=>clearInterval(interval);
  },[started,pseudo,clickPower,prodMult,boughtUpgrades,buildings,currentAct,prestigeCount,prestigeMult,gameFinished]);

  // GAME LOOP
  useEffect(()=>{
    if(!started||gameFinished) return;
    const fps=10;
    const interval=setInterval(()=>{
      const basket=ALL_BUILDINGS.find(b=>b.id==="basket");
      const basketProd=basket?(basket.baseProduction*(buildings["basket"]??0))/fps:0;
      const directProd=ALL_BUILDINGS.filter(b=>b.act>=2).reduce((acc,b)=>acc+(b.baseProduction*(buildings[b.id]??0))/fps,0);
      const rawEarned=basketProd*STRAWBERRY_VALUE+directProd;
      const earned=rawEarned*prodMult*prestigeMult;
      setStrawberries(s=>s+basketProd);
      setEuros(e=>e+earned);
      setTotalEuros(t=>{
        const n=t+earned;
        checkActTransition(n,currentAct);
        return n;
      });
    },1000/fps);
    return ()=>clearInterval(interval);
  },[started,buildings,currentAct,prodMult,prestigeMult,gameFinished]);

  const checkActTransition=(newTotal:number,act:number)=>{
    for(let a=2;a<=6;a++){
      if(act===a-1&&newTotal>=ACT_GOALS[a]){
        setCurrentAct(a);
        if(a<6) showBanner(`${ACT_EMOJIS[a]} ${ACT_LABELS[a]} débloqué !`);
        else { setGameFinished(true); showBanner("🔔 Tu as atteint le sommet. L'IPO t'attend."); }
      }
    }
  };

  const handleClick=useCallback((e:React.MouseEvent<HTMLButtonElement>)=>{
    const rect=e.currentTarget.getBoundingClientRect();
    const x=e.clientX-rect.left; const y=e.clientY-rect.top;
    const earned=clickPower*STRAWBERRY_VALUE*prodMult*prestigeMult;
    setStrawberries(s=>s+clickPower);
    setEuros(ev=>ev+earned);
    setTotalEuros(t=>{ const n=t+earned; checkActTransition(n,currentAct); return n; });
    setClickAnim(true); setTimeout(()=>setClickAnim(false),120);
    const id=Date.now()+Math.random();
    setFloats(f=>[...f,{id,x,y,amount:clickPower}]);
    setTimeout(()=>setFloats(f=>f.filter(i=>i.id!==id)),1200);
  },[clickPower,currentAct,prodMult,prestigeMult]);

  const buyUpgrade=(u:Upgrade)=>{
    if(euros<u.cost||boughtUpgrades.includes(u.id)) return;
    setEuros(e=>e-u.cost);
    setBoughtUpgrades(prev=>[...prev,u.id]);
    if(u.clickBonus) setClickPower(p=>p+u.clickBonus);
    if(u.productionMultiplier) setProdMult(m=>m*u.productionMultiplier!);
  };

  const buyBuilding=(b:Building)=>{
    const count=buildings[b.id]??0;
    const cost=buildingCost(b,count);
    if(euros<cost) return;
    setEuros(e=>e-cost);
    setBuildings(prev=>({...prev,[b.id]:(prev[b.id]??0)+1}));
  };

  const handlePrestige=()=>{
    const nc=prestigeCount+1; const nm=1+nc*0.5;
    setPrestigeCount(nc); setPrestigeMult(nm);
    setEuros(0); setTotalEuros(0); setStrawberries(0);
    setClickPower(1); setProdMult(1); setBoughtUpgrades([]);
    setBuildings({...DEFAULT_BUILDINGS}); setCurrentAct(1); setGameFinished(false);
    showBanner(`🔄 Nouvelle Partie+ · Multiplicateur ×${nm.toFixed(1)} actif !`);
  };

  // COMPUTED
  const prodsPerSec=ALL_BUILDINGS.reduce((acc,b)=>{
    const count=buildings[b.id]??0;
    if(b.id==="basket") return acc+b.baseProduction*count*STRAWBERRY_VALUE*prodMult*prestigeMult;
    return acc+b.baseProduction*count*prodMult*prestigeMult;
  },0);

  const unlockedUpgrades=ALL_UPGRADES.filter(u=>{
    if(u.act>currentAct) return false;
    const boughtInAct=boughtUpgrades.filter(id=>ALL_UPGRADES.find(x=>x.id===id&&x.act===u.act)).length;
    return boughtInAct>=u.requires;
  });
  const actBuildings=ALL_BUILDINGS.filter(b=>b.act<=currentAct);
  const goal=ACT_GOALS[Math.min(currentAct+1,6)]??ACT_GOALS[6];
  const progress=currentAct===6?100:Math.min((totalEuros/goal)*100,100);
  const actColor=ACT_COLORS[currentAct]||"#f97316";

  // SPECIAL SCREENS
  if(gameFinished&&!showLeaderboard) return <IpoScreen pseudo={pseudo} totalEuros={totalEuros} prestigeCount={prestigeCount} onPrestige={handlePrestige} onLeaderboard={()=>setShowLeaderboard(true)}/>;
  if(showLeaderboard) return <LeaderboardScreen pseudo={pseudo} score={totalEuros} onBack={()=>setShowLeaderboard(false)}/>;

  // START SCREEN
  if(!started) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1a0a00,#2d1200,#1a0a00)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Georgia',serif",padding:"1rem"}}>
      <style>{`
        @keyframes sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
        @keyframes floatUp{0%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(-60px)}}
        @keyframes pulseGlow{0%,100%{box-shadow:0 0 20px rgba(249,115,22,0.3)}50%{box-shadow:0 0 40px rgba(249,115,22,0.7)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bannerIn{0%{opacity:0;transform:translateY(-40px)}10%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0}}
        @keyframes clickPop{0%{transform:scale(1)}50%{transform:scale(0.91)}100%{transform:scale(1)}}
        @keyframes ticker{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes goldPulse{0%,100%{box-shadow:0 0 30px rgba(234,179,8,0.4)}50%{box-shadow:0 0 80px rgba(234,179,8,0.9)}}
        *{-webkit-tap-highlight-color:transparent}
        .btn-buy{outline:none;border:none}
        .btn-buy:active{transform:scale(0.96)}
        .btn-buy:disabled{opacity:0.4;cursor:not-allowed}
      `}</style>
      <div style={{textAlign:"center",animation:"fadeIn 0.8s ease-out",maxWidth:400,width:"100%"}}>
        <div style={{fontSize:68,animation:"sway 3s ease-in-out infinite",lineHeight:1.3,marginBottom:"0.4rem"}}>🍓</div>
        <h1 style={{fontSize:"1.9rem",color:"#fed7aa",margin:"0 0 0.2rem",textShadow:"0 2px 10px rgba(249,115,22,0.5)"}}>De la Fraise</h1>
        <h2 style={{fontSize:"1rem",color:"#f97316",margin:"0 0 0.8rem",fontStyle:"italic",fontWeight:"normal"}}>à la Fortune</h2>
        <div style={{display:"flex",justifyContent:"center",gap:"0.3rem",marginBottom:"1rem"}}>
          {["🍓","🌱","🌾","🚜","🏭","🌍","🔔"].map((e,i)=><span key={i} style={{fontSize:"1rem",opacity:0.7}}>{e}</span>)}
        </div>
        <p style={{color:"#a3714a",fontSize:"0.78rem",marginBottom:"1.5rem",lineHeight:1.6}}>
          Tu es un citadin sans le sou.<br/>Tout commence par une fraise volée…<br/>
          <span style={{fontSize:"0.7rem"}}>6 actes · IPO finale · Classement mondial</span>
        </p>
        <input type="text" placeholder="Ton surnom de chapardeur…" value={inputPseudo}
          onChange={e=>setInputPseudo(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&inputPseudo.trim()){setPseudo(inputPseudo.trim());setStarted(true);} }}
          style={{width:"100%",padding:"0.75rem 1rem",borderRadius:12,border:"2px solid #92400e",background:"rgba(255,255,255,0.05)",color:"#fed7aa",fontSize:"1rem",outline:"none",boxSizing:"border-box",marginBottom:"0.75rem",textAlign:"center"}}
        />
        <button onClick={()=>{ if(inputPseudo.trim()){setPseudo(inputPseudo.trim());setStarted(true);} }}
          style={{width:"100%",padding:"0.85rem",borderRadius:12,border:"none",background:"linear-gradient(135deg,#ea580c,#f97316)",color:"white",fontSize:"1rem",fontWeight:"bold",cursor:"pointer",animation:"pulseGlow 2s ease-in-out infinite",outline:"none"}}>
          Commencer à chaparder →
        </button>
      </div>
    </div>
  );

  // GAME SCREEN
  return (
    <div style={{minHeight:"100vh",background:ACT_BG[currentAct]||ACT_BG[1],fontFamily:"'Georgia',serif",color:"#fed7aa",maxWidth:480,margin:"0 auto",padding:"0 0 4rem"}}>
      <style>{`
        @keyframes floatUp{0%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(-60px)}}
        @keyframes clickPop{0%{transform:scale(1)}50%{transform:scale(0.91)}100%{transform:scale(1)}}
        @keyframes bannerIn{0%{opacity:0;transform:translateY(-50px)}10%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0;transform:translateY(-50px)}}
        @keyframes pulseBtn{0%,100%{opacity:1}50%{opacity:0.85}}
        *{-webkit-tap-highlight-color:transparent}
        .btn-buy{outline:none;border:none}
        .btn-buy:active{transform:scale(0.96)}
        .btn-buy:disabled{opacity:0.4;cursor:not-allowed}
      `}</style>

      {banner&&<div style={{position:"fixed",top:0,left:0,right:0,zIndex:100,background:`linear-gradient(90deg,${actColor}99,${actColor},${actColor}99)`,padding:"0.85rem 1.5rem",textAlign:"center",color:"white",fontWeight:"bold",fontSize:"0.88rem",lineHeight:1.5,animation:"bannerIn 6s ease forwards"}}>{banner}</div>}

      {/* HEADER */}
      <div style={{background:"rgba(0,0,0,0.5)",backdropFilter:"blur(10px)",padding:"0.7rem 1rem",borderBottom:`1px solid ${actColor}33`,position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:"0.58rem",color:"#a3714a",textTransform:"uppercase",letterSpacing:"0.1em"}}>
              {ACT_LABELS[currentAct]}{prestigeCount>0&&<span style={{color:actColor}}> · ×{prestigeMult.toFixed(1)}</span>}
            </div>
            <div style={{fontWeight:"bold",fontSize:"0.95rem"}}>{pseudo}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"1.3rem",fontWeight:"bold",color:actColor}}>{fmt(euros)}</div>
            <div style={{fontSize:"0.62rem",color:"#a3714a"}}>+{fmt(prodsPerSec)}/sec</div>
          </div>
        </div>
        <div style={{marginTop:"0.45rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.58rem",color:"#a3714a",marginBottom:2}}>
            <span>{currentAct<6?`Vers Acte ${currentAct+1}`:"Acte Final"}</span>
            <span>{currentAct===6?"🔔 IPO disponible":`${fmt(totalEuros)} / ${fmt(goal)}`}</span>
          </div>
          <div style={{background:"rgba(255,255,255,0.1)",borderRadius:99,height:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${progress}%`,borderRadius:99,transition:"width 0.5s ease",background:`linear-gradient(90deg,${actColor}88,${actColor})`}}/>
          </div>
        </div>
      </div>

      {/* CLICK ZONE */}
      <div style={{padding:"1.4rem 1rem 0.8rem",textAlign:"center"}}>
        <p style={{color:"#a3714a",fontSize:"0.7rem",margin:"0 0 1rem",fontStyle:"italic"}}>{ACT_CONTEXTS[currentAct]}</p>
        <div style={{position:"relative",display:"inline-block"}}>
          <button onClick={handleClick} style={{
            width:144,height:144,borderRadius:"50%",
            border:`3px solid ${actColor}`,
            background:`radial-gradient(circle at 40% 35%,${actColor}22,#000000cc)`,
            fontSize:54,cursor:"pointer",
            animation:clickAnim?"clickPop 0.12s ease":"none",
            position:"relative",overflow:"hidden",outline:"none",userSelect:"none",
          }}>
            {ACT_EMOJIS[currentAct]}
            <FloatingText items={floats}/>
          </button>
        </div>
        <div style={{marginTop:"0.5rem",color:actColor,fontSize:"0.76rem"}}>
          <strong>{ACT_CLICK_LABELS[currentAct]}</strong>
          <span style={{color:"#a3714a"}}> · +{clickPower} · {fmt(clickPower*STRAWBERRY_VALUE*prodMult*prestigeMult)}</span>
        </div>
        {currentAct===1&&<div style={{color:"#a3714a",fontSize:"0.62rem",marginTop:2}}>{Math.floor(strawberries)} 🍓</div>}
      </div>

      {/* IPO BUTTON */}
      {currentAct===6&&<div style={{padding:"0 1rem 1rem"}}>
        <button onClick={()=>setGameFinished(true)} style={{
          width:"100%",padding:"0.9rem",borderRadius:12,border:"2px solid #fde047",
          background:"rgba(234,179,8,0.15)",color:"#fde047",fontSize:"0.95rem",
          fontWeight:"bold",cursor:"pointer",outline:"none",animation:"pulseBtn 2s ease-in-out infinite",
        }}>🔔 Introduire en Bourse — IPO Finale</button>
      </div>}

      {/* UPGRADES */}
      <section style={{padding:"0 1rem 1rem"}}>
        <h3 style={{fontSize:"0.58rem",textTransform:"uppercase",letterSpacing:"0.12em",color:"#a3714a",margin:"0 0 0.45rem"}}>⚡ Améliorations</h3>
        <div style={{display:"flex",flexDirection:"column",gap:"0.38rem"}}>
          {unlockedUpgrades.map(u=>{
            const bought=boughtUpgrades.includes(u.id);
            const canAfford=euros>=u.cost;
            return (
              <div key={u.id} style={{display:"flex",alignItems:"center",gap:"0.55rem",background:bought?"rgba(22,163,74,0.15)":canAfford?`${actColor}1a`:"rgba(255,255,255,0.04)",border:`1px solid ${bought?"rgba(22,163,74,0.4)":canAfford?`${actColor}55`:"rgba(255,255,255,0.08)"}`,borderRadius:10,padding:"0.5rem 0.65rem"}}>
                <div style={{fontSize:19}}>{u.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:"bold",fontSize:"0.78rem",color:bought?"#86efac":"#fed7aa"}}>{u.name}{bought&&" ✓"}</div>
                  <div style={{fontSize:"0.65rem",color:"#a3714a"}}>{u.desc}</div>
                </div>
                {!bought&&<button className="btn-buy" onClick={()=>buyUpgrade(u)} disabled={!canAfford} style={{padding:"0.25rem 0.5rem",borderRadius:8,background:canAfford?`linear-gradient(135deg,${actColor}cc,${actColor})`:"rgba(255,255,255,0.1)",color:canAfford?"white":"#a3714a",fontSize:"0.68rem",fontWeight:"bold",cursor:canAfford?"pointer":"not-allowed",whiteSpace:"nowrap"}}>{fmt(u.cost)}</button>}
              </div>
            );
          })}
        </div>
      </section>

      {/* BUILDINGS */}
      <section style={{padding:"0 1rem"}}>
        <h3 style={{fontSize:"0.58rem",textTransform:"uppercase",letterSpacing:"0.12em",color:"#a3714a",margin:"0 0 0.45rem"}}>🏗️ Équipements</h3>
        <div style={{display:"flex",flexDirection:"column",gap:"0.38rem"}}>
          {actBuildings.map(b=>{
            const count=buildings[b.id]??0;
            const cost=buildingCost(b,count);
            const canAfford=euros>=cost;
            const totalProd=b.id==="basket"?b.baseProduction*count*STRAWBERRY_VALUE*prodMult*prestigeMult:b.baseProduction*count*prodMult*prestigeMult;
            return (
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:"0.55rem",background:count>0?`${actColor}0d`:"rgba(255,255,255,0.04)",border:`1px solid ${count>0?`${actColor}2a`:"rgba(255,255,255,0.08)"}`,borderRadius:10,padding:"0.5rem 0.65rem"}}>
                <div style={{fontSize:19}}>{b.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:"bold",fontSize:"0.78rem",display:"flex",alignItems:"center",gap:"0.3rem",flexWrap:"wrap"}}>
                    {b.name}
                    {count>0&&<span style={{background:actColor,color:"#000",borderRadius:99,padding:"0 5px",fontSize:"0.58rem"}}>×{count}</span>}
                  </div>
                  <div style={{fontSize:"0.65rem",color:"#a3714a"}}>
                    {b.desc}{count>0&&<span style={{color:actColor}}> · {fmt(totalProd)}/sec</span>}
                  </div>
                </div>
                <button className="btn-buy" onClick={()=>buyBuilding(b)} disabled={!canAfford} style={{padding:"0.25rem 0.5rem",borderRadius:8,background:canAfford?`linear-gradient(135deg,${actColor}cc,${actColor})`:"rgba(255,255,255,0.1)",color:canAfford?"white":"#a3714a",fontSize:"0.68rem",fontWeight:"bold",cursor:canAfford?"pointer":"not-allowed",whiteSpace:"nowrap"}}>{fmt(cost)}</button>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{textAlign:"center",marginTop:"2rem",fontSize:"0.56rem",color:"#5c3317"}}>
        Sauvegarde auto · {pseudo} · {ACT_LABELS[currentAct]}{prestigeCount>0&&` · Prestige ${prestigeCount}`}
      </div>
    </div>
  );
}
