import { useState, useEffect, useRef, useCallback } from "react";

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Upgrade {
  id: string;
  name: string;
  desc: string;
  cost: number;
  clickBonus: number;
  icon: string;
  requires: number;
  act: number;
}

interface Building {
  id: string;
  name: string;
  desc: string;
  baseCost: number;
  baseProduction: number;
  icon: string;
  act: number;
}

interface FloatItem {
  id: number;
  x: number;
  y: number;
  amount: number;
}

interface BuildingCounts {
  [key: string]: number;
}

interface SaveData {
  pseudo: string;
  strawberries: number;
  euros: number;
  totalEuros: number;
  clickPower: number;
  boughtUpgrades: string[];
  buildings: BuildingCounts;
  currentAct: number;
  act3Unlocked: boolean;
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const STRAWBERRY_VALUE = 0.10;
const ACT2_GOAL = 500;
const ACT3_GOAL = 50000;
const SAVE_KEY = "chapardeur_save_v2";

const UPGRADES: Upgrade[] = [
  // Acte 1
  { id: "fast_hands", name: "Mains rapides", desc: "+1 fraise par clic. Tu t'entraînes la nuit.", cost: 15, clickBonus: 1, icon: "⚡", requires: 0, act: 1 },
  { id: "hidden_basket", name: "Panier caché", desc: "+3 fraises par clic. Fond double dans ton sac.", cost: 80, clickBonus: 3, icon: "🧺", requires: 1, act: 1 },
  { id: "market_friend", name: "Complicité du maraîcher", desc: "+8 fraises par clic. Il ferme les yeux.", cost: 350, clickBonus: 8, icon: "🤝", requires: 2, act: 1 },
  // Acte 2
  { id: "compost", name: "Compost maison", desc: "+5 récoltes par clic. Tes plants poussent plus vite.", cost: 800, clickBonus: 5, icon: "♻️", requires: 0, act: 2 },
  { id: "drip", name: "Goutte-à-goutte", desc: "+10 récoltes par clic. Irrigation optimisée.", cost: 3000, clickBonus: 10, icon: "💧", requires: 1, act: 2 },
  { id: "market_stall", name: "Stand au marché", desc: "+20 récoltes par clic. Vente directe aux clients.", cost: 12000, clickBonus: 20, icon: "🏪", requires: 2, act: 2 },
];

const BUILDINGS: Building[] = [
  // Acte 1
  { id: "basket", name: "Panier automatique", desc: "Un mécanisme bricolé. 0.5 fraise/sec.", baseCost: 25, baseProduction: 0.5, icon: "🧺", act: 1 },
  // Acte 2
  { id: "fraisier", name: "Fraisier planté", desc: "Ta première vraie culture. 5€/sec.", baseCost: 200, baseProduction: 5, icon: "🌱", act: 2 },
  { id: "poulailler", name: "Poulailler", desc: "Œufs frais vendus au marché. 20€/sec.", baseCost: 500, baseProduction: 20, icon: "🐔", act: 2 },
  { id: "ruche", name: "Ruche", desc: "Miel bio toutes saisons. 50€/sec.", baseCost: 1200, baseProduction: 50, icon: "🐝", act: 2 },
  { id: "serre", name: "Serre tunnel", desc: "Production toute l'année. 150€/sec.", baseCost: 5000, baseProduction: 150, icon: "🏚️", act: 2 },
];

// ── HELPERS ────────────────────────────────────────────────────────────────
function formatEuros(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M€`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k€`;
  return `${n.toFixed(2)}€`;
}

function getBuildingCost(building: Building, count: number): number {
  return Math.floor(building.baseCost * Math.pow(1.15, count));
}

// ── FLOATING TEXT ──────────────────────────────────────────────────────────
function FloatingText({ items }: { items: FloatItem[] }) {
  return (
    <div style={{ pointerEvents: "none", position: "absolute", inset: 0, overflow: "hidden" }}>
      {items.map((item) => (
        <div key={item.id} style={{
          position: "absolute", left: item.x, top: item.y,
          color: "#f97316", fontWeight: "bold", fontSize: "0.9rem",
          textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          animation: "floatUp 1.2s ease-out forwards",
          transform: "translateX(-50%)", whiteSpace: "nowrap",
        }}>
          +{item.amount} 🍓
        </div>
      ))}
    </div>
  );
}

// ── MAIN GAME ──────────────────────────────────────────────────────────────
export default function App() {
  const [pseudo, setPseudo] = useState<string>("");
  const [inputPseudo, setInputPseudo] = useState<string>("");
  const [started, setStarted] = useState<boolean>(false);
  const [currentAct, setCurrentAct] = useState<number>(1);

  const [strawberries, setStrawberries] = useState<number>(0);
  const [euros, setEuros] = useState<number>(0);
  const [totalEuros, setTotalEuros] = useState<number>(0);
  const [clickPower, setClickPower] = useState<number>(1);
  const [boughtUpgrades, setBoughtUpgrades] = useState<string[]>([]);
  const [buildings, setBuildings] = useState<BuildingCounts>({ basket: 0, fraisier: 0, poulailler: 0, ruche: 0, serre: 0 });
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const [banner, setBanner] = useState<string>("");
  const [act3Unlocked, setAct3Unlocked] = useState<boolean>(false);
  const [clickAnim, setClickAnim] = useState<boolean>(false);

  const eurosRef = useRef<number>(euros);
  const totalRef = useRef<number>(totalEuros);
  const strawRef = useRef<number>(strawberries);
  eurosRef.current = euros;
  totalRef.current = totalEuros;
  strawRef.current = strawberries;

  const showBanner = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(""), 5000);
  };

  // ── LOAD SAVE ──
  useEffect(() => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      try {
        const s: SaveData = JSON.parse(raw);
        setPseudo(s.pseudo || "");
        setStarted(!!s.pseudo);
        setStrawberries(s.strawberries || 0);
        setEuros(s.euros || 0);
        setTotalEuros(s.totalEuros || 0);
        setClickPower(s.clickPower || 1);
        setBoughtUpgrades(s.boughtUpgrades || []);
        setBuildings(s.buildings || { basket: 0, fraisier: 0, poulailler: 0, ruche: 0, serre: 0 });
        setCurrentAct(s.currentAct || 1);
        setAct3Unlocked(s.act3Unlocked || false);
      } catch (_) {}
    }
  }, []);

  // ── AUTO SAVE ──
  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        pseudo, strawberries: strawRef.current, euros: eurosRef.current,
        totalEuros: totalRef.current, clickPower, boughtUpgrades,
        buildings, currentAct, act3Unlocked,
      } as SaveData));
    }, 10000);
    return () => clearInterval(interval);
  }, [started, pseudo, clickPower, boughtUpgrades, buildings, currentAct, act3Unlocked]);

  // ── GAME LOOP ──
  useEffect(() => {
    if (!started) return;
    const fps = 10;
    const interval = setInterval(() => {
      const basketBuilding = BUILDINGS.find((b) => b.id === "basket");
      const basketCount = buildings["basket"] ?? 0;
      const strawPerTick = basketBuilding ? (basketBuilding.baseProduction * basketCount) / fps : 0;

      const directEarned = BUILDINGS.filter(b => b.act === 2).reduce((acc, b) => {
        return acc + (b.baseProduction * (buildings[b.id] ?? 0)) / fps;
      }, 0);

      setStrawberries((s) => s + strawPerTick);
      const earned = strawPerTick * STRAWBERRY_VALUE + directEarned;
      setEuros((e) => e + earned);
      setTotalEuros((t) => {
        const newT = t + earned;
        if (currentAct === 1 && newT >= ACT2_GOAL) {
          setCurrentAct(2);
          showBanner("🌱 500€ atteints ! Bienvenue à Montreuil — ton premier terrain t'attend.");
        }
        if (!act3Unlocked && newT >= ACT3_GOAL) {
          setAct3Unlocked(true);
          showBanner("🚜 50 000€ ! Tu peux acheter ton premier terrain. L'Acte 3 approche…");
        }
        return newT;
      });
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [started, buildings, currentAct, act3Unlocked]);

  // ── CLICK HANDLER ──
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStrawberries((s) => s + clickPower);
    const earned = clickPower * STRAWBERRY_VALUE;
    setEuros((ev) => ev + earned);
    setTotalEuros((t) => {
      const newT = t + earned;
      if (currentAct === 1 && newT >= ACT2_GOAL) {
        setCurrentAct(2);
        showBanner("🌱 500€ atteints ! Bienvenue à Montreuil — ton premier terrain t'attend.");
      }
      if (!act3Unlocked && newT >= ACT3_GOAL) {
        setAct3Unlocked(true);
        showBanner("🚜 50 000€ ! Tu peux acheter ton premier terrain. L'Acte 3 approche…");
      }
      return newT;
    });

    setClickAnim(true);
    setTimeout(() => setClickAnim(false), 120);

    const id = Date.now() + Math.random();
    setFloats((f) => [...f, { id, x, y, amount: clickPower }]);
    setTimeout(() => setFloats((f) => f.filter((i) => i.id !== id)), 1200);
  }, [clickPower, currentAct, act3Unlocked]);

  // ── BUY UPGRADE ──
  const buyUpgrade = (upgrade: Upgrade) => {
    if (euros < upgrade.cost || boughtUpgrades.includes(upgrade.id)) return;
    setEuros((e) => e - upgrade.cost);
    setBoughtUpgrades((u) => [...u, upgrade.id]);
    setClickPower((p) => p + upgrade.clickBonus);
  };

  // ── BUY BUILDING ──
  const buyBuilding = (building: Building) => {
    const count = buildings[building.id] ?? 0;
    const cost = getBuildingCost(building, count);
    if (euros < cost) return;
    setEuros((e) => e - cost);
    setBuildings((b) => ({ ...b, [building.id]: (b[building.id] ?? 0) + 1 }));
  };

  // ── COMPUTED ──
  const prodsPerSec = BUILDINGS.reduce((acc, b) => {
    const count = buildings[b.id] ?? 0;
    if (b.id === "basket") return acc + b.baseProduction * count * STRAWBERRY_VALUE;
    return acc + b.baseProduction * count;
  }, 0);

  const actUpgrades = UPGRADES.filter(u => u.act <= currentAct);
  const unlockedUpgrades = actUpgrades.filter(u => {
    const boughtInAct = boughtUpgrades.filter(id => UPGRADES.find(x => x.id === id && x.act === u.act)).length;
    return boughtInAct >= u.requires;
  });
  const actBuildings = BUILDINGS.filter(b => b.act <= currentAct);

  const goal = currentAct === 1 ? ACT2_GOAL : ACT3_GOAL;
  const progress = Math.min((totalEuros / goal) * 100, 100);
  const actLabel = currentAct === 1 ? "Acte I — Le Chapardeur" : "Acte II — Le Micro-Maraîcher";
  const clickEmoji = currentAct === 1 ? "🍓" : "🌿";
  const clickLabel = currentAct === 1 ? "Voler des fraises" : "Récolter à la main";
  const clickContext = currentAct === 1 ? "Le Marché de Rungis, 6h du matin" : "Ta parcelle à Montreuil";

  // ── START SCREEN ──
  if (!started) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a0a00 0%, #2d1200 40%, #1a0a00 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Georgia', serif", padding: "1rem",
      }}>
        <style>{`
          @keyframes sway { 0%,100%{transform:rotate(-3deg)} 50%{transform:rotate(3deg)} }
          @keyframes floatUp { 0%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0;transform:translateX(-50%) translateY(-60px)} }
          @keyframes pulseGlow { 0%,100%{box-shadow:0 0 20px rgba(249,115,22,0.3)} 50%{box-shadow:0 0 40px rgba(249,115,22,0.7)} }
          @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
          @keyframes bannerIn { 0%{opacity:0;transform:translateY(-40px)} 10%{opacity:1;transform:translateY(0)} 80%{opacity:1} 100%{opacity:0;transform:translateY(-40px)} }
          @keyframes clickPop { 0%{transform:scale(1)} 50%{transform:scale(0.91)} 100%{transform:scale(1)} }
          @keyframes pulseGlowGreen { 0%,100%{box-shadow:0 0 20px rgba(34,197,94,0.3)} 50%{box-shadow:0 0 50px rgba(34,197,94,0.8)} }
        `}</style>
        <div style={{ textAlign: "center", animation: "fadeIn 0.8s ease-out", maxWidth: 400, width: "100%" }}>
          <div style={{ fontSize: 72, animation: "sway 3s ease-in-out infinite", lineHeight: 1.3, marginBottom: "0.5rem" }}>🍓</div>
          <h1 style={{ fontSize: "2rem", color: "#fed7aa", margin: "0 0 0.2rem", letterSpacing: "-0.02em", textShadow: "0 2px 10px rgba(249,115,22,0.5)" }}>
            De la Fraise
          </h1>
          <h2 style={{ fontSize: "1rem", color: "#f97316", margin: "0 0 1rem", fontStyle: "italic", fontWeight: "normal" }}>
            à la Fortune
          </h2>
          <p style={{ color: "#a3714a", fontSize: "0.82rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Tu es un citadin sans le sou.<br />Tout commence par une fraise volée au marché…
          </p>
          <input
            type="text"
            placeholder="Ton surnom de chapardeur…"
            value={inputPseudo}
            onChange={(e) => setInputPseudo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && inputPseudo.trim()) { setPseudo(inputPseudo.trim()); setStarted(true); } }}
            style={{
              width: "100%", padding: "0.75rem 1rem", borderRadius: 12,
              border: "2px solid #92400e", background: "rgba(255,255,255,0.05)",
              color: "#fed7aa", fontSize: "1rem", outline: "none",
              boxSizing: "border-box", marginBottom: "0.75rem", textAlign: "center",
              WebkitTapHighlightColor: "transparent",
            }}
          />
          <button
            onClick={() => { if (inputPseudo.trim()) { setPseudo(inputPseudo.trim()); setStarted(true); } }}
            style={{
              width: "100%", padding: "0.85rem", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #ea580c, #f97316)", color: "white",
              fontSize: "1rem", fontWeight: "bold", cursor: "pointer",
              animation: "pulseGlow 2s ease-in-out infinite", letterSpacing: "0.05em",
              WebkitTapHighlightColor: "transparent", outline: "none",
            }}
          >
            Commencer à chaparder →
          </button>
        </div>
      </div>
    );
  }

  // ── GAME SCREEN ──
  return (
    <div style={{
      minHeight: "100vh",
      background: currentAct === 1
        ? "linear-gradient(160deg, #1a0a00 0%, #2d1200 50%, #1a0500 100%)"
        : "linear-gradient(160deg, #052e16 0%, #14532d 50%, #052e16 100%)",
      fontFamily: "'Georgia', serif", color: "#fed7aa",
      maxWidth: 480, margin: "0 auto", padding: "0 0 4rem",
    }}>
      <style>{`
        @keyframes floatUp { 0%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0;transform:translateX(-50%) translateY(-60px)} }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 20px rgba(249,115,22,0.3)} 50%{box-shadow:0 0 50px rgba(249,115,22,0.8)} }
        @keyframes pulseGlowGreen { 0%,100%{box-shadow:0 0 20px rgba(34,197,94,0.3)} 50%{box-shadow:0 0 50px rgba(34,197,94,0.8)} }
        @keyframes clickPop { 0%{transform:scale(1)} 50%{transform:scale(0.91)} 100%{transform:scale(1)} }
        @keyframes bannerIn { 0%{opacity:0;transform:translateY(-50px)} 10%{opacity:1;transform:translateY(0)} 80%{opacity:1} 100%{opacity:0;transform:translateY(-50px)} }
        .btn-buy { outline:none; -webkit-tap-highlight-color:transparent; border:none; }
        .btn-buy:active { transform:scale(0.96); }
        .btn-buy:disabled { opacity:0.4; cursor:not-allowed; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* BANNER */}
      {banner && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          background: currentAct >= 2
            ? "linear-gradient(90deg, #16a34a, #22c55e, #16a34a)"
            : "linear-gradient(90deg, #ea580c, #f97316, #ea580c)",
          padding: "1rem 1.5rem", textAlign: "center", color: "white",
          fontWeight: "bold", fontSize: "0.9rem", lineHeight: 1.5,
          animation: "bannerIn 5s ease forwards",
        }}>
          {banner}
        </div>
      )}

      {/* HEADER */}
      <div style={{
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)",
        padding: "0.75rem 1rem",
        borderBottom: `1px solid ${currentAct >= 2 ? "rgba(34,197,94,0.2)" : "rgba(249,115,22,0.2)"}`,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.62rem", color: "#a3714a", textTransform: "uppercase", letterSpacing: "0.1em" }}>{actLabel}</div>
            <div style={{ fontWeight: "bold", fontSize: "1rem" }}>{pseudo}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: currentAct >= 2 ? "#4ade80" : "#f97316" }}>
              {formatEuros(euros)}
            </div>
            <div style={{ fontSize: "0.68rem", color: "#a3714a" }}>+{formatEuros(prodsPerSec)}/sec</div>
          </div>
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "#a3714a", marginBottom: 3 }}>
            <span>{actLabel}</span>
            <span>{totalEuros >= goal ? "✅ Objectif atteint" : `${formatEuros(totalEuros)} / ${formatEuros(goal)}`}</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 99, height: 5, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${progress}%`, borderRadius: 99, transition: "width 0.5s ease",
              background: currentAct >= 2
                ? "linear-gradient(90deg, #16a34a, #22c55e)"
                : "linear-gradient(90deg, #ea580c, #f97316)",
            }} />
          </div>
        </div>
      </div>

      {/* CLICK ZONE */}
      <div style={{ padding: "1.5rem 1rem 1rem", textAlign: "center" }}>
        <p style={{ color: "#a3714a", fontSize: "0.75rem", margin: "0 0 1.2rem", fontStyle: "italic" }}>
          {clickContext}
        </p>
        <div style={{ position: "relative", display: "inline-block" }}>
          <button
            onClick={handleClick}
            style={{
              width: 148, height: 148, borderRadius: "50%",
              border: `3px solid ${currentAct >= 2 ? "#16a34a" : "#ea580c"}`,
              background: currentAct >= 2
                ? "radial-gradient(circle at 40% 35%, #14532d, #052e16)"
                : "radial-gradient(circle at 40% 35%, #7f1d1d, #450a0a)",
              fontSize: 56, cursor: "pointer",
              animation: clickAnim ? "clickPop 0.12s ease" : currentAct >= 2 ? "pulseGlowGreen 2s ease-in-out infinite" : "pulseGlow 2s ease-in-out infinite",
              position: "relative", overflow: "hidden",
              outline: "none",
              WebkitTapHighlightColor: "transparent",
              userSelect: "none",
            }}
          >
            {clickEmoji}
            <FloatingText items={floats} />
          </button>
        </div>
        <div style={{ marginTop: "0.6rem", color: currentAct >= 2 ? "#4ade80" : "#f97316", fontSize: "0.8rem" }}>
          <strong>{clickLabel}</strong>
          <span style={{ color: "#a3714a" }}> · +{clickPower} · {formatEuros(clickPower * STRAWBERRY_VALUE)}</span>
        </div>
        {currentAct === 1 && (
          <div style={{ color: "#a3714a", fontSize: "0.68rem", marginTop: 3 }}>
            {Math.floor(strawberries)} 🍓 en stock
          </div>
        )}
      </div>

      {/* UPGRADES */}
      <section style={{ padding: "0 1rem 1rem" }}>
        <h3 style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#a3714a", margin: "0 0 0.5rem" }}>
          ⚡ Améliorations
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {unlockedUpgrades.map((u) => {
            const bought = boughtUpgrades.includes(u.id);
            const canAfford = euros >= u.cost;
            return (
              <div key={u.id} style={{
                display: "flex", alignItems: "center", gap: "0.6rem",
                background: bought ? "rgba(22,163,74,0.15)" : canAfford ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${bought ? "rgba(22,163,74,0.4)" : canAfford ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 10, padding: "0.55rem 0.7rem",
              }}>
                <div style={{ fontSize: 22 }}>{u.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.82rem", color: bought ? "#86efac" : "#fed7aa" }}>
                    {u.name} {bought && "✓"}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#a3714a" }}>{u.desc}</div>
                </div>
                {!bought && (
                  <button className="btn-buy" onClick={() => buyUpgrade(u)} disabled={!canAfford} style={{
                    padding: "0.3rem 0.6rem", borderRadius: 8,
                    background: canAfford ? "linear-gradient(135deg, #ea580c, #f97316)" : "rgba(255,255,255,0.1)",
                    color: canAfford ? "white" : "#a3714a", fontSize: "0.72rem", fontWeight: "bold",
                    cursor: canAfford ? "pointer" : "not-allowed", whiteSpace: "nowrap",
                  }}>
                    {formatEuros(u.cost)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* BUILDINGS */}
      <section style={{ padding: "0 1rem" }}>
        <h3 style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#a3714a", margin: "0 0 0.5rem" }}>
          🏗️ Équipements
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {actBuildings.map((b) => {
            const count = buildings[b.id] ?? 0;
            const cost = getBuildingCost(b, count);
            const canAfford = euros >= cost;
            const totalProd = b.id === "basket"
              ? b.baseProduction * count * STRAWBERRY_VALUE
              : b.baseProduction * count;
            return (
              <div key={b.id} style={{
                display: "flex", alignItems: "center", gap: "0.6rem",
                background: count > 0 ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${count > 0 ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 10, padding: "0.55rem 0.7rem",
              }}>
                <div style={{ fontSize: 22 }}>{b.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.3rem", flexWrap: "wrap" }}>
                    {b.name}
                    {count > 0 && (
                      <span style={{ background: "#ea580c", color: "white", borderRadius: 99, padding: "0 5px", fontSize: "0.62rem" }}>×{count}</span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#a3714a" }}>
                    {b.desc}
                    {count > 0 && <span style={{ color: "#f97316" }}> · {formatEuros(totalProd)}/sec</span>}
                  </div>
                </div>
                <button className="btn-buy" onClick={() => buyBuilding(b)} disabled={!canAfford} style={{
                  padding: "0.3rem 0.6rem", borderRadius: 8,
                  background: canAfford ? "linear-gradient(135deg, #ea580c, #f97316)" : "rgba(255,255,255,0.1)",
                  color: canAfford ? "white" : "#a3714a", fontSize: "0.72rem", fontWeight: "bold",
                  cursor: canAfford ? "pointer" : "not-allowed", whiteSpace: "nowrap",
                }}>
                  {formatEuros(cost)}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ACT 3 TEASER */}
      {act3Unlocked && (
        <div style={{
          margin: "1.5rem 1rem 0", padding: "1rem", borderRadius: 12,
          background: "linear-gradient(135deg, rgba(234,179,8,0.15), rgba(161,98,7,0.1))",
          border: "1px solid rgba(234,179,8,0.4)", textAlign: "center",
        }}>
          <div style={{ fontSize: 32 }}>🚜</div>
          <div style={{ fontWeight: "bold", color: "#fde047", marginBottom: 4 }}>Acte 3 débloqué !</div>
          <div style={{ fontSize: "0.8rem", color: "#fef08a" }}>
            Un vieux fermier près de Chartres veut vendre son hectare.<br />
            Tu as les moyens. Il est temps d'acheter pour de vrai.
          </div>
          <div style={{ marginTop: "0.75rem", fontSize: "0.7rem", color: "#a3714a", fontStyle: "italic" }}>
            (Acte 3 en cours de développement — bientôt disponible)
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.6rem", color: "#5c3317" }}>
        Sauvegarde auto · {pseudo} · {actLabel}
      </div>
    </div>
  );
}
