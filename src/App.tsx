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
}

interface Building {
  id: string;
  name: string;
  desc: string;
  baseCost: number;
  baseProduction: number;
  icon: string;
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
  act2Unlocked: boolean;
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const STRAWBERRY_VALUE = 0.10;
const ACT2_GOAL = 500;

const UPGRADES: Upgrade[] = [
  {
    id: "fast_hands",
    name: "Mains rapides",
    desc: "Tu t'entraînes la nuit. +1 fraise par clic.",
    cost: 15,
    clickBonus: 1,
    icon: "⚡",
    requires: 0,
  },
  {
    id: "hidden_basket",
    name: "Panier caché",
    desc: "Un fond double dans ton sac. +3 fraises par clic.",
    cost: 80,
    clickBonus: 3,
    icon: "🧺",
    requires: 1,
  },
  {
    id: "market_friend",
    name: "Complicité du maraîcher",
    desc: "Il ferme les yeux… contre un petit pourcentage. +8 fraises par clic.",
    cost: 350,
    clickBonus: 8,
    icon: "🤝",
    requires: 2,
  },
];

const BUILDINGS: Building[] = [
  {
    id: "basket",
    name: "Panier automatique",
    desc: "Un mécanisme bricolé qui vole tout seul. 0.5 fraise/sec.",
    baseCost: 25,
    baseProduction: 0.5,
    icon: "🧺",
  },
];

const SAVE_KEY = "chapardeur_save_v1";

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
        <div
          key={item.id}
          style={{
            position: "absolute",
            left: item.x,
            top: item.y,
            color: "#f97316",
            fontWeight: "bold",
            fontSize: "0.9rem",
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
            animation: "floatUp 1.2s ease-out forwards",
            transform: "translateX(-50%)",
          }}
        >
          +{item.amount} 🍓
        </div>
      ))}
    </div>
  );
}

// ── MAIN GAME ──────────────────────────────────────────────────────────────
export default function Chapardeur() {
  const [pseudo, setPseudo] = useState<string>("");
  const [inputPseudo, setInputPseudo] = useState<string>("");
  const [started, setStarted] = useState<boolean>(false);

  const [strawberries, setStrawberries] = useState<number>(0);
  const [euros, setEuros] = useState<number>(0);
  const [totalEuros, setTotalEuros] = useState<number>(0);
  const [clickPower, setClickPower] = useState<number>(1);
  const [boughtUpgrades, setBoughtUpgrades] = useState<string[]>([]);
  const [buildings, setBuildings] = useState<BuildingCounts>({ basket: 0 });
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const [showAct2Banner, setShowAct2Banner] = useState<boolean>(false);
  const [act2Unlocked, setAct2Unlocked] = useState<boolean>(false);
  const [clickAnim, setClickAnim] = useState<boolean>(false);

  const eurosRef = useRef<number>(euros);
  const totalRef = useRef<number>(totalEuros);
  const strawRef = useRef<number>(strawberries);
  eurosRef.current = euros;
  totalRef.current = totalEuros;
  strawRef.current = strawberries;

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
        setBuildings(s.buildings || { basket: 0 });
        setAct2Unlocked(s.act2Unlocked || false);
      } catch (_) {}
    }
  }, []);

  // ── AUTO SAVE ──
  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          pseudo,
          strawberries: strawRef.current,
          euros: eurosRef.current,
          totalEuros: totalRef.current,
          clickPower,
          boughtUpgrades,
          buildings,
          act2Unlocked,
        } as SaveData)
      );
    }, 10000);
    return () => clearInterval(interval);
  }, [started, pseudo, clickPower, boughtUpgrades, buildings, act2Unlocked]);

  // ── GAME LOOP ──
  useEffect(() => {
    if (!started) return;
    const fps = 10;
    const interval = setInterval(() => {
      const basketBuilding = BUILDINGS.find((b) => b.id === "basket");
      if (!basketBuilding) return;
      const basketCount = buildings["basket"] ?? 0;
      const buildingProd = basketBuilding.baseProduction * basketCount;
      const strawPerTick = buildingProd / fps;

      setStrawberries((s) => s + strawPerTick);
      const earned = strawPerTick * STRAWBERRY_VALUE;
      setEuros((e) => e + earned);
      setTotalEuros((t) => {
        const newT = t + earned;
        if (!act2Unlocked && newT >= ACT2_GOAL) {
          setAct2Unlocked(true);
          setShowAct2Banner(true);
          setTimeout(() => setShowAct2Banner(false), 5000);
        }
        return newT;
      });
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [started, buildings, act2Unlocked]);

  // ── CLICK HANDLER ──
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setStrawberries((s) => s + clickPower);
      const earned = clickPower * STRAWBERRY_VALUE;
      setEuros((e) => e + earned);
      setTotalEuros((t) => {
        const newT = t + earned;
        if (!act2Unlocked && newT >= ACT2_GOAL) {
          setAct2Unlocked(true);
          setShowAct2Banner(true);
          setTimeout(() => setShowAct2Banner(false), 5000);
        }
        return newT;
      });

      setClickAnim(true);
      setTimeout(() => setClickAnim(false), 100);

      const id = Date.now() + Math.random();
      setFloats((f) => [...f, { id, x, y, amount: clickPower }]);
      setTimeout(() => setFloats((f) => f.filter((i) => i.id !== id)), 1200);
    },
    [clickPower, act2Unlocked]
  );

  // ── BUY UPGRADE ──
  const buyUpgrade = (upgrade: Upgrade) => {
    if (euros < upgrade.cost) return;
    if (boughtUpgrades.includes(upgrade.id)) return;
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

  // ── PROD/SEC ──
  const prodsPerSec = BUILDINGS.reduce((acc, b) => {
    return acc + b.baseProduction * (buildings[b.id] ?? 0) * STRAWBERRY_VALUE;
  }, 0);

  const unlockedUpgrades = UPGRADES.filter(
    (u) => boughtUpgrades.filter((id) => UPGRADES.find((x) => x.id === id)).length >= u.requires
  );

  // ── START SCREEN ──
  if (!started) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #1a0a00 0%, #2d1200 40%, #1a0a00 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Georgia', serif",
          padding: "1rem",
        }}
      >
        <style>{`
          @keyframes sway { 0%,100%{transform:rotate(-3deg)} 50%{transform:rotate(3deg)} }
          @keyframes floatUp { 0%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0;transform:translateX(-50%) translateY(-60px)} }
          @keyframes pulse-glow { 0%,100%{box-shadow:0 0 20px rgba(249,115,22,0.3)} 50%{box-shadow:0 0 40px rgba(249,115,22,0.7)} }
          @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
          @keyframes banner { 0%{opacity:0;transform:translateY(-40px)} 10%{opacity:1;transform:translateY(0)} 80%{opacity:1} 100%{opacity:0;transform:translateY(-40px)} }
        `}</style>
        <div style={{ textAlign: "center", animation: "fadeIn 0.8s ease-out", maxWidth: 420, width: "100%" }}>
          <div style={{ fontSize: 80, animation: "sway 3s ease-in-out infinite" }}>🍓</div>
          <h1 style={{ fontSize: "2.2rem", color: "#fed7aa", margin: "0.5rem 0 0.2rem", letterSpacing: "-0.02em", textShadow: "0 2px 10px rgba(249,115,22,0.5)" }}>
            De la Fraise
          </h1>
          <h2 style={{ fontSize: "1.1rem", color: "#f97316", margin: "0 0 0.5rem", fontStyle: "italic", fontWeight: "normal" }}>
            à la Fortune
          </h2>
          <p style={{ color: "#a3714a", fontSize: "0.85rem", marginBottom: "2rem", lineHeight: 1.5 }}>
            Tu es un citadin sans le sou. <br />
            Tout commence par une fraise volée au marché…
          </p>
          <input
            type="text"
            placeholder="Ton surnom de chapardeur…"
            value={inputPseudo}
            onChange={(e) => setInputPseudo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && inputPseudo.trim()) {
                setPseudo(inputPseudo.trim());
                setStarted(true);
              }
            }}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              borderRadius: 12,
              border: "2px solid #92400e",
              background: "rgba(255,255,255,0.05)",
              color: "#fed7aa",
              fontSize: "1rem",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: "1rem",
              textAlign: "center",
            }}
          />
          <button
            onClick={() => {
              if (inputPseudo.trim()) {
                setPseudo(inputPseudo.trim());
                setStarted(true);
              }
            }}
            style={{
              width: "100%",
              padding: "0.85rem",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, #ea580c, #f97316)",
              color: "white",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
              animation: "pulse-glow 2s ease-in-out infinite",
              letterSpacing: "0.05em",
            }}
          >
            Commencer à chaparder →
          </button>
        </div>
      </div>
    );
  }

  const progress = Math.min((totalEuros / ACT2_GOAL) * 100, 100);

  // ── GAME SCREEN ──
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #1a0a00 0%, #2d1200 50%, #1a0500 100%)",
        fontFamily: "'Georgia', serif",
        color: "#fed7aa",
        maxWidth: 480,
        margin: "0 auto",
        padding: "0 0 4rem",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes floatUp { 0%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0;transform:translateX(-50%) translateY(-60px)} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 20px rgba(249,115,22,0.3)} 50%{box-shadow:0 0 50px rgba(249,115,22,0.8)} }
        @keyframes clickPop { 0%{transform:scale(1)} 50%{transform:scale(0.93)} 100%{transform:scale(1)} }
        @keyframes banner { 0%{opacity:0;transform:translateY(-50px)} 10%{opacity:1;transform:translateY(0)} 80%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-50px)} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .btn-buy:active { transform: scale(0.97); }
        .btn-buy:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      {/* ACT 2 UNLOCK BANNER */}
      {showAct2Banner && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
            background: "linear-gradient(90deg, #16a34a, #22c55e, #16a34a)",
            backgroundSize: "200% 100%",
            animation: "banner 5s ease forwards, shimmer 2s linear infinite",
            padding: "1rem", textAlign: "center", color: "white",
            fontWeight: "bold", fontSize: "1rem",
          }}
        >
          🌱 500€ atteints ! L'Acte 2 se déverrouille… <br />
          <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>
            Tu peux maintenant louer ton premier terrain.
          </span>
        </div>
      )}

      {/* HEADER */}
      <div
        style={{
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)",
          padding: "0.75rem 1rem", borderBottom: "1px solid rgba(249,115,22,0.2)",
          position: "sticky", top: 0, zIndex: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#a3714a", textTransform: "uppercase", letterSpacing: "0.1em" }}>Chapardeur</div>
            <div style={{ fontWeight: "bold", fontSize: "1rem" }}>{pseudo}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#f97316" }}>{formatEuros(euros)}</div>
            <div style={{ fontSize: "0.72rem", color: "#a3714a" }}>
              +{formatEuros(prodsPerSec)}/sec · {Math.floor(strawberries)} 🍓
            </div>
          </div>
        </div>
        <div style={{ marginTop: "0.6rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#a3714a", marginBottom: 4 }}>
            <span>Acte 1 — Le Chapardeur</span>
            <span>{act2Unlocked ? "✅ Débloqué" : `${formatEuros(totalEuros)} / ${formatEuros(ACT2_GOAL)}`}</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 99, height: 6, overflow: "hidden" }}>
            <div
              style={{
                height: "100%", width: `${progress}%`,
                background: act2Unlocked ? "linear-gradient(90deg, #16a34a, #22c55e)" : "linear-gradient(90deg, #ea580c, #f97316)",
                borderRadius: 99, transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* CLICK ZONE */}
      <div style={{ padding: "1.5rem 1rem 1rem", textAlign: "center" }}>
        <p style={{ color: "#a3714a", fontSize: "0.8rem", margin: "0 0 1rem", fontStyle: "italic" }}>
          Acte I — Le Marché de Rungis, 6h du matin
        </p>
        <div style={{ position: "relative", display: "inline-block" }}>
          <button
            onClick={handleClick}
            style={{
              width: 160, height: 160, borderRadius: "50%",
              border: "3px solid #ea580c",
              background: "radial-gradient(circle at 40% 35%, #7f1d1d, #450a0a)",
              fontSize: 64, cursor: "pointer",
              animation: clickAnim ? "clickPop 0.1s ease, pulse-glow 2s ease-in-out infinite" : "pulse-glow 2s ease-in-out infinite",
              transition: "border-color 0.2s", position: "relative", overflow: "hidden",
            }}
          >
            🍓
            <FloatingText items={floats} />
          </button>
        </div>
        <div style={{ marginTop: "0.75rem", color: "#f97316", fontSize: "0.85rem" }}>
          <strong>+{clickPower} fraise{clickPower > 1 ? "s" : ""}</strong> par clic
          <span style={{ color: "#a3714a" }}> · {formatEuros(clickPower * STRAWBERRY_VALUE)}</span>
        </div>
      </div>

      {/* UPGRADES */}
      <section style={{ padding: "0 1rem 1rem" }}>
        <h3 style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#a3714a", margin: "0 0 0.6rem" }}>
          ⚡ Améliorations
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {unlockedUpgrades.map((u) => {
            const bought = boughtUpgrades.includes(u.id);
            const canAfford = euros >= u.cost;
            return (
              <div
                key={u.id}
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  background: bought ? "rgba(22,163,74,0.15)" : canAfford ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${bought ? "rgba(22,163,74,0.4)" : canAfford ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 10, padding: "0.65rem 0.75rem",
                }}
              >
                <div style={{ fontSize: 28 }}>{u.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: bought ? "#86efac" : "#fed7aa" }}>
                    {u.name} {bought && "✓"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#a3714a" }}>{u.desc}</div>
                </div>
                {!bought && (
                  <button
                    className="btn-buy"
                    onClick={() => buyUpgrade(u)}
                    disabled={!canAfford}
                    style={{
                      padding: "0.4rem 0.75rem", borderRadius: 8, border: "none",
                      background: canAfford ? "linear-gradient(135deg, #ea580c, #f97316)" : "rgba(255,255,255,0.1)",
                      color: canAfford ? "white" : "#a3714a",
                      fontSize: "0.78rem", fontWeight: "bold",
                      cursor: canAfford ? "pointer" : "not-allowed",
                      whiteSpace: "nowrap", transition: "all 0.2s",
                    }}
                  >
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
        <h3 style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#a3714a", margin: "0 0 0.6rem" }}>
          🏗️ Équipements
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {BUILDINGS.map((b) => {
            const count = buildings[b.id] ?? 0;
            const cost = getBuildingCost(b, count);
            const canAfford = euros >= cost;
            const totalProd = b.baseProduction * count * STRAWBERRY_VALUE;
            return (
              <div
                key={b.id}
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  background: count > 0 ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${count > 0 ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 10, padding: "0.65rem 0.75rem",
                }}
              >
                <div style={{ fontSize: 28 }}>{b.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    {b.name}
                    {count > 0 && (
                      <span style={{ background: "#ea580c", color: "white", borderRadius: 99, padding: "0 6px", fontSize: "0.7rem" }}>
                        ×{count}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#a3714a" }}>
                    {b.desc}
                    {count > 0 && <span style={{ color: "#f97316" }}> · Total : {formatEuros(totalProd)}/sec</span>}
                  </div>
                </div>
                <button
                  className="btn-buy"
                  onClick={() => buyBuilding(b)}
                  disabled={!canAfford}
                  style={{
                    padding: "0.4rem 0.75rem", borderRadius: 8, border: "none",
                    background: canAfford ? "linear-gradient(135deg, #ea580c, #f97316)" : "rgba(255,255,255,0.1)",
                    color: canAfford ? "white" : "#a3714a",
                    fontSize: "0.78rem", fontWeight: "bold",
                    cursor: canAfford ? "pointer" : "not-allowed",
                    whiteSpace: "nowrap", transition: "all 0.2s",
                  }}
                >
                  {formatEuros(cost)}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ACT 2 TEASER */}
      {act2Unlocked && (
        <div
          style={{
            margin: "1.5rem 1rem 0", padding: "1rem", borderRadius: 12,
            background: "linear-gradient(135deg, rgba(22,163,74,0.15), rgba(16,185,129,0.1))",
            border: "1px solid rgba(22,163,74,0.4)", textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32 }}>🌱</div>
          <div style={{ fontWeight: "bold", color: "#86efac", marginBottom: 4 }}>Acte 2 débloqué !</div>
          <div style={{ fontSize: "0.8rem", color: "#6ee7b7" }}>
            Un maraîcher du marché t'a remarqué. <br />
            Il te propose de louer un bout de son terrain à Montreuil…
          </div>
          <div style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "#a3714a", fontStyle: "italic" }}>
            (Acte 2 en cours de développement — bientôt disponible)
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.65rem", color: "#5c3317" }}>
        Sauvegarde auto · {pseudo} · Acte I
      </div>
    </div>
  );
}
